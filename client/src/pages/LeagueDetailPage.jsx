import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../components/Toast.jsx';

export default function LeagueDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [league, setLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('standings');
  const [showAddT, setShowAddT] = useState(false);
  const [tournamentId, setTournamentId] = useState('');
  const [tournamentSearch, setTournamentSearch] = useState('');
  const [availTours, setAvailTours] = useState([]);

  const load = async () => {
    try {
      const l = await api.getLeague(id);
      setLeague(l);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const searchTournaments = async (q) => {
    if (q.length < 2) return;
    try { setAvailTours(await api.listTournaments({ q, limit: 10 })); } catch {}
  };

  const addTournament = async (tid) => {
    try {
      await api.addLeagueTournament(id, tid, 1.0);
      toast.success('Torneo añadido'); load(); setShowAddT(false); setTournamentId('');
    } catch (e) { toast.error(e.message); }
  };

  const removeTournament = async (tid) => {
    try { await api.removeLeagueTournament(id, tid); toast.success('Torneo eliminado'); load(); }
    catch (e) { toast.error(e.message); }
  };

  const calculate = async () => {
    try {
      await api.calculateLeagueStandings(id);
      toast.success('Clasificación recalculada'); load();
    } catch (e) { toast.error(e.message); }
  };

  if (loading) return <div className="animate-pulse text-center py-12 text-fide-400">Cargando...</div>;
  if (!league) return <div className="text-center py-12 text-fide-400">Liga no encontrada</div>;

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => navigate('/leagues')} className="text-fide-400 hover:text-white text-sm">&larr; Volver</button>
      </div>

      <div className="bg-fide-800 border border-fide-700/50 rounded-xl p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-white">{league.name}</h1>
            <div className="flex gap-3 mt-1 text-sm text-fide-400">
              {league.federation && <span>{league.federation}</span>}
              {league.season && <span>Temporada {league.season}</span>}
              <span>{league.tournaments?.length || 0} torneos</span>
              <span>{league.participants?.length || 0} jugadores</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${league.status === 'active' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'}`}>{league.status}</span>
            </div>
            {league.description && <p className="text-sm text-fide-400 mt-2">{league.description}</p>}
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-fide-700 mb-4">
        <button onClick={() => setTab('standings')} className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === 'standings' ? 'border-fide-200 text-white' : 'border-transparent text-fide-400'}`}>Clasificación</button>
        <button onClick={() => setTab('tournaments')} className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === 'tournaments' ? 'border-fide-200 text-white' : 'border-transparent text-fide-400'}`}>Torneos ({league.tournaments?.length || 0})</button>
      </div>

      {tab === 'standings' && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={calculate} className="bg-fide-700 hover:bg-fide-600 text-white px-3 py-1.5 rounded text-xs font-medium transition">Recalcular</button>
          </div>
          {(!league.participants || league.participants.length === 0) ? (
            <div className="text-center py-12 text-fide-500">
              <p>Sin datos de clasificación. Añade torneos y recalcula.</p>
            </div>
          ) : (
            <div className="bg-fide-800 border border-fide-700/50 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-fide-900 text-fide-300">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium w-10">#</th>
                    <th className="text-left px-4 py-2 font-medium">Jugador</th>
                    <th className="text-center px-4 py-2 font-medium">Torneos</th>
                    <th className="text-center px-4 py-2 font-medium">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-fide-700">
                  {league.participants.map((p, i) => (
                    <tr key={p.id} className="hover:bg-fide-700/30 text-fide-200">
                      <td className={`px-4 py-2 font-bold ${i < 3 ? 'text-amber-400' : 'text-fide-500'}`}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </td>
                      <td className="px-4 py-2">
                        <span className="font-medium">{p.name} {p.last_name}</span>
                        {p.title && <span className="text-amber-400 text-xs ml-1">{p.title}</span>}
                        {p.fide_rating > 0 && <span className="text-fide-500 text-xs ml-2">({p.fide_rating})</span>}
                      </td>
                      <td className="px-4 py-2 text-center text-fide-400">{p.tournaments_played}</td>
                      <td className="px-4 py-2 text-center font-bold text-lg">{Number(p.total_points).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'tournaments' && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => setShowAddT(!showAddT)} className="bg-fide-700 hover:bg-fide-600 text-white px-3 py-1.5 rounded text-xs font-medium transition">
              {showAddT ? 'Cancelar' : '+ Añadir Torneo'}
            </button>
          </div>

          {showAddT && (
            <div className="bg-fide-800 border border-fide-700 rounded-xl p-4 mb-4 space-y-3">
              <input value={tournamentSearch} onChange={(e) => { setTournamentSearch(e.target.value); searchTournaments(e.target.value); }}
                placeholder="Buscar torneo por nombre..." className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none" />
              {availTours.length > 0 && (
                <div className="border dark:border-fide-600 rounded-lg max-h-40 overflow-y-auto">
                  {availTours.map((t) => (
                    <button key={t.id} onClick={() => addTournament(t.id)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-fide-700 text-fide-200 border-b border-fide-700 last:border-0 transition">
                      {t.name} <span className="text-fide-500 text-xs">({t.status})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {(!league.tournaments || league.tournaments.length === 0) ? (
            <div className="text-center py-12 text-fide-500">
              <p>No hay torneos asignados a esta liga</p>
            </div>
          ) : (
            <div className="space-y-3">
              {league.tournaments.map((lt) => (
                <div key={lt.id} className="bg-fide-800 border border-fide-700/50 rounded-xl px-5 py-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">{lt.name}</div>
                    <div className="text-xs text-fide-500 mt-0.5">
                      Ronda #{lt.round_number} · Peso: {lt.weight}x · {lt.system} · {lt.n_rounds} rondas
                      {lt.start_date && <span> · {lt.start_date}{lt.end_date ? ` — ${lt.end_date}` : ''}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${lt.status === 'finished' ? 'bg-blue-900 text-blue-300' : lt.status === 'active' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'}`}>{lt.status}</span>
                    <button onClick={() => removeTournament(lt.tournament_id)} className="text-red-500 hover:text-red-400 text-xs">Quitar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
