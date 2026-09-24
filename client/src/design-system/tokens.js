// Design tokens V2 — "Pro, moderno, digital, elegante"
export const COLORS = {
  navy: '#0B1D3A',
  navy2: '#1A3C6E',
  accent: '#F59E0B',
  accentDark: '#D97706',
};

// Estilos por nivel (avisos FIDE + notificaciones). L1 info → L4 crítico.
export const LEVEL_STYLES = {
  1: { badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300', bar: 'border-gray-300 dark:border-gray-700' },
  2: { badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300', bar: 'border-sky-300 dark:border-sky-700' },
  3: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', bar: 'border-amber-300 dark:border-amber-700' },
  4: { badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', bar: 'border-red-400 dark:border-red-700' },
};

export const LEVEL_TAG = { 1: 'L1 · INFO', 2: 'L2 · AVISO', 3: 'L3 · ALERTA', 4: 'L4 · CRÍTICO' };

// Estados de torneo
export const STATUS_STYLES = {
  live: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-300 dark:border-red-700',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  upcoming: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  finished: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-red-200 dark:border-red-800',
  demo: 'bg-fide-100 text-fide-700 dark:bg-fide-900/50 dark:text-fide-300 border-fide-200 dark:border-fide-800',
};

export const NOTIF_TYPE_META = {
  urgent: { level: 4, label: 'Urgente', icon: '🚨' },
  pending: { level: 3, label: 'Pendiente', icon: '⏳' },
  system: { level: 2, label: 'Sistema', icon: '⚙️' },
  billing: { level: 2, label: 'Facturación', icon: '💎' },
  social: { level: 1, label: 'Social', icon: '👥' },
};
