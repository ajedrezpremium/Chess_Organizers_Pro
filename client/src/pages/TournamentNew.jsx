import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/context.jsx';
import { useToast } from '../components/Toast.jsx';

const SYSTEMS = [
  { value: 'dutch', labelKey: 'dutch', descKey: 'dutch' },
  { value: 'roundrobin', labelKey: 'roundrobin', descKey: 'roundrobin' },
  { value: 'burstein', labelKey: 'burstein', descKey: 'burstein' },
  { value: 'dubov', labelKey: 'dubov', descKey: 'dubov' },
];

export default function TournamentNew() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const [form, setForm] = useState({ name: '', system: 'dutch', n_rounds: 6, federation: '', time_control: '90+30', description: '' });
  const [saving, setSaving] = useState(false);
  const [selectedSystem, setSelectedSystem] = useState('dutch');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    if (name === 'system') setSelectedSystem(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const tourn = await api.createTournament(form);
      toast.success('Torneo creado correctamente');
      navigate(`/tournament/${tourn.id}`);
    } catch (err) { toast.error(err.message); setSaving(false); }
  };

  const sysList = [
    { value: 'dutch', label: t('newTournament.systems.dutch'), desc: t('newTournament.systems.dutch') },
    { value: 'roundrobin', label: t('newTournament.systems.roundrobin'), desc: t('newTournament.systems.roundrobin') },
    { value: 'burstein', label: t('newTournament.systems.burstein'), desc: t('newTournament.systems.burstein') },
    { value: 'dubov', label: t('newTournament.systems.dubov'), desc: t('newTournament.systems.dubov') },
  ];

  return (
    <div className="max-w-2xl mx-auto animate-fadeIn">
      <div className="mb-8">
        <button onClick={() => navigate('/')} className="text-sm text-fide-500 hover:text-fide-600 dark:text-fide-400 dark:hover:text-fide-300 inline-flex items-center gap-1 mb-2 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {t('common.back')}
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{t('newTournament.title')}</h1>
        <p className="text-sm text-gray-500 dark:text-fide-400 mt-1">{t('newTournament.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-fide-800 border border-gray-200 dark:border-fide-700/50 rounded-xl p-6 sm:p-8 shadow-sm space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-fide-200 mb-1.5">{t('newTournament.nameLabel')}</label>
          <input name="name" value={form.name} onChange={handleChange} required autoFocus
            className="w-full border border-gray-300 dark:border-fide-600 rounded-lg px-3.5 py-2.5 text-sm bg-white dark:bg-fide-700 dark:text-white focus:ring-2 focus:ring-fide-500 focus:border-fide-500 outline-none transition-all duration-200 placeholder-gray-400"
            placeholder={t('newTournament.namePlaceholder')} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-fide-200 mb-1.5">{t('newTournament.system')}</label>
            <select name="system" value={form.system} onChange={handleChange}
              className="w-full border border-gray-300 dark:border-fide-600 rounded-lg px-3.5 py-2.5 text-sm bg-white dark:bg-fide-700 dark:text-white focus:ring-2 focus:ring-fide-500 focus:border-fide-500 outline-none transition-all duration-200">
              {sysList.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <p className="text-xs text-gray-400 dark:text-fide-500 mt-1">{sysList.find((s) => s.value === form.system)?.desc}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-fide-200 mb-1.5">{t('newTournament.rounds')}</label>
            <input name="n_rounds" type="number" value={form.n_rounds} onChange={handleChange} min={1} max={99}
              className="w-full border border-gray-300 dark:border-fide-600 rounded-lg px-3.5 py-2.5 text-sm bg-white dark:bg-fide-700 dark:text-white focus:ring-2 focus:ring-fide-500 focus:border-fide-500 outline-none transition-all duration-200" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-fide-200 mb-1.5">{t('newTournament.federation')}</label>
            <input name="federation" value={form.federation} onChange={handleChange} placeholder="Ej: ESP"
              className="w-full border border-gray-300 dark:border-fide-600 rounded-lg px-3.5 py-2.5 text-sm bg-white dark:bg-fide-700 dark:text-white focus:ring-2 focus:ring-fide-500 focus:border-fide-500 outline-none transition-all duration-200 placeholder-gray-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-fide-200 mb-1.5">{t('newTournament.timeControl')}</label>
            <input name="time_control" value={form.time_control} onChange={handleChange}
              className="w-full border border-gray-300 dark:border-fide-600 rounded-lg px-3.5 py-2.5 text-sm bg-white dark:bg-fide-700 dark:text-white focus:ring-2 focus:ring-fide-500 focus:border-fide-500 outline-none transition-all duration-200 placeholder-gray-400" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-fide-200 mb-1.5">{t('newTournament.description')}</label>
          <textarea name="description" value={form.description} onChange={handleChange} rows={3}
            className="w-full border border-gray-300 dark:border-fide-600 rounded-lg px-3.5 py-2.5 text-sm bg-white dark:bg-fide-700 dark:text-white focus:ring-2 focus:ring-fide-500 focus:border-fide-500 outline-none transition-all duration-200 placeholder-gray-400 resize-none"
            placeholder={t('newTournament.descPlaceholder')} />
        </div>

        <div className="flex gap-3 pt-3 border-t border-gray-200 dark:border-fide-700/50">
          <button type="submit" disabled={saving}
            className="flex-1 sm:flex-none bg-fide-700 hover:bg-fide-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.97]">
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                {t('newTournament.creating')}
              </span>
            ) : t('newTournament.create')}
          </button>
          <button type="button" onClick={() => navigate('/')}
            className="px-6 py-2.5 rounded-xl text-sm font-medium border border-gray-300 dark:border-fide-600 text-gray-600 dark:text-fide-300 hover:bg-gray-50 dark:hover:bg-fide-700 transition-all duration-200">
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
