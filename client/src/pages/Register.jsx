import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useI18n } from '../i18n/context.jsx';
import { api } from '../api/client.js';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { dark, toggle } = useTheme();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await register(email, password, name);
      try { await api.subscribe('free'); } catch {}
      navigate('/pricing');
    } catch (err) { setError(err.message); setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-fide-900 to-fide-700 p-4">
      <div className="bg-white dark:bg-fide-800 rounded-xl shadow-2xl p-8 w-full max-w-sm">
        <div className="flex justify-end mb-2">
          <button onClick={toggle} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-fide-700 transition" title={dark ? 'Modo claro' : 'Modo oscuro'}>
            {dark ? <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> : <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>}
          </button>
        </div>
        <h1 className="text-2xl font-bold text-center mb-2 dark:text-white">{t('auth.createAccount')}</h1>
        <p className="text-xs text-gray-500 dark:text-fide-400 text-center mb-6">{t('auth.freePlanHint')}</p>
        {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-fide-200 mb-1">{t('auth.name')}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white focus:ring-2 focus:ring-fide-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-fide-200 mb-1">{t('auth.email')}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white focus:ring-2 focus:ring-fide-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-fide-200 mb-1">{t('auth.password')}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white focus:ring-2 focus:ring-fide-500 outline-none" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-fide-700 hover:bg-fide-800 disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition">{loading ? t('auth.creating') : t('auth.createFreeAccount')}</button>
        </form>
        <p className="text-center text-sm text-gray-500 dark:text-fide-300 mt-4">
          {t('auth.hasAccount')} <Link to="/login" className="text-fide-600 dark:text-fide-300 hover:underline">{t('auth.signIn')}</Link>
        </p>
      </div>
    </div>
  );
}
