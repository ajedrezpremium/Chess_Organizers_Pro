import { useState, useEffect, useCallback } from 'react';
import { offlineDB } from '../utils/db';
import { syncQueue } from '../utils/offlineQueue';

export default function SyncStatus() {
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [show, setShow] = useState(false);

  const refresh = useCallback(async () => {
    const count = await offlineDB.queueCount('pending');
    setPending(count);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    const onSync = () => refresh();
    window.addEventListener('sync-complete', onSync);

    // Listen for messages from SW about queued mutations
    const handler = (e) => {
      if (e.data?.type === 'QUEUE_MUTATION') {
        refresh();
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);

    return () => {
      clearInterval(interval);
      window.removeEventListener('sync-complete', onSync);
      navigator.serviceWorker?.removeEventListener('message', handler);
    };
  }, [refresh]);

  const handleSync = async () => {
    setSyncing(true);
    await syncQueue();
    setSyncing(false);
    await refresh();
  };

  if (pending === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShow(!show)}
        className="relative p-2 rounded-lg hover:bg-fide-700 transition-all duration-200"
        title={`${pending} operaciones pendientes de sincronizar`}
      >
        <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
          {pending > 9 ? '9+' : pending}
        </span>
      </button>
      {show && (
        <div className="absolute right-0 mt-2 w-72 bg-fide-800 border border-fide-700 rounded-lg shadow-xl z-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-fide-200">Sincronización</h4>
            <button onClick={() => setShow(false)} className="text-fide-400 hover:text-white text-xs">✕</button>
          </div>
          <p className="text-xs text-fide-400 mb-3">
            {pending} operación(es) pendiente(s) por enviar al servidor.
          </p>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-fide-600 text-white text-xs font-medium py-2 px-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
          >
            {syncing ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Sincronizando...
              </>
            ) : (
              'Sincronizar ahora'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
