import React, { useState } from 'react';
import { useI18n } from '../i18n/context.jsx';

export function getKFactor(rating, gamesPlayed) {
  if (gamesPlayed < 30) return 40;
  if (rating >= 2400) return 10;
  return 20;
}

export function calculateChange(ratingA, ratingB, score, kFactor) {
  let diff = ratingB - ratingA;
  if (diff > 400) diff = 400;
  if (diff < -400) diff = -400;
  
  const expected = 1 / (1 + Math.pow(10, diff / 400));
  const change = kFactor * (score - expected);
  return Math.round(change * 10) / 10;
}

export default function RatingCalculator({ initialRating = 1500 }) {
  const { t } = useI18n();
  const [rating, setRating] = useState(initialRating);
  const [games, setGames] = useState(100);
  const [opponentRating, setOpponentRating] = useState(1500);

  const k = getKFactor(rating, games);
  const win = calculateChange(rating, opponentRating, 1, k);
  const draw = calculateChange(rating, opponentRating, 0.5, k);
  const loss = calculateChange(rating, opponentRating, 0, k);

  return (
    <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-6 shadow-sm w-full max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-fide-100 dark:bg-fide-700 text-fide-700 dark:text-fide-300 p-2 rounded-lg">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
        </div>
        <h3 className="font-bold dark:text-white text-xl">Calculadora de Elo FIDE en Vivo</h3>
      </div>
      
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-fide-400 block mb-1">Tu Elo actual</label>
            <input type="number" value={rating} onChange={(e) => setRating(Number(e.target.value))} className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-fide-700 dark:text-white focus:ring-2 focus:ring-fide-500 focus:outline-none transition" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-fide-400 block mb-1">Partidas jugadas (aprox)</label>
            <input type="number" value={games} onChange={(e) => setGames(Number(e.target.value))} className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-fide-700 dark:text-white focus:ring-2 focus:ring-fide-500 focus:outline-none transition" />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-fide-400 block mb-1">Elo del rival</label>
          <input type="number" value={opponentRating} onChange={(e) => setOpponentRating(Number(e.target.value))} className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-fide-700 dark:text-white focus:ring-2 focus:ring-fide-500 focus:outline-none transition" />
        </div>
        
        <div className="pt-5 border-t dark:border-fide-700 mt-2">
          <div className="text-sm font-semibold mb-3 dark:text-fide-200">Variación proyectada (Factor K = {k})</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl p-4 text-center transform transition hover:scale-105">
              <div className="text-xs text-green-700 dark:text-green-400 mb-1 font-semibold uppercase tracking-wider">Victoria</div>
              <div className="text-2xl font-bold font-mono text-green-700 dark:text-green-400">+{win}</div>
            </div>
            <div className="bg-gray-50 dark:bg-fide-700/50 border border-gray-200 dark:border-fide-600 rounded-xl p-4 text-center transform transition hover:scale-105">
              <div className="text-xs text-gray-700 dark:text-fide-300 mb-1 font-semibold uppercase tracking-wider">Tablas</div>
              <div className="text-2xl font-bold font-mono text-gray-800 dark:text-white">{draw > 0 ? '+' : ''}{draw}</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center transform transition hover:scale-105">
              <div className="text-xs text-red-700 dark:text-red-400 mb-1 font-semibold uppercase tracking-wider">Derrota</div>
              <div className="text-2xl font-bold font-mono text-red-700 dark:text-red-400">{loss}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
