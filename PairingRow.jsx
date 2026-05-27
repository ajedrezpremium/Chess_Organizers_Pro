/**
 * PairingRow.jsx
 *
 * Fila de un emparejamiento individual (un tablero).
 * Responsabilidad única: mostrar un par blancas/negras y capturar el resultado.
 *
 * Props:
 *   pairing      — objeto Pairing del motor
 *   white        — objeto Player (blancas)
 *   black        — objeto Player (negras) | null si bye
 *   boardNumber  — número de tablero (1-based)
 *   roundClosed  — si la ronda está cerrada (inputs deshabilitados)
 *   onResult     — (pairingIndex, result) => void
 *   index        — índice en el array de pairings (para onResult)
 */

import React, { useCallback } from 'react';
import { Result } from '../../../engine/types.js';

// ── Botones de resultado ──────────────────────────────────────────────────────

const RESULT_OPTIONS = [
  { value: Result.WHITE_WIN, label: '1 – 0',   title: 'Ganan blancas' },
  { value: Result.DRAW,      label: '½ – ½',   title: 'Tablas'        },
  { value: Result.BLACK_WIN, label: '0 – 1',   title: 'Ganan negras'  },
];

function ResultButton({ option, active, disabled, onClick }) {
  return (
    <button
      type="button"
      className={`result-btn ${active ? 'result-btn--active' : ''}`}
      data-result={option.value}
      title={option.title}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
    >
      {option.label}
    </button>
  );
}

// ── Player chip ───────────────────────────────────────────────────────────────

function PlayerChip({ player, side, isWinner }) {
  if (!player) {
    return (
      <div className={`player-chip player-chip--${side} player-chip--bye`}>
        <span className="player-chip__name">— BYE —</span>
      </div>
    );
  }

  return (
    <div className={`player-chip player-chip--${side} ${isWinner ? 'player-chip--winner' : ''}`}>
      {player.title && (
        <span className="player-chip__title">{player.title}</span>
      )}
      <span className="player-chip__name">
        {player.lastName}{player.name ? `, ${player.name[0]}.` : ''}
      </span>
      {player.fideRating > 0 && (
        <span className="player-chip__rating">{player.fideRating}</span>
      )}
    </div>
  );
}

// ── PairingRow ────────────────────────────────────────────────────────────────

export function PairingRow({ pairing, white, black, boardNumber, roundClosed, onResult, index }) {
  const currentResult = pairing.result;
  const hasResult     = currentResult && currentResult !== Result.NOT_PLAYED;

  const handleResult = useCallback((value) => {
    // Clic en resultado activo → limpiar (toggle)
    const newResult = currentResult === value ? Result.NOT_PLAYED : value;
    onResult(index, newResult);
  }, [currentResult, onResult, index]);

  const whiteWon = currentResult === Result.WHITE_WIN;
  const blackWon = currentResult === Result.BLACK_WIN;

  return (
    <div
      className={`pairing-row ${hasResult ? 'pairing-row--has-result' : ''} ${pairing.isBye ? 'pairing-row--bye' : ''}`}
      data-board={boardNumber}
    >
      {/* Número de tablero */}
      <div className="pairing-row__board" aria-label={`Tablero ${boardNumber}`}>
        <span>{String(boardNumber).padStart(2, '0')}</span>
      </div>

      {/* Jugador blancas */}
      <PlayerChip player={white} side="white" isWinner={whiteWon} />

      {/* Controles de resultado */}
      {pairing.isBye ? (
        <div className="pairing-row__bye-badge">BYE · ½ pto</div>
      ) : (
        <div className="pairing-row__results" role="group" aria-label="Resultado">
          {RESULT_OPTIONS.map((opt) => (
            <ResultButton
              key={opt.value}
              option={opt}
              active={currentResult === opt.value}
              disabled={roundClosed}
              onClick={() => handleResult(opt.value)}
            />
          ))}
        </div>
      )}

      {/* Jugador negras */}
      <PlayerChip player={black} side="black" isWinner={blackWon} />
    </div>
  );
}
