import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import es from './es.js';
import en from './en.js';
import fr from './fr.js';
import de from './de.js';
import pt from './pt.js';

const LOCALES = { es, en, fr, de, pt };
const FALLBACK = 'en';

function detectLanguage() {
  try {
    const stored = localStorage.getItem('locale');
    if (stored && LOCALES[stored]) return stored;
    const lang = navigator.language?.slice(0, 2);
    if (lang && LOCALES[lang]) return lang;
  } catch {}
  return FALLBACK;
}

function flatten(obj, prefix = '') {
  return Object.entries(obj).reduce((acc, [key, val]) => {
    const k = prefix ? `${prefix}.${key}` : key;
    if (typeof val === 'object') Object.assign(acc, flatten(val, k));
    else acc[k] = val;
    return acc;
  }, {});
}

const CACHE = {};
function getMessages(locale) {
  if (!CACHE[locale]) CACHE[locale] = flatten(LOCALES[locale]);
  return CACHE[locale];
}

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

const I18nContext = createContext({ locale: FALLBACK, t: (k) => k, setLocale: () => {} });

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(detectLanguage);
  const msgs = getMessages(locale);

  const t = useCallback((key, vars) => {
    const msg = msgs[key];
    return msg !== undefined ? interpolate(msg, vars) : key;
  }, [locale]);

  const setLocale = useCallback((l) => {
    if (LOCALES[l]) { setLocaleState(l); localStorage.setItem('locale', l); }
  }, []);

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
