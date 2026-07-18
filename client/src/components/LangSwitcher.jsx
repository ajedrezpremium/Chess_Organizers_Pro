import { useState, useRef, useEffect } from 'react';
import { useI18n } from '../i18n/context.jsx';

const LANGS = { es: 'ES', en: 'EN', fr: 'FR', de: 'DE', pt: 'PT' };

export default function LangSwitcher() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs px-2 py-1 rounded transition font-medium bg-fide-700 text-white hover:bg-fide-600">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>{LANGS[locale] || locale}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-lg shadow-xl py-1 z-50 min-w-[80px]">
          {Object.entries(LANGS).map(([code, label]) => (
            <button key={code} onClick={() => { setLocale(code); setOpen(false); }}
              className={`block w-full text-left text-xs px-3 py-1.5 transition ${locale === code ? 'bg-fide-100 dark:bg-fide-700 text-fide-900 dark:text-white font-medium' : 'text-gray-600 dark:text-fide-300 hover:bg-gray-50 dark:hover:bg-fide-700'}`}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
