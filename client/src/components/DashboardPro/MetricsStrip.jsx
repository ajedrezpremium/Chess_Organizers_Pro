import { Stat } from '../../design-system/ui.jsx';
import { useI18n } from '../../i18n/context.jsx';

export default function MetricsStrip({ tournaments = [], alerts = 0 }) {
  const { t } = useI18n();
  const active = tournaments.filter((t) => t.status === 'active').length;
  const players = tournaments.reduce((s, t) => s + (t.player_count || t.players || 0), 0);
  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat value={tournaments.length} label={t('dp.dpStatMine')} />
      <Stat value={active} label={t('dp.dpStatActive')} accent />
      <Stat value={players.toLocaleString()} label={t('dp.dpStatPlayers')} />
      <Stat value={alerts} label={t('dp.dpStatAlerts')} accent={alerts > 0} />
    </div>
  );
}
