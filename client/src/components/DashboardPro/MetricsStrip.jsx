import { Stat } from '../../design-system/ui.jsx';

export default function MetricsStrip({ tournaments = [], alerts = 0 }) {
  const active = tournaments.filter((t) => t.status === 'active').length;
  const players = tournaments.reduce((s, t) => s + (t.player_count || t.players || 0), 0);
  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat value={tournaments.length} label="Mis torneos" />
      <Stat value={active} label="Activos ahora" accent />
      <Stat value={players.toLocaleString()} label="Jugadores totales" />
      <Stat value={alerts} label="Alertas pendientes" accent={alerts > 0} />
    </div>
  );
}
