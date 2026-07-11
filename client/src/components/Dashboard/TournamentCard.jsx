import { Link } from 'react-router-dom';

const STATUS_STYLES = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  finished: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-red-200 dark:border-red-800',
  demo: 'bg-fide-100 text-fide-700 dark:bg-fide-900/50 dark:text-fide-300 border-fide-200 dark:border-fide-800',
};

const STATUS_LABELS = {
  active: 'Activo',
  finished: 'Finalizado',
  pending: 'Pendiente',
  cancelled: 'Cancelado',
  demo: 'Demo',
};

export default function TournamentCard({
  tournament,
  variant = 'default', // 'default' | 'compact' | 'feed' | 'demo' | 'skeleton'
  onClick,
  showSource = false,
  className = '',
}) {
  if (variant === 'skeleton') {
    return (
      <div className="bg-white dark:bg-fide-800 border border-gray-200 dark:border-fide-700/50 rounded-xl p-4 animate-pulse">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-fide-700" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 bg-gray-200 dark:bg-fide-700 rounded" />
            <div className="h-3 w-1/2 bg-gray-200 dark:bg-fide-700 rounded" />
            <div className="flex gap-2">
              <div className="h-5 w-16 bg-gray-200 dark:bg-fide-700 rounded-full" />
              <div className="h-5 w-16 bg-gray-200 dark:bg-fide-700 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }
  const status = tournament.is_demo ? 'demo' : (tournament.status || 'pending');
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.pending;
  const statusLabel = STATUS_LABELS[status] || status;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const baseClasses = 'group bg-white dark:bg-fide-800 border border-gray-200 dark:border-fide-700/50 rounded-xl shadow-sm hover:shadow-md transition-all duration-200';
  const variantClasses = {
    default: 'p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4',
    compact: 'p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3',
    feed: 'p-4 hover:border-fide-300 dark:hover:border-fide-600',
    demo: 'p-4 border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20',
  };

  const isFeed = variant === 'feed';
  const isDemo = tournament.is_demo;

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-3">
          {tournament.logo_url && (
            <img
              src={tournament.logo_url}
              alt=""
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to={tournament.source_url || `/public/tournament/${tournament.id}`}
                className="font-semibold text-lg text-gray-900 dark:text-white hover:text-fide-600 dark:hover:text-fide-300 transition-colors truncate"
                onClick={(e) => e.stopPropagation()}
              >
                {tournament.name}
              </Link>
              <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusStyle}`}>
                {statusLabel}
              </span>
              {isDemo && (
                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  DEMO
                </span>
              )}
              {showSource && tournament.source && tournament.source !== 'internal' && (
                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                  {tournament.source}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm text-gray-500 dark:text-fide-400">
              <span>{tournament.system === 'dutch' ? 'Suizo' : tournament.system === 'roundrobin' ? 'Round Robin' : tournament.system}</span>
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                {tournament.n_rounds} rondas
              </span>
              {tournament.federation && <span>{tournament.federation}</span>}
              {tournament.city && <span>{tournament.city}</span>}
              {tournament.start_date && <span className="text-xs text-gray-500 dark:text-fide-400">{formatDate(tournament.start_date)}</span>}
            </div>
            {tournament.description && !isFeed && (
              <p className="mt-2 text-sm text-gray-500 dark:text-fide-400 line-clamp-2">{tournament.description}</p>
            )}
          </div>
        </div>
      </div>

      {!isFeed && (
        <div className="flex gap-2 shrink-0">
          {tournament.source_url && tournament.source !== 'internal' && (
            <a
              href={tournament.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-fide-700 text-gray-700 dark:text-fide-200 hover:bg-gray-200 dark:hover:bg-fide-600 transition"
              onClick={(e) => e.stopPropagation()}
            >
              Ver origen
            </a>
          )}
          {tournament.source === 'internal' && (
            <Link
              to={`/app/tournament/${tournament.id}`}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-fide-50 text-fide-700 hover:bg-fide-100 dark:bg-fide-700 dark:text-fide-200 dark:hover:bg-fide-600 transition"
              onClick={(e) => e.stopPropagation()}
            >
              Abrir
            </Link>
          )}
        </div>
      )}
    </div>
  );
}