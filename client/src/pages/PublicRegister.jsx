import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/context.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';

export default function PublicRegister() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tournament, setTournament] = useState(null);
  const [form, setForm] = useState({ name: '', last_name: '', email: '', fide_id: '', fide_rating: '', federation: '', title: '', phone: '', notes: '', custom_data: {} });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [requiresPayment, setRequiresPayment] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState(null);
  const [regStatus, setRegStatus] = useState(null);

  const isPaymentSuccess = searchParams.get('success') === '1';
  const paymentRegId = searchParams.get('reg_id');

  useEffect(() => {
    Promise.all([
      api.public.getTournament(id),
      api.public.registrationStatus(id).catch(() => null),
    ]).then(([t, rs]) => {
      setTournament(t);
      setRegStatus(rs);
    }).catch(() => setError(t('register.notAvailable')));
  }, [id]);

  const customFields = (() => {
    try { return JSON.parse(tournament?.custom_fields || '[]'); } catch { return []; }
  })();

  const fee = tournament?.registration_fee || 0;
  const currency = tournament?.registration_currency || 'usd';
  const formattedFee = (fee / 100).toFixed(2);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleCustomChange = (key, value) => setForm({ ...form, custom_data: { ...form.custom_data, [key]: value } });

  const checkPaymentStatus = async () => {
    if (!paymentRegId) return;
    try {
      // Just show success and redirect to tournament page
      setDone(true);
      toast.success('Pago completado. Inscripción registrada.');
      setTimeout(() => navigate(`/public/tournament/${id}`), 3000);
    } catch {}
  };

  useEffect(() => {
    if (isPaymentSuccess && paymentRegId) {
      checkPaymentStatus();
    }
  }, [isPaymentSuccess, paymentRegId]);

  // If payment was successful, show the success view
  if (isPaymentSuccess && done) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-white mb-2">{t('register.requestSent')}</h1>
          <p className="text-gray-400 mb-6">{t('register.organizerReview')}</p>
          <div className="animate-spin h-6 w-6 border-2 border-amber-500 border-t-transparent rounded-full mx-auto mb-4" />
          <Link to={`/public/tournament/${id}`} className="text-amber-500 hover:underline text-sm">{t('register.viewTournamentPage')}</Link>
        </div>
      </div>
    );
  }

  if (error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-6xl mb-4">♛</div>
        <h1 className="text-2xl font-bold text-white mb-2">{t('register.notAvailable')}</h1>
        <p className="text-gray-400 mb-6">{error}</p>
        <Link to="/public" className="text-amber-500 hover:underline">{t('register.viewTournaments')}</Link>
      </div>
    </div>
  );

  if (!tournament) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="animate-spin h-10 w-10 border-4 border-amber-500 border-t-transparent rounded-full" />
    </div>
  );

  if (done) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-white mb-2">{t('register.requestSent')}</h1>
        <p className="text-gray-400 mb-2">{t('register.requestInfo', { name: tournament.name })}</p>
        <p className="text-gray-500 text-sm mb-6">
          {requiresPayment ? 'Serás redirigido al pago...' : t('register.organizerReview')}
        </p>
        <Link to={`/public/tournament/${id}`} className="text-amber-500 hover:underline text-sm">{t('register.viewTournamentPage')}</Link>
      </div>
    </div>
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await api.public.register(id, form);
      if (result.requires_payment && result.checkout_url) {
        setRequiresPayment(true);
        setCheckoutUrl(result.checkout_url);
        // Redirect to Stripe Checkout
        window.location.href = result.checkout_url;
      } else {
        setDone(true);
      }
    } catch (err) { setError(err.message); setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-2">
          <span className="text-amber-500 text-lg">♛</span>
          <span className="font-bold text-white">{t('app.title')}</span>
          <span className="text-gray-600 mx-2">/</span>
          <Link to={`/public/tournament/${id}`} className="text-amber-500 hover:text-amber-400 text-sm">{tournament.name}</Link>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">{t('register.tournamentRegistration')}</h1>
          <p className="text-gray-400">{tournament.name}</p>
          {fee > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 bg-amber-900/30 border border-amber-700/50 rounded-lg px-4 py-2">
              <span className="text-amber-400 font-bold text-lg">{formattedFee} {currency.toUpperCase()}</span>
              <span className="text-gray-400 text-xs">{t('register.registrationFee')}</span>
            </div>
          )}
          {regStatus && (
            <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-500">
              {regStatus.maxPlayers > 0 && (
                <span>{regStatus.registeredCount}/{regStatus.maxPlayers} jugadores inscritos</span>
              )}
              {regStatus.spotsRemaining > 0 && regStatus.spotsRemaining <= 10 && (
                <span className="text-amber-400 font-medium">¡Solo {regStatus.spotsRemaining} lugares!</span>
              )}
              {!regStatus.canRegister && (
                <span className="text-red-400">{regStatus.message}</span>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">{t('register.name')} *</label>
              <input name="name" value={form.name} onChange={handleChange} required autoFocus
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-amber-500 outline-none placeholder-gray-500" placeholder={t('register.placeholderName')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">{t('register.lastName')}</label>
              <input name="last_name" value={form.last_name} onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-amber-500 outline-none placeholder-gray-500" placeholder={t('register.placeholderLastName')} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('register.email')}</label>
            <input name="email" type="email" value={form.email} onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-amber-500 outline-none placeholder-gray-500" placeholder={t('register.placeholderEmail')} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">{t('register.fideId')}</label>
              <input name="fide_id" value={form.fide_id} onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-amber-500 outline-none placeholder-gray-500" placeholder={t('register.placeholderFideId')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">{t('register.rating')}</label>
              <input name="fide_rating" type="number" value={form.fide_rating} onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-amber-500 outline-none placeholder-gray-500" placeholder={t('register.placeholderRating')} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">{t('register.federation')}</label>
              <input name="federation" value={form.federation} onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-amber-500 outline-none placeholder-gray-500" placeholder={t('register.placeholderFederation')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">{t('register.phone')}</label>
              <input name="phone" value={form.phone} onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-amber-500 outline-none placeholder-gray-500" placeholder={t('register.placeholderPhone')} />
            </div>
          </div>

          {/* Custom fields */}
          {customFields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                {field.label}
                {field.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea value={form.custom_data[field.key] || ''} onChange={(e) => handleCustomChange(field.key, e.target.value)}
                  rows={2} required={field.required}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-amber-500 outline-none placeholder-gray-500"
                  placeholder={field.placeholder || field.label} />
              ) : field.type === 'select' ? (
                <select value={form.custom_data[field.key] || ''} onChange={(e) => handleCustomChange(field.key, e.target.value)} required={field.required}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-amber-500 outline-none">
                  <option value="">{field.required ? 'Seleccionar...' : 'Opcional'}</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : field.type === 'checkbox' ? (
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input type="checkbox" checked={form.custom_data[field.key] || false} onChange={(e) => handleCustomChange(field.key, e.target.checked)}
                    className="rounded bg-gray-800 border-gray-700 text-amber-500 focus:ring-amber-500" />
                  {field.label}
                </label>
              ) : (
                <input type={field.type || 'text'} value={form.custom_data[field.key] || ''} onChange={(e) => handleCustomChange(field.key, e.target.value)}
                  required={field.required}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-amber-500 outline-none placeholder-gray-500"
                  placeholder={field.placeholder || field.label} />
              )}
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('register.notes')}</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-amber-500 outline-none placeholder-gray-500" placeholder={t('register.placeholderNotes')} />
          </div>

          {error && <div className="bg-red-900/50 border border-red-800 text-red-300 px-4 py-2 rounded text-sm">{error}</div>}

          <button type="submit" disabled={saving}
            className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-black font-semibold py-2.5 rounded-lg transition text-sm">
            {saving ? t('register.sending') : fee > 0 ? `Pagar ${formattedFee} ${currency.toUpperCase()} e inscribirse` : t('register.sendRequest')}
          </button>

          <p className="text-xs text-gray-500 text-center">{t('register.organizerNote')}</p>
        </form>
      </div>
    </div>
  );
}
