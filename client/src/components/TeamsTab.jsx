import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';

export default function TeamsTab({ tournamentId, players }) {
  const { toast } = useToast();
  const [teams, setTeams] = useState([]);
  const [standings, setStandings] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('teams');

  const load = async () => {
    try {
      const [t, s] = await Promise.all([
        api.listTeams(tournamentId),
        api.teamStandings(tournamentId),
      ]);
      setTeams(t); setStandings(s);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tournamentId]);

  const handleCreate = async () => {
    if (!teamName.trim()) return;
    try {
      await api.createTeam(tournamentId, { name: teamName });
      setTeamName(''); setShowCreate(false);
      toast.success('Equipo creado');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const handleDelete = async (id) => {
    try { await api.deleteTeam(id); toast.success('Equipo eliminado'); load(); }
    catch (e) { toast.error(e.message); }
  };

  const handleAddMember = async (teamId, playerId) => {
    try {
      await api.addTeamMember(teamId, { tournament_player_id: playerId, board_number: 1 });
      toast.success('Jugador añadido al equipo');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const handleRemoveMember = async (id) => {
    try { await api.removeTeamMember(id); load(); }
    catch (e) { toast.error(e.message); }
  };

  const unassignedPlayers = players.filter((p) =>
    !teams.some((t) => t.members.some((m) => m.tournament_player_id === p.id))
  );

  if (loading) return <div className="text-center py-12 text-gray-400 animate-pulse">Cargando equipos...</div>;

  return (
    <div className="animate-fadeIn">
      <div className="flex gap-1 border-b dark:border-fide-700 mb-4">
        <button onClick={() => setTab('teams')} className={`px-3 py-2 text-sm font-medium border-b-2 transition ${tab === 'teams' ? 'border-fide-700 text-fide-700 dark:text-fide-200 dark:border-fide-200' : 'border-transparent text-gray-500'}`}>Equipos ({teams.length})</button>
        <button onClick={() => setTab('standings')} className={`px-3 py-2 text-sm font-medium border-b-2 transition ${tab === 'standings' ? 'border-fide-700 text-fide-700 dark:text-fide-200 dark:border-fide-200' : 'border-transparent text-gray-500'}`}>Clasificación</button>
      </div>

      {tab === 'teams' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold dark:text-white">Equipos</h3>
            <button onClick={() => setShowCreate(!showCreate)}
              className="bg-fide-700 hover:bg-fide-800 text-white px-3 py-1.5 rounded text-xs font-medium transition">
              {showCreate ? 'Cancelar' : '+ Nuevo Equipo'}
            </button>
          </div>

          {showCreate && (
            <div className="flex gap-2 mb-4">
              <input value={teamName} onChange={(e) => setTeamName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="Nombre del equipo"
                className="flex-1 border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none focus:ring-2 focus:ring-fide-500" />
              <button onClick={handleCreate}
                className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition">Crear</button>
            </div>
          )}

          {teams.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-fide-400">
              <p>No hay equipos creados</p>
            </div>
          ) : (
            <div className="space-y-4">
              {teams.map((team) => (
                <div key={team.id} className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold dark:text-white flex items-center gap-2">
                      {team.name}
                      <span className="text-xs text-gray-400 dark:text-fide-400 font-mono">[{team.short_name}]</span>
                      <span className="text-xs text-gray-400">({team.members.length} jug)</span>
                    </h4>
                    <button onClick={() => handleDelete(team.id)} className="text-red-500 hover:text-red-700 text-xs">Eliminar</button>
                  </div>

                  {team.members.length > 0 ? (
                    <div className="space-y-1.5">
                      {team.members.map((m) => (
                        <div key={m.id} className="flex items-center justify-between bg-gray-50 dark:bg-fide-700 rounded-lg px-3 py-1.5 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-xs w-4">#{m.board_number}</span>
                            <span className="font-medium dark:text-fide-200">{m.name} {m.last_name}</span>
                            <span className="text-xs text-gray-400">({m.fide_rating || '-'})</span>
                          </div>
                          <button onClick={() => handleRemoveMember(m.id)} className="text-red-400 hover:text-red-600 text-xs">Quitar</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-2">Sin jugadores</p>
                  )}

                  {unassignedPlayers.length > 0 && (
                    <div className="mt-3 pt-3 border-t dark:border-fide-700">
                      <select onChange={(e) => { if (e.target.value) handleAddMember(team.id, parseInt(e.target.value)); e.target.value = ''; }}
                        className="w-full border dark:border-fide-600 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-fide-700 dark:text-white outline-none">
                        <option value="">+ Añadir jugador...</option>
                        {unassignedPlayers.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} {p.last_name} ({p.fide_rating || '-'})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'standings' && (
        <div>
          {standings.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-fide-400">
              <p>Sin datos de clasificación por equipos</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-fide-900 text-gray-600 dark:text-fide-300">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium w-10">#</th>
                    <th className="text-left px-4 py-2 font-medium">Equipo</th>
                    <th className="text-center px-4 py-2 font-medium">Jug</th>
                    <th className="text-center px-4 py-2 font-medium">Elo Prom</th>
                    <th className="text-center px-4 py-2 font-medium w-20">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-fide-700">
                  {standings.map((s) => (
                    <tr key={s.id} className={`hover:bg-gray-50 dark:hover:bg-fide-700 dark:text-fide-200 ${s.position <= 3 ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
                      <td className={`px-4 py-2 font-bold ${s.position <= 3 ? 'text-amber-600' : 'text-gray-500'}`}>
                        {s.position === 1 ? '🥇' : s.position === 2 ? '🥈' : s.position === 3 ? '🥉' : s.position}
                      </td>
                      <td className="px-4 py-2 font-medium">{s.name}</td>
                      <td className="px-4 py-2 text-center text-gray-500">{s.playerCount}</td>
                      <td className="px-4 py-2 text-center text-gray-500">{s.avgRating || '-'}</td>
                      <td className="px-4 py-2 text-center font-bold text-lg">{s.totalPoints.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
