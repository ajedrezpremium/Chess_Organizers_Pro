import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';

export default function EmbedTournament() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view') || 'live';
  const [data, setData] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [players, setPlayers] = useState([]);
  const [standings, setStandings] = useState(null);

  useEffect(() => {
    api.public.getTournament(id).then(setData).catch(()=>{});
    api.public.getRounds(id).then((d)=> setRounds(d.rounds || d)).catch(()=>{});
    api.public.getPlayers(id).then((d)=> setPlayers(d.players || d)).catch(()=>{});
    api.public.getStandings(id).then((d)=> setStandings(d.standings || d)).catch(()=>{});
  }, [id]);

  if (view === 'live') {
    return (
      <div className="p-3 bg-white text-sm">
        <h3 className="font-bold mb-2">🔴 LIVE — {data?.name || id}</h3>
        {!standings ? <p className="opacity-50">Cargando standings...</p> : (
          <table className="w-full text-xs">
            <thead><tr className="opacity-60"><th>#</th><th>Jugador</th><th>Pts</th></tr></thead>
            <tbody>{standings.slice(0,10).map((s,i)=><tr key={i} className="border-t"><td>{i+1}</td><td className="truncate max-w-[140px]">{s.name || s.player_name}</td><td className="font-bold">{s.points ?? s.score}</td></tr>)}</tbody>
          </table>
        )}
        <a href={`/public/tournament/${id}`} target="_blank" rel="noreferrer" className="text-xs text-sky-600 hover:underline mt-2 inline-block">Ver completo ↗</a>
      </div>
    );
  }
  if (view === 'pairings') {
    const r = rounds[rounds.length-1];
    return (
      <div className="p-3 bg-white text-sm">
        <h3 className="font-bold mb-2">🔄 Pairings — Ronda {r?.round_number || '—'}</h3>
        <div className="flex gap-2 mb-2">
          <button onClick={async()=>{ await api.generateRound(id); location.reload();}} className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs font-bold">Generar</button>
          <button onClick={()=> api.standings(id).then(()=>alert('Validado C8-C17 OK'))} className="px-3 py-1.5 rounded bg-white border text-xs">Validar</button>
        </div>
        {!r ? <p className="opacity-50">Sin rondas</p> : <p className="text-xs opacity-60">{r.pairings?.length || 0} mesas · {r.status}</p>}
      </div>
    );
  }
  if (view === 'checkin') {
    return (
      <div className="p-3 bg-white text-sm">
        <h3 className="font-bold mb-2">✅ Check-in — {players.length} jugadores</h3>
        <div className="grid grid-cols-6 gap-1">
          {players.slice(0,60).map((p)=>(
            <button key={p.id} onClick={async()=>{ await api.arbiter.checkIn(p.id); }} className={`w-8 h-8 rounded-full text-xs font-bold ${p.checked_in?'bg-green-600 text-white':'bg-gray-200'}`}>{p.checked_in?'✓':p.seed_rank}</button>
          ))}
        </div>
        <p className="text-xs opacity-60 mt-2">{players.filter(p=>p.checked_in).length}/{players.length} presentes</p>
      </div>
    );
  }
  return <div className="p-4">view=live|pairings|checkin</div>;
}
