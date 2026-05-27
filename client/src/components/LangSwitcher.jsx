import { useI18n } from '../i18n/context.jsx';

const LANGS = { es: 'ES', en: 'EN', fr: 'FR', de: 'DE', pt: 'PT' };

export default function LangSwitcher() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="flex gap-1">
      {Object.entries(LANGS).map(([code, label]) => (
        <button key={code} onClick={() => setLocale(code)}
          className={`text-xs px-1.5 py-0.5 rounded transition font-medium ${locale === code ? 'bg-fide-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}
