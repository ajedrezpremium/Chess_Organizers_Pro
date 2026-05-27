import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';

export default function RegistrationsTab({ tournamentId }) {
  const { toast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending,pending_payment');
  const [tournament, setTournament] = useState(null);

  const load = async () => {
    try {
      setRequests(await api.listRegistrations(tournamentId, filter));
      api.getTournament(tournamentId).then(setTournament).catch(() => {});
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tournamentId, filter]);

  const handleApprove = async (reqId) => {
    try {
      await api.approveRegistration(tournamentId, reqId);
      toast.success('Jugador inscrito');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const handleReject = async (reqId) => {
    try {
      await api.rejectRegistration(tournamentId, reqId);
      toast.success('Solicitud rechazada');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const parseCustomFields = () => {
    try { return JSON.parse(tournament?.custom_fields || '[]'); } catch { return []; }
  };

  if (loading) return <div className="text-center py-12 text-gray-400 animate-pulse">Cargando solicitudes...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold dark:text-white">Solicitudes de inscripción</h2>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            className="border dark:border-fide-600 rounded px-2 py-1 text-xs bg-white dark:bg-fide-700 dark:text-white outline-none">
            <option value="pending,pending_payment">Pendientes</option>
            <option value="approved">Aprobadas</option>
            <option value="rejected">Rechazadas</option>
            <option value="pending,pending_payment,approved,rejected">Todas</option>
          </select>
          <button onClick={load} className="text-xs text-fide-500 hover:underline">Actualizar</button>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-fide-400">
          <p>No hay solicitudes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const customFields = parseCustomFields();
            let customData = {};
            try { customData = JSON.parse(r.custom_data || '{}'); } catch {}

            return (
              <div key={r.id} className={`bg-white dark:bg-fide-800 border rounded-xl p-4 shadow-sm ${
                r.status === 'pending_payment' ? 'border-yellow-500/50 dark:border-yellow-600/50' :
                r.paid ? 'border-green-500/30 dark:border-green-600/30' :
                'dark:border-fide-700'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium dark:text-white">{r.name} {r.last_name}</span>
                      {r.paid ? (
                        <span className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-[10px] px-1.5 py-0.5 rounded font-medium">Pagado</span>
                      ) : r.status === 'pending_payment' ? (
                        <span className="bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 text-[10px] px-1.5 py-0.5 rounded font-medium">Pago pendiente</span>
                      ) : null}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        r.status === 'approved' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' :
                        r.status === 'rejected' ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' :
                        'bg-gray-100 dark:bg-fide-700 text-gray-600 dark:text-fide-300'
                      }`}>{r.status}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500 dark:text-fide-300">
                      {r.email && <span>{r.email}</span>}
                      {r.fide_id && <span>FIDE: {r.fide_id}</span>}
                      {r.fide_rating > 0 && <span>Rating: {r.fide_rating}</span>}
                      {r.federation && <span>{r.federation}</span>}
                      {r.phone && <span>{r.phone}</span>}
                    </div>
                    {r.notes && <p className="text-xs text-gray-400 dark:text-fide-400 mt-1 italic">{r.notes}</p>}
                    {customFields.length > 0 && Object.keys(customData).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {customFields.map((cf) => customData[cf.key] ? (
                          <span key={cf.key} className="text-[10px] bg-fide-100 dark:bg-fide-700 text-fide-700 dark:text-fide-300 px-1.5 py-0.5 rounded">
                            {cf.label}: {cf.type === 'checkbox' ? (customData[cf.key] ? '✓' : '✗') : customData[cf.key]}
                          </span>
                        ) : null)}
                      </div>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1">{new Date(r.created_at).toLocaleString()}</p>
                  </div>
                  {(r.status === 'pending' || r.status === 'pending_payment') && (
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => handleApprove(r.id)}
                        className="bg-green-700 hover:bg-green-800 text-white px-3 py-1.5 rounded text-xs font-medium transition">Aprobar</button>
                      <button onClick={() => handleReject(r.id)}
                        className="bg-red-700 hover:bg-red-800 text-white px-3 py-1.5 rounded text-xs font-medium transition">Rechazar</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
