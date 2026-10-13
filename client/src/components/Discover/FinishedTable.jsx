import { Card, CardHeader, DataTable, Badge } from '../../design-system/ui.jsx';
import { STATUS_STYLES } from '../../design-system/tokens.js';
import { useI18n } from '../../i18n/context.jsx';

function eventUrl(r) {
  return r.technicalUrl || r.broadcastUrl || r.officialUrl || '';
}

export default function FinishedTable({ items = [], live = false }) {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader title={t('dp.dpFinTitle')} subtitle={t('dp.dpFinSub')}
        action={<span className="text-[10px] text-gray-400">{live ? '● LIVE' : ''}</span>} />
      <div className="p-2">
        <DataTable
          columns={[
            {
              key: 'name', label: t('dp.dpColTournament'),
              render: (r) => {
                const url = eventUrl(r);
                return url ? (
                  <a href={url} target="_blank" rel="noreferrer" title={t('dp.dpOfficialResults', { name: r.name })}
                    className="font-semibold hover:text-amber-600 dark:hover:text-amber-400 hover:underline">{r.name}</a>
                ) : <span className="font-semibold">{r.name}</span>;
              },
            },
            { key: 'system', label: t('dp.dpColSystem') },
            {
              key: 'winner', label: t('dp.dpColWinner'),
              render: (r) => r.winner
                ? <span>🥇 {r.winner} <span className="opacity-60">({r.winnerElo})</span></span>
                : <span className="text-gray-400">—</span>,
            },
            { key: 'date', label: t('dp.dpColDate') },
            {
              key: 'trf', label: 'TRF', sortable: false,
              render: (r) => r.trf
                ? (r.technicalUrl
                  ? <a href={r.technicalUrl} target="_blank" rel="noreferrer" title={t('dp.dpTechReport')}><Badge tone={STATUS_STYLES.finished}>📄 TRF ✓</Badge></a>
                  : <Badge tone={STATUS_STYLES.finished}>📄 TRF ✓</Badge>)
                : <span className="text-gray-400">—</span>,
            },
          ]}
          rows={items}
          emptyText={t('dp.dpFinEmpty')}
        />
      </div>
    </Card>
  );
}
