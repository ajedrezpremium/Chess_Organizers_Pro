/**
 * pairingEngine.js — Motor unificado de emparejamientos
 *
 * Punto de entrada único para TODAS las operaciones de emparejamiento.
 * Implementa el patrón Estrategia con dos backends:
 *
 *   1. bbpPairings (C++) — FIDE-endorsed, weighted matching O(n³ log n)
 *                          Requerido para torneos grandes y para el endorsement.
 *
 *   2. dutch.js (JS)     — Motor JavaScript propio, sin dependencias externas.
 *                          Fallback para desarrollo, tests y entornos sin binario.
 *
 * La selección del backend es automática:
 *   - Si bbpPairings está disponible → bbpPairings
 *   - Si no → dutch.js con advertencia en consola
 *
 * Puede forzarse un backend con { forceBackend: 'js' | 'bbp' }.
 *
 * Uso desde usePairings.js (adaptador React):
 *   import { PairingEngine } from './pairingEngine.js';
 *   const engine = new PairingEngine();
 *   const { pairings, warnings } = await engine.pairRound(trfContent);
 *
 * Uso desde el CLI (checker.js, rtg.js):
 *   const engine = new PairingEngine({ forceBackend: 'bbp' });
 */

import { existsSync } from 'fs';
import { generatePairings, checkPairings, generateRandomTournament,
         resolveBinaryPath, BbpError, BBP_EXIT } from './bbpBridge.js';
import { pairRound as jsPairRound, applyRoundResults } from '../engine/dutch.js';
import { serializeTRF, parseTRF } from '../trf/trf.js';

// ── Tipos de backend ──────────────────────────────────────────────────────────

export const Backend = {
  BBP: 'bbp',   // bbpPairings C++ (FIDE-endorsed)
  JS:  'js',    // Motor JavaScript propio (fallback)
};

// ── Motor unificado ───────────────────────────────────────────────────────────

export class PairingEngine {
  /**
   * @param {object} [opts]
   * @param {'bbp'|'js'|'auto'} [opts.forceBackend]  — Forzar backend (por defecto: 'auto')
   * @param {string}  [opts.binaryPath]               — Ruta explícita al binario
   * @param {number}  [opts.timeoutMs]                — Timeout para bbpPairings
   * @param {boolean} [opts.verbose]                  — Mostrar logs de selección de backend
   */
  constructor(opts = {}) {
    this.forceBackend = opts.forceBackend ?? 'auto';
    this.binaryPath   = opts.binaryPath  ?? resolveBinaryPath();
    this.timeoutMs    = opts.timeoutMs   ?? 30_000;
    this.verbose      = opts.verbose     ?? false;
    this._backendCache = null;
  }

  // ── Selección de backend ─────────────────────────────────────────

  /**
   * Determina el backend a usar. Cachea el resultado tras la primera llamada.
   * @returns {Promise<'bbp'|'js'>}
   */
  async resolveBackend() {
    if (this._backendCache) return this._backendCache;

    if (this.forceBackend === Backend.JS) {
      this._log('Backend forzado: JS (dutch.js)');
      return (this._backendCache = Backend.JS);
    }
    if (this.forceBackend === Backend.BBP) {
      if (!existsSync(this.binaryPath)) {
        throw new Error(
          `Backend bbpPairings forzado pero el binario no existe: ${this.binaryPath}\n` +
          `Ejecuta: npm run download-bbp`
        );
      }
      this._log('Backend forzado: bbpPairings (C++)');
      return (this._backendCache = Backend.BBP);
    }

    // Auto: usar bbpPairings si el binario existe
    if (existsSync(this.binaryPath)) {
      this._log(`Backend auto: bbpPairings (C++) → ${this.binaryPath}`);
      return (this._backendCache = Backend.BBP);
    }

    this._log(
      'Backend auto: dutch.js (JS) — bbpPairings no encontrado en ' + this.binaryPath + '\n' +
      '  Para obtener endorsement FIDE instala bbpPairings: npm run download-bbp'
    );
    return (this._backendCache = Backend.JS);
  }

  // ── API pública ──────────────────────────────────────────────────

  /**
   * Genera los emparejamientos de la siguiente ronda.
   *
   * @param {object} params
   * @param {string}   params.trf        — TRF completo hasta la ronda anterior
   * @param {string}   [params.system]   — 'dutch' | 'burstein'
   * @param {Player[]} [params.players]  — Requerido solo si backend = JS
   * @param {number}   [params.round]    — Número de ronda (1-based), requerido para JS
   * @returns {Promise<PairingResult>}
   */
  async pairNextRound({ trf, system = 'dutch', players, round }) {
    const backend = await this.resolveBackend();

    if (backend === Backend.BBP) {
      return this._pairWithBBP(trf, system);
    } else {
      return this._pairWithJS(players, round);
    }
  }

  /**
   * Verifica los emparejamientos de un TRF completo.
   *
   * @param {string}  trf
   * @param {string}  [system]
   * @returns {Promise<CheckResult>}
   */
  async verifyPairings(trf, system = 'dutch') {
    const backend = await this.resolveBackend();

    if (backend === Backend.BBP) {
      return checkPairings(trf, { system, binaryPath: this.binaryPath, timeoutMs: this.timeoutMs });
    } else {
      return this._checkWithJS(trf);
    }
  }

