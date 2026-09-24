import { Card, CardHeader, DataTable, Badge } from '../../design-system/ui.jsx';
import { STATUS_STYLES } from '../../design-system/tokens.js';

export default function FinishedTable({ items = [] }) {
  return (
    <Card>
      <CardHeader title="🏁 Finalizados recientes" subtitle="Historial con ganador, sistema y reporte TRF"
        action={<button className="text-[11px] font-semibold text-fide-600 dark:text-fide-300 hover:underline">Exportar CSV</button>} />
      <div className="p-2">
        <DataTable
          columns={[
            { key: 'name', label: 'Torneo', render: (r) => <span className="font-semibold">{r.name}</span> },
            { key: 'system', label: 'Sistema' },
            { key: 'winner', label: 'Ganador', render: (r) => <span>🥇 {r.winner} <span className="opacity-60">({r.winnerElo})</span></span> },
            { key: 'date', label: 'Fecha' },
            { key: 'trf', label: 'TRF', sortable: false, render: (r) => r.trf
              ? <Badge tone={STATUS_STYLES.finished}>📄 TRF ✓</Badge>
              : <span className="text-gray-400">—</span> },
          ]}
          rows={items}
          emptyText="Sin historial todavía."
        />
      </div>
    </Card>
  );
}
