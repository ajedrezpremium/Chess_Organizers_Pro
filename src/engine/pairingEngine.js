/**
 * pairingEngine.js — Motor unificado de emparejamientos
 *
 * Soporta 5 sistemas: dutch, roundrobin, burstein, dubov, knockout
 * + aceleración Baku (configurable).
 *
 * Backends:
 *   1. bbpPairings (C++) — FIDE-endorsed, weighted matching O(n³ log n)
 *   2. JS propio         — dutch.js, roundrobin.js, burstein.js, dubov.js, knockout.js
 */

import { existsSync } from 'fs';
import { generatePairings, checkPairings, generateRandomTournament,
         resolveBinaryPath, BbpError, BBP_EXIT } from '../bbp/bbpBridge.js';
import { pairRound as dutchPairRound, applyRoundResults } from './dutch.js';
import { pairRound as rrPairRound } from './roundrobin.js';
import { pairRound as bursteinPairRound } from './burstein.js';
import { pairRound as dubovPairRound } from './dubov.js';
import { generateBracket as koGenerate, advanceBracket as koAdvance, calculateStandings as koStandings } from './knockout.js';
import { serializeTRF, parseTRF } from '../trf/trf.js';

export const Backend = {
  BBP: 'bbp',
  JS:  'js',
};

export const System = {
  DUTCH:     'dutch',
  ROUNDROBIN:'roundrobin',
  BURSTEIN:  'burstein',
  DUBOV:     'dubov',
  KNOCKOUT:  'knockout',
};

export class PairingEngine {
  constructor(opts = {}) {
    this.forceBackend = opts.forceBackend ?? 'auto';
    this.binaryPath   = opts.binaryPath  ?? resolveBinaryPath();
    this.timeoutMs    = opts.timeoutMs   ?? 30_000;
    this.verbose      = opts.verbose     ?? false;
    this._backendCache = null;
    // BandA cache for Burstein round 2
    this._bandA = [];
  }

  async resolveBackend() {
    if (this._backendCache) return this._backendCache;

    if (this.forceBackend === Backend.JS) {
      this._log('Backend forzado: JS');
      return (this._backendCache = Backend.JS);
    }
    if (this.forceBackend === Backend.BBP) {
      if (!existsSync(this.binaryPath)) {
        throw new Error(
          `Backend bbpPairings forzado pero el binario no existe: ${this.binaryPath}\n` +
          `Ejecuta: npm run download-bbp`
        );
      }
      return (this._backendCache = Backend.BBP);
    }

    if (existsSync(this.binaryPath)) {
      return (this._backendCache = Backend.BBP);
    }
    return (this._backendCache = Backend.JS);
  }

  async pairNextRound({ trf, system = 'dutch', players, round, bandA }) {
    const backend = await this.resolveBackend();

    if (backend === Backend.BBP) {
      if (system === System.ROUNDROBIN) {
        return this._pairRRWithJS(players, round);
      }
      return this._pairWithBBP(trf, system);
    }

    if (system === System.ROUNDROBIN) return this._pairRRWithJS(players, round);
    if (system === System.BURSTEIN)   return this._pairBurstein(players, round, bandA ?? this._bandA);
    if (system === System.DUBOV)      return this._pairDubov(players, round);
    if (system === System.KNOCKOUT)   return this._pairKO(players, round);
    return this._pairWithJS(players, round);
  }

  async verifyPairings(trf, system = 'dutch') {
    const backend = await this.resolveBackend();
    if (backend === Backend.BBP) {
      return checkPairings(trf, { system, binaryPath: this.binaryPath, timeoutMs: this.timeoutMs });
    }
    return this._checkWithJS(trf);
  }

  async generateRandom(opts = {}) {
    const backend = await this.resolveBackend();
    if (backend === Backend.BBP) {
      const result = await generateRandomTournament({
        ...opts,
        binaryPath: this.binaryPath,
        timeoutMs:  this.timeoutMs,
      });
      return { ...result, backend: Backend.BBP };
    }
    const { generateTournament } = await import('../cli/rtg.js');
    const result = generateTournament(opts);
    const { serializeTRF } = await import('../trf/trf.js');
    return {
      trf: serializeTRF(result.config, result.players, result.rounds),
      seed: opts.seed ?? 0,
      backend: Backend.JS,
    };
  }

  async getBackendInfo() {
    const backend = await this.resolveBackend();
    return {
      backend,
      isFideEndorsed: backend === Backend.BBP,
      binaryPath: backend === Backend.BBP ? this.binaryPath : null,
      label: backend === Backend.BBP
        ? 'bbpPairings v6.0.0 (FIDE-endorsed, Dutch 2025)'
        : 'Motor JS (admite: dutch, roundrobin, burstein, dubov)',
    };
  }

  // ── Internos ─────────────────────────────────────────────────────

  async _pairWithBBP(trf, system) {
    try {
      const { outputTrf, warnings } = await generatePairings(trf, { system, binaryPath: this.binaryPath, timeoutMs: this.timeoutMs });
      const { rounds: newRounds } = parseTRF(outputTrf);
      const latestRound = newRounds[newRounds.length - 1];
      return { pairings: latestRound?.pairings ?? [], outputTrf, warnings, backend: Backend.BBP };
    } catch (err) {
      if (err instanceof BbpError && err.exitCode === BBP_EXIT.NO_VALID_PAIRING) {
        return { pairings: [], outputTrf: trf, warnings: ['No existe emparejamiento válido.'], backend: Backend.BBP, noValidPairing: true };
      }
      throw err;
    }
  }

  async _pairWithJS(players, roundNumber) {
    if (!players || !roundNumber) {
      throw new Error('El backend JS requiere players[] y roundNumber');
    }
    const { pairings, byePlayer, warnings } = dutchPairRound(players, roundNumber);
    return { pairings, byePlayer, outputTrf: null, warnings: ['⚠ Motor JS (no endorsed).', ...warnings], backend: Backend.JS };
  }

  async _pairRRWithJS(players, roundNumber) {
    if (!players || !roundNumber) {
      throw new Error('Round Robin requiere players[] y roundNumber');
    }
    const result = rrPairRound(players, roundNumber);
    return { ...result, outputTrf: null, warnings: ['⚠ Round Robin (motor JS).', ...result.warnings], backend: Backend.JS };
  }

  async _pairBurstein(players, roundNumber, bandA) {
    if (!players || !roundNumber) {
      throw new Error('Burstein requiere players[] y roundNumber');
    }
    const result = bursteinPairRound(players, roundNumber, bandA);
    // Cachear banda A después de ronda 1 para usar en ronda 2
    if (roundNumber === 1) {
      const { getBandA } = await import('./burstein.js');
      this._bandA = getBandA(players);
    }
    return { ...result, outputTrf: null, warnings: ['⚠ Burstein (motor JS).', ...result.warnings], backend: Backend.JS };
  }

  async _pairDubov(players, roundNumber) {
    if (!players || !roundNumber) {
      throw new Error('Dubov requiere players[] y roundNumber');
    }
    const result = dubovPairRound(players, roundNumber);
    return { ...result, outputTrf: null, warnings: ['⚠ Dubov (motor JS).', ...result.warnings], backend: Backend.JS };
  }

  async _checkWithJS(trf) {
    const { players, rounds } = parseTRF(trf);
    const discrepancies = [];
    const warnings = ['⚠ Verificación con motor JS.'];

    let state = players;
    for (let i = 0; i < rounds.length; i++) {
      const { pairings: expected } = dutchPairRound(state, i + 1);
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

export const engine = new PairingEngine({ verbose: process.env.NODE_ENV === 'development' });
