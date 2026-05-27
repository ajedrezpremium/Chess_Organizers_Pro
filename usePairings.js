/**
 * usePairings.js — Adaptador React/Firestore (actualizado)
 *
 * CAMBIO RESPECTO A LA VERSIÓN ANTERIOR:
 *   Antes llamaba directamente a dutch.js para emparejar.
 *   Ahora delega en PairingEngine, que selecciona automáticamente
 *   bbpPairings (endorsed) o dutch.js (fallback).
 *
 * Este hook sigue siendo el ÚNICO punto de contacto entre el motor
 * y el mundo React/Firestore. La lógica de selección de backend
 * vive en PairingEngine, no aquí.
 *
 * Patrón de capas:
 *
 *   Firestore  ←→  usePairings  ←→  PairingEngine  ←→  bbpPairings / dutch.js
 *   (React)         (adaptador)       (estrategia)        (motor puro)
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { doc, collection, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebase';

import { engine as defaultEngine } from './pairingEngine.js';
import { serializeTRF, parseTRF }  from '../trf/trf.js';
import { applyRoundResults, buildStandings } from './dutch.js';
import { calculateTiebreak } from './tiebreaks.js';
import { createPlayer, createRound, DEFAULT_TIEBREAK_ORDER, Result } from './types.js';

// ── Conversores Firestore ↔ Motor (sin cambios) ───────────────────────────────

function firestoreToPlayer(doc) {
  return createPlayer({
    id:           doc.id,
    name:         doc.name         ?? '',
    lastName:     doc.lastName     ?? '',
    fideRating:   doc.fideRating   ?? doc.elo ?? 0,
    title:        doc.title        ?? '',
    country:      doc.country      ?? '',
    fideid:       doc.fideid        ?? doc.fideId ?? '',
    points:       doc.points       ?? 0,
    colorHistory: doc.colorHistory ?? [],
    colorDiff:    doc.colorDiff    ?? 0,
    opponents:    doc.opponents    ?? [],
    withdrawn:    doc.withdrawn    ?? false,
    receivedBye:  doc.receivedBye  ?? false,
  });
}

function pairingToFirestore(p) {
  return { board: p.board, whiteId: p.whiteId, blackId: p.blackId,
           result: p.result, isBye: p.isBye };
}

// ── Hook principal ────────────────────────────────────────────────────────────

/**
 * @param {string}   tournamentId
 * @param {object[]} firestorePlayers
 * @param {object[]} firestoreRounds
 * @param {object}   tournamentConfig
 * @param {object}   [opts]
 * @param {PairingEngine} [opts.engine]  — Inyectar motor (útil en tests)
 */
