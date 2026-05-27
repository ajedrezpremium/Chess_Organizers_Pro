/**
 * RoundHeader.jsx
 *
 * Cabecera de una ronda: número, estado, progreso y acciones
 * (publicar / cerrar / exportar TRF).
 */

import React from 'react';

const STAGE_LABELS = {
  pending:   { label: 'Pendiente',  cls: 'stage--pending'   },
  generated: { label: 'Generada',   cls: 'stage--generated' },
  published: { label: 'Publicada',  cls: 'stage--published' },
  closed:    { label: 'Cerrada',    cls: 'stage--closed'    },
};

function stageOf(round) {
  if (round.closed)    return 'closed';
  if (round.published) return 'published';
  if (round.pairings?.length > 0) return 'generated';
  return 'pending';
}

export function RoundHeader({
  round,
  totalRounds,
  resultsEntered,
  totalGames,
  onPublish,
  onClose,
  onExportTRF,
  backendInfo,
}) {
  const stage     = stageOf(round);
  const stageInfo = STAGE_LABELS[stage];
  const progress  = totalGames > 0 ? Math.round((resultsEntered / totalGames) * 100) : 0;
  const allDone   = resultsEntered === totalGames && totalGames > 0;

  return (
    <div className="round-header">

      {/* Título e insignia de ronda */}
      <div className="round-header__left">
        <div className="round-header__title">
          <span className="round-header__num">
            Ronda {round.number}
          </span>
          <span className="round-header__of">/ {totalRounds}</span>
        </div>

        <span className={`stage-badge ${stageInfo.cls}`}>
          {stageInfo.label}
        </span>

        {/* Badge del backend — relevante para árbitros FIDE */}
        {backendInfo && (
          <span
            className={`backend-badge ${backendInfo.isFideEndorsed ? 'backend-badge--endorsed' : 'backend-badge--fallback'}`}
            title={backendInfo.label}
          >
            {backendInfo.isFideEndorsed ? '✓ FIDE endorsed' : '⚠ Motor JS'}
          </span>
        )}
      </div>

      {/* Barra de progreso de resultados */}
      <div className="round-header__progress">
        <div className="progress-track">
          <div
            className={`progress-fill ${allDone ? 'progress-fill--complete' : ''}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="progress-label">
          {resultsEntered}/{totalGames} resultados
        </span>
      </div>

      {/* Acciones */}
      <div className="round-header__actions">
        {!round.published && !round.closed && round.pairings?.length > 0 && (
          <button
            type="button"
            className="action-btn action-btn--secondary"
            onClick={onPublish}
            title="Publicar emparejamientos para que los jugadores los vean"
          >
            Publicar
          </button>
        )}
        {round.published && !round.closed && allDone && (
          <button
            type="button"
            className="action-btn action-btn--primary"
            onClick={onClose}
            title="Cerrar ronda y actualizar clasificación"
          >
            Cerrar ronda
          </button>
        )}
        <button
          type="button"
          className="action-btn action-btn--ghost"
          onClick={onExportTRF}
          title="Descargar TRF para enviar a la federación"
        >
          TRF ↓
        </button>
      </div>
    </div>
  );
}
