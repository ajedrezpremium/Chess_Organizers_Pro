import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../components/Toast.jsx';
import { useI18n } from '../i18n/context.jsx';

export default function LeaguesPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', federation: '', season: '' });

  const load = async () => {
    try { setLeagues(await api.listLeagues()); } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    try {
      await api.createLeague(form);
      setShowCreate(false); setForm({ name: '', description: '', federation: '', season: '' });
      toast.success('Liga creada'); load();
    } catch (e) { toast.error(e.message); }
  };

  const handleDelete = async (id) => {
    try { await api.deleteLeague(id); toast.success('Liga eliminada'); load(); }
    catch (e) { toast.error(e.message); }
  };

  if (loading) return <div className="animate-pulse text-center py-12 text-fide-400">Cargando ligas...</div>;

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Ligas / Circuitos</h1>
        <button onClick={() => setShowCreate(!showCreate)}
          className="bg-fide-700 hover:bg-fide-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          {showCreate ? 'Cancelar' : '+ Nueva Liga'}
        </button>
      </div>

      {showCreate && (
        <div className="bg-fide-800 border border-fide-700 rounded-xl p-5 space-y-3">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nombre de la liga *" className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none focus:ring-2 focus:ring-fide-500" />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Descripción" className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none" rows={2} />
          <div className="grid grid-cols-2 gap-3">
            <input value={form.federation} onChange={(e) => setForm({ ...form, federation: e.target.value })}
              placeholder="Federación" className="border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none" />
            <input value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })}
              placeholder="Temporada (ej. 2026)" className="border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none" />
          </div>
          <button onClick={handleCreate} className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition">Crear Liga</button>
        </div>
      )}

      {leagues.length === 0 ? (
        <div className="text-center py-20 text-fide-500">
          <p className="text-5xl mb-4">🏆</p>
          <p className="text-lg font-medium text-white mb-2">No hay ligas creadas</p>
          <p className="text-sm">Crea tu primera liga para agrupar torneos</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {leagues.map((l) => (
            <div key={l.id} className="bg-fide-800 border border-fide-700/50 rounded-xl p-5 hover:border-fide-600 transition cursor-pointer"
              onClick={() => navigate(`/leagues/${l.id}`)}>
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-white text-lg">{l.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${l.status === 'active' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'}`}>{l.status}</span>
              </div>
              {l.description && <p className="text-sm text-fide-400 mb-3 line-clamp-2">{l.description}</p>}
              <div className="flex gap-4 text-xs text-fide-500">
                <span>{l.tournament_count || 0} torneos</span>
                <span>{l.participant_count || 0} jugadores</span>
                {l.season && <span>{l.season}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
