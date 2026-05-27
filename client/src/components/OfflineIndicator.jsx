import { useState, useEffect } from 'react';
import { offlineDB } from '../utils/db';

export default function OfflineIndicator() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [cachedPages, setCachedPages] = useState(0);

  useEffect(() => {
    const updateCached = async () => {
      const keys = await offlineDB.cacheKeys();
      setCachedPages(keys.length);
    };
    if (!navigator.onLine) updateCached();

    const on = () => setOffline(false);
    const off = () => {
      setOffline(true);
      updateCached();
    };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <div className="flex items-center gap-2 bg-yellow-900/90 text-yellow-200 text-xs px-3 py-2 rounded-lg shadow-lg border border-yellow-700/50 backdrop-blur-sm">
        <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
        <div className="flex flex-col">
          <span className="font-medium">Sin conexión</span>
          {cachedPages > 0 && (
            <span className="text-yellow-300/70">{cachedPages} página(s) en caché</span>
          )}
        </div>
      </div>
    </div>
  );
}
