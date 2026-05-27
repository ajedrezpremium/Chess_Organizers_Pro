/**
 * Pairings.jsx — Componente principal de emparejamientos
 *
 * Responsabilidades:
 *   - Conectar usePairings (motor + Firestore) con la UI
 *   - Mostrar la ronda activa con sus partidas
 *   - Permitir navegar entre rondas anteriores (solo lectura)
 *   - Capturar resultados en tiempo real
 *   - Generar la siguiente ronda
 *   - Exportar TRF
 *
 * NO contiene lógica de negocio — todo viene de usePairings.
 *
 * Props:
 *   tournamentId     — string
 *   tournament       — objeto del torneo (config)
 *   firestorePlayers — array de documentos de jugadores Firestore
 *   firestoreRounds  — array de documentos de rondas Firestore
 */

import React, { useState, useMemo, useCallback } from 'react';
import { usePairings }   from '../../../usePairings.js';
import { PairingRow }    from './PairingRow.jsx';
import { RoundHeader }   from './RoundHeader.jsx';
import { Result }        from '../../../engine/types.js';
import './Pairings.css';

// ── Utilidades ────────────────────────────────────────────────────────────────

function downloadTRF(trfContent, tournamentName, roundNumber) {
  const blob     = new Blob([trfContent], { type: 'text/plain' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = `${tournamentName.replace(/\s+/g, '_')}_R${roundNumber}.trf`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({ canPair, nextRoundNumber, totalRounds, generating, onGenerate }) {
  if (nextRoundNumber > totalRounds && totalRounds > 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">⚑</div>
        <h3>Torneo finalizado</h3>
        <p>Todas las {totalRounds} rondas han sido jugadas.</p>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <div className="empty-state__icon">⊞</div>
      <h3>Ronda {nextRoundNumber} no generada</h3>
      <p>
        {!canPair
          ? 'Necesitas al menos 2 jugadores para emparejar.'
          : 'Genera los emparejamientos para esta ronda.'}
      </p>
      {canPair && (
        <button
          type="button"
          className="action-btn action-btn--primary action-btn--lg"
          onClick={onGenerate}
          disabled={generating}
        >
          {generating
            ? <><span className="spinner" />Generando…</>
            : `Generar ronda ${nextRoundNumber}`}
        </button>
      )}
    </div>
  );
}

// ── RoundNav ──────────────────────────────────────────────────────────────────

function RoundNav({ rounds, activeRoundIndex, onSelect, nextRoundNumber }) {
  return (
    <nav className="round-nav" aria-label="Navegación de rondas">
      {rounds.map((round, i) => (
        <button
          key={round.number}
          type="button"
          className={`round-nav__btn ${activeRoundIndex === i ? 'round-nav__btn--active' : ''} ${round.closed ? 'round-nav__btn--closed' : ''}`}
          onClick={() => onSelect(i)}
          aria-current={activeRoundIndex === i ? 'page' : undefined}
        >
          R{round.number}
          {round.closed && <span className="round-nav__tick">✓</span>}
        </button>
      ))}

      {/* Botón para la siguiente ronda (no generada aún) */}
      {nextRoundNumber <= (rounds[0]?._totalRounds ?? 99) && (
        <button
          type="button"
          className={`round-nav__btn round-nav__btn--next ${activeRoundIndex === rounds.length ? 'round-nav__btn--active' : ''}`}
          onClick={() => onSelect(rounds.length)}
        >
          R{nextRoundNumber}
          <span className="round-nav__dot" />
        </button>
      )}
    </nav>
  );
}

// ── Pairings (componente principal) ──────────────────────────────────────────

export function Pairings({ tournamentId, tournament, firestorePlayers, firestoreRounds }) {
  const tournamentConfig = {
    name:        tournament.name,
    city:        tournament.city        ?? '',
    federation:  tournament.federation  ?? '',
    startDate:   tournament.date        ?? tournament.startDate ?? '',
    endDate:     tournament.endDate     ?? '',
    timeControl: tournament.timeControl ?? '',
    arbiter:     tournament.arbiter     ?? '',
    nRounds:     tournament.nRounds     || tournament.rounds || 0,
    tiebreaks:   tournament.tiebreaks   ?? undefined,
    system:      tournament.system      ?? 'dutch',
  };

  const {
    players, rounds, standings,
    nextRoundNumber, totalRounds, canPair,
    generating, error,
    backendInfo,
    generateNextRound, saveResult,
    publishRound, closeRound,
    exportTRF,
  } = usePairings(tournamentId, firestorePlayers, firestoreRounds, tournamentConfig);

  // ── Navegación de rondas ─────────────────────────────────────────
  const [activeRoundIndex, setActiveRoundIndex] = useState(() =>
    Math.max(0, (firestoreRounds?.length ?? 0) - 1)
  );

  const activeRound    = rounds[activeRoundIndex] ?? null;
  const isCurrentRound = activeRoundIndex === rounds.length - 1;
  const isNextRound    = activeRoundIndex === rounds.length;

  // ── Mapa de jugadores por ID ─────────────────────────────────────
  const playersById = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p])),
    [players]
  );

  // ── Progreso de resultados de la ronda activa ────────────────────
  const { resultsEntered, totalGames } = useMemo(() => {
    if (!activeRound) return { resultsEntered: 0, totalGames: 0 };
    const games   = activeRound.pairings.filter((p) => !p.isBye);
    const entered = games.filter((p) => p.result && p.result !== Result.NOT_PLAYED);
    return { resultsEntered: entered.length, totalGames: games.length };
  }, [activeRound]);

  // ── Handlers ─────────────────────────────────────────────────────
  const handleResult = useCallback((pairingIndex, result) => {
    if (!activeRound?.firestoreId) return;
    saveResult(activeRound.firestoreId, pairingIndex, result);
  }, [activeRound, saveResult]);

  const handlePublish = useCallback(() => {
    if (!activeRound?.firestoreId) return;
    publishRound(activeRound.firestoreId);
  }, [activeRound, publishRound]);

  const handleClose = useCallback(() => {
    if (!activeRound?.firestoreId) return;
    closeRound(activeRound.firestoreId);
  }, [activeRound, closeRound]);

  const handleExportTRF = useCallback(() => {
    const trf = exportTRF();
    if (!trf) return;
    const roundNum = activeRound?.number ?? nextRoundNumber - 1;
    downloadTRF(trf, tournament.name ?? 'torneo', roundNum);
  }, [exportTRF, activeRound, nextRoundNumber, tournament.name]);

  const handleGenerate = useCallback(async () => {
    const result = await generateNextRound();
    if (result) {
      setActiveRoundIndex(rounds.length); // apuntar a la nueva ronda
    }
  }, [generateNextRound, rounds.length]);

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="pairings">

      {/* Cabecera del módulo */}
      <div className="pairings__header">
        <h2 className="pairings__title">Emparejamientos</h2>
        <div className="pairings__meta">
          <span className="pairings__player-count">
            {players.length} jugadores
          </span>
          {error && (
            <div className="pairings__error" role="alert">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Navegación entre rondas */}
      {(rounds.length > 0 || canPair) && (
        <RoundNav
          rounds={rounds.map((r) => ({ ...r, _totalRounds: totalRounds }))}
          activeRoundIndex={activeRoundIndex}
          onSelect={setActiveRoundIndex}
          nextRoundNumber={nextRoundNumber}
        />
      )}

      {/* Contenido principal */}
      <div className="pairings__body">

        {/* Estado vacío: ronda no generada */}
        {isNextRound || rounds.length === 0 ? (
          <EmptyState
            canPair={canPair}
            nextRoundNumber={nextRoundNumber}
            totalRounds={totalRounds}
            generating={generating}
            onGenerate={handleGenerate}
          />
        ) : activeRound ? (
          <>
            {/* Cabecera de la ronda activa */}
            <RoundHeader
              round={activeRound}
              totalRounds={totalRounds}
              resultsEntered={resultsEntered}
              totalGames={totalGames}
              onPublish={handlePublish}
              onClose={handleClose}
              onExportTRF={handleExportTRF}
              backendInfo={backendInfo}
            />

            {/* Lista de tableros */}
            <div className="pairing-list" role="list">
              {activeRound.pairings.map((pairing, i) => (
                <PairingRow
                  key={`${activeRound.number}-${pairing.board}`}
                  pairing={pairing}
                  white={playersById[pairing.whiteId] ?? null}
                  black={playersById[pairing.blackId] ?? null}
                  boardNumber={pairing.board}
                  roundClosed={activeRound.closed}
                  onResult={handleResult}
                  index={i}
                />
              ))}
            </div>

            {/* Advertencias del motor */}
            {activeRound.warnings?.length > 0 && (
              <div className="pairings__warnings">
                <h4>Avisos del motor</h4>
                <ul>
                  {activeRound.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Botón de generar siguiente ronda (solo si esta está cerrada) */}
            {activeRound.closed && isCurrentRound && canPair && (
              <div className="pairings__next-round">
                <button
                  type="button"
                  className="action-btn action-btn--primary action-btn--lg"
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  {generating
                    ? <><span className="spinner" />Generando ronda {nextRoundNumber}…</>
                    : `Generar ronda ${nextRoundNumber}`}
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

export default Pairings;
