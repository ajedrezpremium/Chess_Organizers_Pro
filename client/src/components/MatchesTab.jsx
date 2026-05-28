import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';

export default function MatchesTab({ tournamentId, players, teams: teamsProp }) {
  const { toast } = useToast();
  const [matches, setMatches] = useState([]);
  const [allTeams, setAllTeams] = useState(teamsProp || []);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState({ home_team_id: '', away_team_id: '', round: 1, match_date: '' });

  const load = async () => {
    try {
      const [m, t] = await Promise.all([
        api.listMatches(tournamentId),
        !teamsProp ? api.listTeams(tournamentId) : Promise.resolve(teamsProp),
      ]);
      setMatches(m); setAllTeams(t);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { if (tournamentId) load(); }, [tournamentId]);

  const handleCreate = async () => {
    if (!form.home_team_id || !form.away_team_id) return toast.error('Selecciona ambos equipos');
    try {
      await api.createMatch({ tournament_id: tournamentId, ...form });
      setShowCreate(false); toast.success('Match creado'); load();
    } catch (e) { toast.error(e.message); }
  };

  const handleDelete = async (id) => {
    try { await api.deleteMatch(id); toast.success('Match eliminado'); load(); }
    catch (e) { toast.error(e.message); }
  };

  const handleResult = async (mid, pid, result) => {
    try { await api.updateMatchPairingResult(mid, pid, result); toast.success('Resultado actualizado'); load(); }
    catch (e) { toast.error(e.message); }
  };

  const handleAddPairing = async (matchId) => {
    const home = prompt('ID del jugador local (tournament_player_id):');
    if (!home) return;
    const away = prompt('ID del jugador visitante (tournament_player_id):');
    const board = prompt('Número de tablero:', '1');
    try {
      await api.addMatchPairing(matchId, { home_player_id: parseInt(home), away_player_id: parseInt(away) || null, board: parseInt(board) || 1 });
      toast.success('Pairing añadido'); load();
    } catch (e) { toast.error(e.message); }
  };

  if (loading) return <div className="text-center py-8 text-fide-400 animate-pulse">Cargando matches...</div>;

  return (
    <div className="animate-fadeIn">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-white">Team Matches</h3>
        <button onClick={() => setShowCreate(!showCreate)}
          className="bg-fide-700 hover:bg-fide-600 text-white px-3 py-1.5 rounded text-xs font-medium transition">
          {showCreate ? 'Cancelar' : '+ Nuevo Match'}
        </button>
      </div>

      {showCreate && (
        <div className="bg-fide-800 border border-fide-700 rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select value={form.home_team_id} onChange={(e) => setForm({ ...form, home_team_id: e.target.value })}
              className="border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none">
              <option value="">Equipo local</option>
              {allTeams?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select value={form.away_team_id} onChange={(e) => setForm({ ...form, away_team_id: e.target.value })}
              className="border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none">
              <option value="">Equipo visitante</option>
              {allTeams?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" value={form.round} onChange={(e) => setForm({ ...form, round: parseInt(e.target.value) || 1 })}
              placeholder="Ronda" className="border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none" />
            <input type="date" value={form.match_date} onChange={(e) => setForm({ ...form, match_date: e.target.value })}
              className="border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none" />
          </div>
          <button onClick={handleCreate} className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition">Crear Match</button>
        </div>
      )}

      {matches.length === 0 ? (
        <div className="text-center py-12 text-fide-500">
          <p>No hay matches creados. Crea equipos primero.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => {
            const isExpanded = expanded === m.id;
            return (
              <div key={m.id} className="bg-fide-800 border border-fide-700/50 rounded-xl overflow-hidden">
                <button onClick={() => { setExpanded(isExpanded ? null : m.id); if (!isExpanded) api.getMatch(m.id).then((d) => setMatches(matches.map((x) => x.id === m.id ? d : x))); }}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-fide-700/30 transition">
                  <div className="text-left">
                    <div className="font-medium text-white flex items-center gap-2">
                      <span>{m.home_name}</span>
                      <span className="text-fide-500 text-xs">vs</span>
                      <span>{m.away_name}</span>
                    </div>
                    <div className="text-xs text-fide-500 mt-0.5">
                      Ronda {m.round} · {m.match_date || 'Sin fecha'}
                      {m.status && <span> · <span className={`${m.status === 'finished' ? 'text-blue-400' : 'text-green-400'}`}>{m.status}</span></span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-lg font-bold text-fide-200">{m.home_score ?? 0} — {m.away_score ?? 0}</div>
                    </div>
                    <svg className={`w-4 h-4 text-fide-500 transition ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-fide-700/50 px-5 py-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-fide-500">Tableros</span>
                      <button onClick={() => handleAddPairing(m.id)} className="text-xs text-fide-400 hover:text-white">+ Añadir tablero</button>
                    </div>
                    {(m.pairings && m.pairings.length > 0) ? (
                      <div className="space-y-1.5">
                        {m.pairings.map((p) => (
                          <div key={p.id} className="flex items-center justify-between bg-fide-700/30 rounded-lg px-3 py-2 text-sm">
                            <div className="flex items-center gap-2 w-1/3">
                              <span className="text-fide-500 text-xs">#{p.board}</span>
                              <span className="text-fide-200">{p.home_player_name || '—'} {p.home_player_last || ''}</span>
                              {p.home_rating > 0 && <span className="text-fide-500 text-xs">({p.home_rating})</span>}
                            </div>
                            <div className="flex items-center gap-1">
                              <select value={p.result} onChange={(e) => handleResult(m.id, p.id, e.target.value)}
                                className="border dark:border-fide-600 rounded px-2 py-1 text-xs font-mono bg-white dark:bg-fide-700 text-white outline-none">
                                <option value="-">-</option><option value="1">1-0</option><option value="0">0-1</option><option value="=">½-½</option><option value="U">BYE</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-2 w-1/3 justify-end">
                              <span className="text-fide-200">{p.away_player_name || '—'} {p.away_player_last || ''}</span>
                              {p.away_rating > 0 && <span className="text-fide-500 text-xs">({p.away_rating})</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-fide-500 text-center py-3">Sin tableros asignados</p>
                    )}
                    <div className="flex justify-end mt-2">
                      <button onClick={() => handleDelete(m.id)} className="text-red-500 hover:text-red-400 text-xs">Eliminar match</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