export function usePairings(
  tournamentId,
  firestorePlayers,
  firestoreRounds,
  tournamentConfig,
  opts = {}
) {
  const pairingEngine = opts.engine ?? defaultEngine;

  const [generating, setGenerating]     = useState(false);
  const [error, setError]               = useState(null);
  const [backendInfo, setBackendInfo]   = useState(null);

  // Cargar info del backend al montar (muestra si es endorsed o no en la UI)
  useEffect(() => {
    pairingEngine.getBackendInfo().then(setBackendInfo).catch(() => {});
  }, [pairingEngine]);

  // ── Datos convertidos ────────────────────────────────────────────
  const players = useMemo(
    () => firestorePlayers.map(firestoreToPlayer),
    [firestorePlayers]
  );

  const rounds = useMemo(
    () => firestoreRounds.map((r) => createRound({
      number:    r.number,
      pairings:  (r.pairings ?? []).map((p) => ({
        board:   p.board,   whiteId: p.whiteId,
        blackId: p.blackId, result:  p.result ?? Result.NOT_PLAYED,
        isBye:   p.isBye ?? false,
      })),
      published: r.published ?? false,
      closed:    r.closed    ?? false,
      firestoreId: r.id,   // ID del documento Firestore para updates
    })),
    [firestoreRounds]
  );

  // ── Estado reconstruido ──────────────────────────────────────────
  const currentPlayerState = useMemo(() => {
    const closedRounds = rounds.filter((r) => r.closed);
    return closedRounds.reduce(
      (state, round) => applyRoundResults(state, round.pairings),
      players
    );
  }, [players, rounds]);

  const totalRounds     = tournamentConfig?.nRounds ?? 0;
  const nextRoundNumber = rounds.length + 1;
  const canPair         = nextRoundNumber <= totalRounds && players.length >= 2;

  // ── TRF del estado actual (input para bbpPairings) ───────────────
  const currentTRF = useMemo(() => {
    if (!tournamentConfig) return null;
    const config = {
      name:               tournamentConfig.name        ?? 'Torneo',
      city:               tournamentConfig.city        ?? '',
      federation:         tournamentConfig.federation  ?? '',
      startDate:          tournamentConfig.startDate   ?? '',
      endDate:            tournamentConfig.endDate     ?? '',
      timeControl:        tournamentConfig.timeControl ?? '',
      tournamentTypeCode: 'S',
      chiefArbiter:       tournamentConfig.arbiter     ?? '',
      nRounds:            totalRounds,
      tiebreaks:          tournamentConfig.tiebreaks   ?? DEFAULT_TIEBREAK_ORDER,
      extendedType:       `IND SWISS ${totalRounds}R`,
    };
    return serializeTRF(config, currentPlayerState, rounds.filter((r) => r.closed));
  }, [tournamentConfig, currentPlayerState, rounds, totalRounds]);

  // ── Generar siguiente ronda ──────────────────────────────────────
  const generateNextRound = useCallback(async () => {
    if (!canPair || generating) return null;
    setGenerating(true);
    setError(null);

    try {
      const result = await pairingEngine.pairNextRound({
        trf:     currentTRF,
        system:  tournamentConfig?.system === 'burstein' ? 'burstein' : 'dutch',
        players: currentPlayerState,   // Solo usado si backend = JS
        round:   nextRoundNumber,
      });

      if (result.noValidPairing) {
        setError('No existe emparejamiento válido para esta ronda.');
        return null;
      }

      if (result.warnings?.length) {
        console.warn('[usePairings] Advertencias:', result.warnings);
      }

      // Persistir en Firestore
      const roundDoc = {
        number:      nextRoundNumber,
        pairings:    result.pairings.map(pairingToFirestore),
        published:   false,
        closed:      false,
        byePlayerId: result.byePlayer?.id ?? null,
        warnings:    result.warnings ?? [],
        backend:     result.backend,
        createdAt:   serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, 'tournaments', tournamentId, 'rounds'),
        roundDoc
      );

      return { ...result, firestoreId: docRef.id };

    } catch (err) {
      setError(err.message);
      console.error('[usePairings] Error generando ronda:', err);
      return null;
    } finally {
      setGenerating(false);
    }
  }, [
    canPair, generating, pairingEngine, currentTRF,
    tournamentConfig, currentPlayerState, nextRoundNumber, tournamentId,
  ]);

  // ── Guardar resultado ────────────────────────────────────────────
  const saveResult = useCallback(async (roundFirestoreId, pairingIndex, result) => {
    if (!roundFirestoreId) return;
    setError(null);
    try {
      const roundRef  = doc(db, 'tournaments', tournamentId, 'rounds', roundFirestoreId);
      const round     = rounds.find((r) => r.firestoreId === roundFirestoreId);
      if (!round) throw new Error('Ronda no encontrada');

      const updatedPairings = round.pairings.map((p, i) =>
        i === pairingIndex ? { ...pairingToFirestore(p), result } : pairingToFirestore(p)
      );
      await updateDoc(roundRef, { pairings: updatedPairings, updatedAt: serverTimestamp() });
    } catch (err) {
      setError(`Error guardando resultado: ${err.message}`);
    }
  }, [rounds, tournamentId]);

  // ── Publicar / cerrar ronda ──────────────────────────────────────
  const publishRound = useCallback(async (roundFirestoreId) => {
    const ref = doc(db, 'tournaments', tournamentId, 'rounds', roundFirestoreId);
    await updateDoc(ref, { published: true, updatedAt: serverTimestamp() });
  }, [tournamentId]);

  const closeRound = useCallback(async (roundFirestoreId) => {
    const ref = doc(db, 'tournaments', tournamentId, 'rounds', roundFirestoreId);
    await updateDoc(ref, { closed: true, closedAt: serverTimestamp() });
  }, [tournamentId]);

  // ── Standings ────────────────────────────────────────────────────
  const standings = useMemo(() => {
    const tiebreaks   = tournamentConfig?.tiebreaks ?? DEFAULT_TIEBREAK_ORDER;
    const playersById = Object.fromEntries(currentPlayerState.map((p) => [p.id, p]));
    const withTb = currentPlayerState.map((player) => ({
      ...player,
      tiebreakValues: tiebreaks.map((tb) =>
        calculateTiebreak(tb, player, playersById, totalRounds)
      ),
    }));
    return buildStandings(withTb);
  }, [currentPlayerState, tournamentConfig, totalRounds]);

  // ── Exportar TRF ─────────────────────────────────────────────────
  const exportTRF = useCallback(() => currentTRF, [currentTRF]);

  // ── Verificar TRF actual con el motor ────────────────────────────
  const verifyCurrentTRF = useCallback(async () => {
    if (!currentTRF) return null;
    return pairingEngine.verifyPairings(currentTRF, 'dutch');
  }, [pairingEngine, currentTRF]);

  return {
    // Estado
    players:          currentPlayerState,
    rounds,
    standings,
    nextRoundNumber,
    totalRounds,
    canPair,
    generating,
    error,
    backendInfo,   // { backend, isFideEndorsed, label } — para mostrar en UI

    // Acciones
    generateNextRound,
    saveResult,
    publishRound,
    closeRound,
    exportTRF,
    verifyCurrentTRF,
  };
}
