import { Card, CardHeader, Badge } from '../../design-system/ui.jsx';
import { STATUS_STYLES } from '../../design-system/tokens.js';
import { sourceName } from '../../data/chessSources.js';
import { useI18n } from '../../i18n/context.jsx';

// Tarjeta clicable: el título y "Seguir ▶" abren la retransmisión en directo,
// 🌐 Website la web oficial del evento y 📊 Standings el enlace técnico
// (normalmente Chess-Results). Si no hay URLs (datos de ejemplo), no se enlaza.
function watchUrl(t) {
  return t.broadcastUrl || t.officialUrl || '';
}

export default function LiveBar({ items = [], live = false }) {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader title={t('dp.dpLiveTitle')} subtitle={t('dp.dpLiveSub')}
        action={<span className={`text-[10px] font-bold ${live ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>{live ? t('dp.dpLiveBadge') : t('dp.dpDemoBadge')}</span>} />
      <div className="p-4 grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {items.map((t) => {
          const watch = watchUrl(t);
          return (
            <div key={t.id} className="border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                {watch ? (
                  <a href={watch} target="_blank" rel="noreferrer" title={t('dp.dpWatchTitle', { name: t.name })}
                    className="font-bold text-xs dark:text-white truncate hover:text-red-600 dark:hover:text-red-400 hover:underline">{t.name}</a>
                ) : (
                  <h4 className="font-bold text-xs dark:text-white truncate">{t.name}</h4>
                )}
              </div>
              <p className="text-[11px] text-gray-500 dark:text-fide-400">📍 {t.city} · {t.round} · {t.system}</p>
              {t.board1 && <p className="text-[11px] mt-1 dark:text-fide-200 truncate">♟ {t.board1}</p>}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <Badge tone={STATUS_STYLES.live}>{t('dp.dpLiveNowBadge')}</Badge>
                <span className="text-[10px] text-gray-400">{sourceName(t.source)}</span>
                <span className="ml-auto flex items-center gap-2">
                  {t.officialUrl && (
                    <a href={t.officialUrl} target="_blank" rel="noreferrer" title={t('dp.dpWebTitle')}
                      className="text-[11px] font-semibold text-fide-600 dark:text-fide-300 hover:underline">{t('dp.dpWebsite')}</a>
                  )}
                  {t.technicalUrl && (
                    <a href={t.technicalUrl} target="_blank" rel="noreferrer" title={t('dp.dpTechTitle')}
                      className="text-[11px] font-semibold text-fide-600 dark:text-fide-300 hover:underline">{t('dp.dpStandings')}</a>
                  )}
                  {watch && (
                    <a href={watch} target="_blank" rel="noreferrer" title={t('dp.dpFollowTitle')}
                      className="text-[11px] font-semibold text-red-600 dark:text-red-400 hover:underline">{t('dp.dpFollow')}</a>
                  )}
                </span>
              </div>
            </div>
          );
        })}
        {items.length === 0 && <p className="text-xs text-gray-400 col-span-full text-center py-4">{t('dp.dpLiveEmpty')}</p>}
      </div>
    </Card>
  );
}