  /**
   * Genera un torneo aleatorio completo (para RTG / FIDE verification).
   *
   * @param {object} opts
   * @param {string} [opts.modelTrf]
   * @param {number} [opts.seed]
   * @param {string} [opts.system]
   * @returns {Promise<{ trf: string, seed: number, backend: string }>}
   */
  async generateRandom(opts = {}) {
    const backend = await this.resolveBackend();

    if (backend === Backend.BBP) {
      const result = await generateRandomTournament({
        ...opts,
        binaryPath: this.binaryPath,
        timeoutMs:  this.timeoutMs,
      });
      return { ...result, backend: Backend.BBP };
    } else {
      // Delegar al RTG JavaScript (rtg.js)
      const { generateTournament } = await import('../cli/rtg.js');
      const result = generateTournament(opts);
      const { serializeTRF } = await import('../trf/trf.js');
      return {
        trf:     serializeTRF(result.config, result.players, result.rounds),
        seed:    opts.seed ?? 0,
        backend: Backend.JS,
      };
    }
  }

  /**
   * Devuelve qué backend está activo. Útil para mostrar en la UI.
   * @returns {Promise<BackendInfo>}
   */
  async getBackendInfo() {
    const backend = await this.resolveBackend();
    return {
      backend,
      isFideEndorsed: backend === Backend.BBP,
      binaryPath:     backend === Backend.BBP ? this.binaryPath : null,
      label: backend === Backend.BBP
        ? 'bbpPairings v6.0.0 (FIDE-endorsed, Dutch 2025)'
        : 'dutch.js (motor JS, no endorsed — instala bbpPairings para endorsement FIDE)',
    };
  }

  // ── Backends internos ────────────────────────────────────────────

  /**
   * Empareja usando bbpPairings.
   * Recibe y devuelve TRF — bbpPairings añade la nueva ronda al TRF de salida.
   */
  async _pairWithBBP(trf, system) {
    try {
      const { outputTrf, warnings } = await generatePairings(trf, {
        system,
        binaryPath: this.binaryPath,
        timeoutMs:  this.timeoutMs,
      });

      // Parsear el TRF de salida para extraer los nuevos emparejamientos
      const { rounds: newRounds, players: updatedPlayers } = parseTRF(outputTrf);
      const latestRound = newRounds[newRounds.length - 1];

      return {
        pairings:   latestRound?.pairings ?? [],
        outputTrf,
        warnings,
        backend:    Backend.BBP,
      };

    } catch (err) {
      if (err instanceof BbpError && err.exitCode === BBP_EXIT.NO_VALID_PAIRING) {
        return {
          pairings: [],
          outputTrf: trf,
          warnings: ['No existe emparejamiento válido para esta ronda según bbpPairings.'],
          backend:  Backend.BBP,
          noValidPairing: true,
        };
      }
      throw err;
    }
  }

  /**
   * Empareja usando el motor JavaScript (dutch.js).
   * Fallback cuando bbpPairings no está disponible.
   */
  async _pairWithJS(players, roundNumber) {
    if (!players || !roundNumber) {
      throw new Error(
        'El backend JS requiere players[] y roundNumber. ' +
        'Instala bbpPairings para usar solo TRF: npm run download-bbp'
      );
    }

    const { pairings, byePlayer, warnings } = jsPairRound(players, roundNumber);

    return {
      pairings,
      byePlayer,
      outputTrf: null,  // El backend JS no produce TRF directamente
      warnings: [
        '⚠ Usando motor JS (no endorsed). Para endorsement FIDE instala bbpPairings.',
        ...warnings,
      ],
      backend: Backend.JS,
    };
  }

  /**
   * Verifica pairings usando el motor JS (reimplementación del checker).
   */
  async _checkWithJS(trf) {
    const { players, rounds } = parseTRF(trf);
    const discrepancies = [];
    const warnings = ['⚠ Verificación con motor JS (no endorsed por FIDE).'];

    let state = players;
    for (let i = 0; i < rounds.length; i++) {
      const { pairings: expected } = jsPairRound(state, i + 1);
      const actual = rounds[i].pairings;

      const expectedSet = new Set(expected.map((p) => [p.whiteId, p.blackId].sort().join('|')));
      const actualSet   = new Set(actual.map((p)   => [p.whiteId, p.blackId].sort().join('|')));

      for (const pair of actualSet) {
        if (!expectedSet.has(pair)) {
          discrepancies.push(`Ronda ${i + 1}: par ${pair} en TRF pero no esperado por motor JS`);
        }
      }
      state = applyRoundResults(state, rounds[i].pairings);
    }

    return { ok: discrepancies.length === 0, discrepancies, warnings };
  }

  _log(msg) {
    if (this.verbose) console.log(`[PairingEngine] ${msg}`);
  }
}

// ── Instancia singleton para uso en la app ────────────────────────────────────

/**
 * Instancia global del motor.
 * La UI y usePairings.js importan esta instancia directamente.
 *
 * Para tests o CLI, crear una instancia propia con opciones específicas.
 */
export const engine = new PairingEngine({ verbose: process.env.NODE_ENV === 'development' });
