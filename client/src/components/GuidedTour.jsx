import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/context.jsx';

// Tour guiado sin dependencias: resaltado spotlight + tarjeta contextual.
// steps: [{ selector|null, title, text, cta?{label,to} }]
export default function GuidedTour({ steps = [], onClose }) {
  const { t } = useI18n();
  const [idx, setIdx] = useState(0);
  const [box, setBox] = useState(null);
  const step = steps[idx] || {};

  const go = useCallback((n) => {
    if (n >= steps.length) { onClose(); return; }
    const s = steps[n];
    if (s.selector && !document.querySelector(s.selector)) { go(n + 1); return; }
    setIdx(n);
  }, [steps, onClose]);

  const place = useCallback(() => {
    const s = steps[idx];
    if (!s?.selector) { setBox(null); return; }
    const el = document.querySelector(s.selector);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => {
      const r = el.getBoundingClientRect();
      setBox({ x: r.left, y: r.top, w: r.width, h: r.height });
    }, 400);
  }, [idx, steps]);

  useEffect(() => { go(0); }, [go]);
  useEffect(() => { place(); }, [place]);
  useEffect(() => {
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [place, onClose]);

  if (!step.title) return null;
  const last = idx === steps.length - 1;
  const tipBelow = box && (box.y + box.h + 230 < window.innerHeight);
  const tipStyle = !box
    ? { left: '50%', top: '32%', transform: 'translateX(-50%)', width: 'min(92vw, 360px)' }
    : {
        left: Math.min(Math.max(box.x, 12), Math.max(12, window.innerWidth - 344)),
        width: 'min(92vw, 320px)',
        ...(tipBelow
          ? { top: box.y + box.h + 14 }
          : { top: Math.max(12, box.y - 14), transform: 'translateY(-100%)' }),
      };

  return (
    <>
      {box ? (
        <div className="fixed z-[90] rounded-xl border-2 border-amber-400 pointer-events-none transition-all duration-300"
          style={{ left: box.x - 8, top: box.y - 8, width: box.w + 16, height: box.h + 16, boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)' }} />
      ) : (
        <div className="fixed inset-0 z-[90] bg-black/65" onClick={onClose} />
      )}
      <div className="fixed z-[91] bg-white dark:bg-fide-800 border dark:border-fide-600 rounded-2xl shadow-2xl p-4" style={tipStyle}>
        <div className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-1">
          {t('tour.stepOf', { i: idx + 1, n: steps.length })}
        </div>
        <h3 className="font-bold text-sm dark:text-white mb-1">{step.title}</h3>
        <p className="text-xs text-gray-600 dark:text-fide-300 leading-relaxed mb-3">{step.text}</p>
        {step.cta && (
          <Link to={step.cta.to} onClick={onClose}
            className="block text-center bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold px-3 py-2 rounded-lg transition mb-2">
            {step.cta.label}
          </Link>
        )}
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-fide-200 mr-auto">
            {t('tour.skip')}
          </button>
          {idx > 0 && (
            <button onClick={() => go(idx - 1)} className="text-[11px] px-3 py-1.5 rounded-lg border border-gray-300 dark:border-fide-600 dark:text-fide-200 hover:border-amber-400 transition">
              {t('tour.back')}
            </button>
          )}
          <button onClick={() => go(idx + 1)}
            className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black transition">
            {last ? t('tour.finish') : t('tour.next')}
          </button>
        </div>
      </div>
    </>
  );
}
