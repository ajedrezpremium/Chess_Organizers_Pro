import TournamentCard from './TournamentCard.jsx';
import SectionHeader from './SectionHeader.jsx';

const DEMO_TOURNAMENTS = [
  {
    id: 'demo-league',
    name: '🏆 Liga Demo - División de Honor',
    system: 'roundrobin',
    n_rounds: 14,
    city: 'Madrid',
    federation: 'FEDA',
    start_date: '2026-01-15',
    end_date: '2026-05-30',
    time_control: '90+30',
    status: 'active',
    primary_color: '#8b5cf6',
    secondary_color: '#1f2937',
    description: 'Liga por equipos preconfigurada - Sistema Round Robin (Berger). 8 equipos, todos contra todos a doble vuelta. Ideal para aprender a gestionar ligas.',
    is_demo: true,
    player_count: 32,
  },
  {
    id: 'demo-online',
    name: '🌐 Torneo Online Demo - Arena Rápida',
    system: 'dutch',
    n_rounds: 9,
    city: 'Online (Chess.com/Lichess)',
    federation: 'FIDE',
    start_date: '2026-07-01',
    end_date: '2026-07-01',
    time_control: '15+10',
    status: 'pending',
    primary_color: '#06b6d4',
    secondary_color: '#1f2937',
    description: 'Torneo online preconfigurado - Sistema Suizo 9 rondas. Integración lista para Chess.com/Lichess. Perfecto para torneos semanales de club.',
    is_demo: true,
    player_count: 50,
  },
  {
    id: 'demo-presencial',
    name: '🏟️ Torneo Presencial Demo - Open Ciudad',
    system: 'dutch',
    n_rounds: 7,
    city: 'Madrid',
    federation: 'FIDE',
    start_date: '2026-08-15',
    end_date: '2026-08-17',
    time_control: '60+30',
    status: 'pending',
    primary_color: '#f97316',
    secondary_color: '#1f2937',
    description: 'Open presencial preconfigurado - Sistema Suizo 7 rondas. Incluye check-in por QR, emparejamientos automáticos, wallboard TV y homologación FIDE.',
    is_demo: true,
    player_count: 120,
  },
];

export default function DemoTournamentsPanel({ onOpen }) {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Torneos Demo Preconfigurados"
        subtitle="3 modalidades listas para usar: Liga, Online, Presencial"
        count={3}
        icon="🎯"
        linkTo="/app/new"
        linkText="Crear mi torneo"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {DEMO_TOURNAMENTS.map((tournament) => (
          <TournamentCard
            key={tournament.id}
            tournament={tournament}
            variant="demo"
            onClick={() => onOpen?.(tournament)}
          />
        ))}
      </div>
    </div>
  );
}