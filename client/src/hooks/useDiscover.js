import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { LIVE_SEED, UPCOMING_SEED, FINISHED_SEED } from '../data/chessSources.js';

// Agregador Discover: intenta backend (/discover) y cae a seeds locales.
export function useDiscover() {
  const [data, setData] = useState({ live: LIVE_SEED, upcoming: UPCOMING_SEED, finished: FINISHED_SEED });
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState('local');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const fn = api.discover || api.getDiscover;
        if (typeof fn === 'function') {
          const d = await fn();
          if (alive && d && (d.live || d.upcoming || d.finished)) {
            setData({
              live: d.live?.length ? d.live : LIVE_SEED,
              upcoming: d.upcoming?.length ? d.upcoming : UPCOMING_SEED,
              finished: d.finished?.length ? d.finished : FINISHED_SEED,
            });
            setSource('api');
          }
        }
      } catch { /* fallback local */ }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  return { ...data, loading, source };
}
