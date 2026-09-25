import { Card, CardHeader, DataTable, Badge } from '../../design-system/ui.jsx';
import { STATUS_STYLES } from '../../design-system/tokens.js';

function eventUrl(r) {
  return r.technicalUrl || r.broadcastUrl || r.officialUrl || '';
}

export default function FinishedTable({ items = [], live = false }) {
  return (
    <Card>
      <CardHeader title="🏁 Finalizados recientes" subtitle="Historial con ganador, sistema y reporte TRF"
        action={<span className="text-[10px] text-gray-400">{live ? '● LIVE' : ''}</span>} />
      <div className="p-2">
        <DataTable
          columns={[
            {
              key: 'name', label: 'Torneo',
              render: (r) => {
                const url = eventUrl(r);
                return url ? (
                  <a href={url} target="_blank" rel="noreferrer" title={`${r.name} — resultados oficiales`}
                    className="font-semibold hover:text-amber-600 dark:hover:text-amber-400 hover:underline">{r.name}</a>
                ) : <span className="font-semibold">{r.name}</span>;
              },
            },
            { key: 'system', label: 'Sistema' },
            {
              key: 'winner', label: 'Ganador',
              render: (r) => r.winner
                ? <span>🥇 {r.winner} <span className="opacity-60">({r.winnerElo})</span></span>
                : <span className="text-gray-400">—</span>,
            },
            { key: 'date', label: 'Fecha' },
            {
              key: 'trf', label: 'TRF', sortable: false,
              render: (r) => r.trf
                ? (r.technicalUrl
                  ? <a href={r.technicalUrl} target="_blank" rel="noreferrer" title="Reporte técnico (Chess-Results)"><Badge tone={STATUS_STYLES.finished}>📄 TRF ✓</Badge></a>
                  : <Badge tone={STATUS_STYLES.finished}>📄 TRF ✓</Badge>)
                : <span className="text-gray-400">—</span>,
            },
          ]}
          rows={items}
          emptyText="Sin historial todavía."
        />
      </div>
    </Card>
  );
}
