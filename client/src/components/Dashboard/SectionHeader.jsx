import { Link } from 'react-router-dom';

export default function SectionHeader({
  title,
  subtitle,
  count,
  icon,
  linkTo,
  linkText = 'Ver todos',
  onClick,
}) {
  const hasLink = linkTo || onClick;

  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
      <div className="flex items-center gap-3">
        {icon && <span className="text-2xl">{icon}</span>}
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 dark:text-fide-400">{subtitle}</p>}
        </div>
        {count !== undefined && count !== null && (
          <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full">
            {count}
          </span>
        )}
      </div>
      {hasLink && (
        <div className="shrink-0">
          <Link
            to={linkTo}
            onClick={onClick}
            className="text-sm font-medium text-fide-600 dark:text-fide-300 hover:underline flex items-center gap-1"
          >
            {linkText}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
}