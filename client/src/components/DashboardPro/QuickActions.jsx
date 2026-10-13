import { Link } from 'react-router-dom';
import { Card, CardHeader } from '../../design-system/ui.jsx';
import { useI18n } from '../../i18n/context.jsx';

const ACTIONS = [
  { to: '/app/new', icon: '➕', labelKey: 'dp.dpQaNew' },
  { to: '/app/scan', icon: '📸', labelKey: 'dp.dpQaScan' },
  { to: '/app/search', icon: '🔍', labelKey: 'dp.dpQaSearch' },
  { to: '/app/directory', icon: '🏢', labelKey: 'dp.dpQaDirectory' },
  { to: '/app/elo', icon: '📈', labelKey: 'dp.dpQaElo' },
  { to: '/app/leagues', icon: '🏆', labelKey: 'dp.dpQaLeagues' },
];

export default function QuickActions() {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader title={t('dp.dpQuickTitle')} />
      <div className="p-3 grid grid-cols-3 gap-2">
        {ACTIONS.map((a) => (
          <Link key={a.to} to={a.to} className="flex flex-col items-center gap-1 p-3 rounded-xl border border-gray-100 dark:border-fide-700 hover:border-amber-400 hover:shadow-sm transition text-center">
            <span className="text-xl">{a.icon}</span>
            <span className="text-[10px] font-semibold dark:text-fide-200">{t(a.labelKey)}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
