import { Link } from 'react-router-dom';
import { Card, CardHeader } from '../../design-system/ui.jsx';

const ACTIONS = [
  { to: '/app/new', icon: '➕', label: 'Nuevo torneo' },
  { to: '/app/scan', icon: '📸', label: 'Escáner IA' },
  { to: '/app/search', icon: '🔍', label: 'Buscar torneos' },
  { to: '/app/directory', icon: '🏢', label: 'Directorio' },
  { to: '/app/elo', icon: '📈', label: 'Dashboard Elo' },
  { to: '/app/leagues', icon: '🏆', label: 'Ligas' },
];

export default function QuickActions() {
  return (
    <Card>
      <CardHeader title="⚡ Accesos rápidos" />
      <div className="p-3 grid grid-cols-3 gap-2">
        {ACTIONS.map((a) => (
          <Link key={a.to} to={a.to} className="flex flex-col items-center gap-1 p-3 rounded-xl border border-gray-100 dark:border-fide-700 hover:border-amber-400 hover:shadow-sm transition text-center">
            <span className="text-xl">{a.icon}</span>
            <span className="text-[10px] font-semibold dark:text-fide-200">{a.label}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
