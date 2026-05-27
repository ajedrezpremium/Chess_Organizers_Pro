import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/context.jsx';
import OfflineIndicator from '../components/OfflineIndicator.jsx';

export default function ArbiterPanel() {
  const { id } = useParams();
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [roundIdx, setRoundIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try { setData(await api.arbiter.getTournament(id)); } catch (e) { setError(e.message || t('arbiter.error')); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (id) load(); }, [id]);

  const handleResult = async (rid, pairingId, result) => {
    try {
      await api.arbiter.setResult(rid, pairingId, result);
      await load();
    } catch (e) { alert(e.message || t('arbiter.resultError')); }
  };

  const handleCheckIn = async (tpId) => {
    try { await api.arbiter.checkIn(tpId); await load(); } catch (e) { alert(e.message || t('arbiter.resultError')); }
  };

  if (error) return (
    <div className="min-h-screen bg-gray-950 text-white p-4 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">⚖️</div>
        <p className="text-red-400 mb-4">{error}</p>
        <Link to="/" className="text-amber-500 hover:underline text-sm">{t('arbiter.dashboard')}</Link>
      </div>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full" />
    </div>
  );

  if (!data) return null;

  const { tournament, rounds, players } = data;
  const round = rounds[roundIdx];
  const checkedIn = players.filter((p) => p.checked_in).length;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <Link to="/arbiter" className="text-amber-500 text-xs hover:underline">{t('arbiter.backToTournaments')}</Link>
            <h1 className="text-base font-bold mt-0.5 truncate max-w-[220px]">{tournament.name}</h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>{t('arbiter.checkIn', { n: checkedIn, total: players.length })}</span>
          </div>
        </div>
      </header>

      <div className="px-4 py-2 bg-gray-900/50 border-b border-gray-800 flex gap-1 overflow-x-auto">
        {players.map((p) => (
          <button key={p.id} onClick={() => !p.checked_in && handleCheckIn(p.id)}
            className={`w-7 h-7 rounded-full text-[10px] font-bold shrink-0 transition flex items-center justify-center ${p.checked_in ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}
            title={`${p.name} ${p.last_name || ''}`}>
            {p.checked_in ? '✓' : p.seed_rank}
          </button>
        ))}
      </div>

      <div className="flex gap-1 px-4 py-3 overflow-x-auto border-b border-gray-800">
        {rounds.map((r, i) => (
          <button key={r.id} onClick={() => setRoundIdx(i)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${roundIdx === i ? 'bg-amber-600 text-black' : 'bg-gray-800 text-gray-400'}`}>
            R{r.round_number}
            <span className={`ml-1.5 w-1.5 h-1.5 inline-block rounded-full ${r.status === 'closed' ? 'bg-blue-500' : r.status === 'generated' || r.status === 'published' ? 'bg-green-500' : 'bg-gray-600'}`} />
          </button>
        ))}
      </div>

      <div className="px-4 py-4 space-y-2 pb-24">
        {(!round || !round.pairings || round.pairings.length === 0) ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-3xl mb-2">♟</p>
            <p className="text-sm">{t('arbiter.noPairings')}</p>
          </div>
        ) : (
          round.pairings.map((p) => {
            const isOpen = round.status === 'generated' || round.status === 'published';
            return (
              <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-gray-500 font-medium uppercase">{t('pairings.board')} {p.board}</span>
                  {isOpen && p.result === '-' && (
                    <span className="text-[10px] text-green-500 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      {t('arbiter.pending')}
                    </span>
                  )}
                  {p.result !== '-' && (
                    <span className={`text-[10px] font-medium ${p.result === '1' ? 'text-green-400' : p.result === '0' ? 'text-red-400' : 'text-amber-400'}`}>{t('arbiter.registered')}</span>
                  )}
                </div>

                <div className="flex items-center gap-3 mb-2">
                  <span className="w-6 h-6 rounded-full bg-amber-900/50 text-amber-400 text-[10px] font-bold flex items-center justify-center shrink-0">{t('pairings.white').charAt(0)}</span>
                  <span className="font-medium text-sm flex-1 truncate">{p.white_name}{p.white_last ? ` ${p.white_last}` : ''}</span>
                </div>

                {isOpen ? (
                  <div className="flex justify-center gap-1 my-2">
                    {['1', '=', '0', 'U', 'F', 'H', 'Z'].map((r) => (
                      <button key={r} onClick={() => handleResult(round.id, p.id, r)}
                        className={`px-3 py-2 rounded-lg text-sm font-bold transition ${p.result === r ? r === '1' ? 'bg-green-700 text-white' : r === '0' ? 'bg-red-700 text-white' : r === '=' ? 'bg-amber-700 text-white' : 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                        {r === '1' ? '1-0' : r === '0' ? '0-1' : r === '=' ? '½-½' : r}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex justify-center my-2">
                    <span className={`px-4 py-2 rounded-lg font-bold text-base ${p.result === '1' ? 'bg-green-900 text-green-300' : p.result === '0' ? 'bg-red-900 text-red-300' : p.result === '=' ? 'bg-amber-900 text-amber-300' : 'text-gray-500'}`}>{p.result === '1' ? '1-0' : p.result === '0' ? '0-1' : p.result === '=' ? '½-½' : p.result}</span>
                  </div>
                )}

                <div className="flex items-center gap-3 mt-2">
                  {p.black_id ? (
                    <>
                      <span className="w-6 h-6 rounded-full bg-gray-700 text-gray-300 text-[10px] font-bold flex items-center justify-center shrink-0">{t('pairings.black').charAt(0)}</span>
                      <span className="font-medium text-sm flex-1 truncate">{p.black_name}{p.black_last ? ` ${p.black_last}` : ''}</span>
                    </>
                  ) : (
                    <span className="text-sm text-gray-600 italic">{t('arbiter.bye')}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <OfflineIndicator />
    </div>
  );
}
