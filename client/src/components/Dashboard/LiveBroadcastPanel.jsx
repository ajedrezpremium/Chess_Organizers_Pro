export default function LiveBroadcastPanel() {
  return (
    <a
      href="https://lichess.org/broadcast"
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-gradient-to-br from-red-900/30 via-fide-800 to-red-900/30 border border-red-700/30 rounded-xl p-5 hover:border-red-600/50 transition group"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <h3 className="text-lg font-bold text-white group-hover:text-red-400 transition">En Directo</h3>
          </div>
          <p className="text-sm text-fide-400 mt-1">Sigue torneos en vivo desde Lichess Broadcast</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-red-700/20 px-4 py-2 rounded-lg text-red-400 text-sm font-medium">
          <span>lichess.org/broadcast</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
        </div>
      </div>
    </a>
  );
}
