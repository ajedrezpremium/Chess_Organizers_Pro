import { Link } from 'react-router-dom';
import { Card, Avatar, Badge } from '../../design-system/ui.jsx';
import { STATUS_STYLES } from '../../design-system/tokens.js';
import { useI18n } from '../../i18n/context.jsx';

export default function ProfileCard({ user, stats }) {
  const { t } = useI18n();
  const name = user?.name || t('dp.dpProFallback');
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <Avatar name={name} size="lg" />
        <div className="min-w-0">
          <h3 className="font-bold text-sm dark:text-white truncate">{name}</h3>
          <p className="text-[11px] text-gray-500 dark:text-fide-400 truncate">{user?.email || t('dp.dpVerifiedAccount')}</p>
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {user?.fide_id ? (
              <a href={`https://ratings.fide.com/profile/${user.fide_id}`} target="_blank" rel="noreferrer" title="Perfil FIDE">
                <Badge tone={STATUS_STYLES.active}>♟ FIDE {user.fide_id}</Badge>
              </a>
            ) : (user?.verified ? <Badge tone={STATUS_STYLES.active}>{t('dp.dpFideVerified')}</Badge> : null)}
            {user?.federation ? (
              <Badge tone="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800">{user.federation}</Badge>
            ) : null}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <div className="bg-gray-50 dark:bg-fide-900 rounded-xl p-2">
          <div className="font-extrabold text-sm dark:text-white">{stats?.tournaments ?? '—'}</div>
          <div className="text-[10px] text-gray-500 dark:text-fide-400">{t('dp.dpTournaments')}</div>
        </div>
        <div className="bg-gray-50 dark:bg-fide-900 rounded-xl p-2">
          <div className="font-extrabold text-sm dark:text-white">{stats?.players ?? '—'}</div>
          <div className="text-[10px] text-gray-500 dark:text-fide-400">{t('dp.dpPlayers')}</div>
        </div>
        <div className="bg-gray-50 dark:bg-fide-900 rounded-xl p-2">
          <div className="font-extrabold text-sm text-amber-500">{stats?.finished ?? '—'}</div>
          <div className="text-[10px] text-gray-500 dark:text-fide-400">{t('dp.dpFinishedN')}</div>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <Link to="/app/player" className="flex-1 text-center text-xs font-semibold border border-gray-200 dark:border-fide-700 rounded-xl px-3 py-2 hover:border-amber-400 dark:text-fide-200 transition">{t('dp.dpProfileHistory')}</Link>
        <Link to="/pricing" className="flex-1 text-center text-xs font-bold bg-amber-500 hover:bg-amber-600 text-fide-900 rounded-xl px-3 py-2 transition">{t('dp.dpPlanPro')}</Link>
      </div>
    </Card>
  );
}
