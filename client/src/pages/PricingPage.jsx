import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n/context.jsx';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';

export default function PricingPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(null);

  useEffect(() => {
    api.listPlans().then(setPlans).catch(() => {});
    if (user) {
      api.myMembership().then((d) => setCurrent(d.membership)).catch(() => {});
    }
    setLoading(false);

    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      toast.success(t('pricing.checkoutSuccess'));
      if (user) {
        api.myMembership().then((d) => setCurrent(d.membership)).catch(() => {});
      }
      window.history.replaceState({}, '', '/pricing');
    }
  }, [user, searchParams]);

  const handleSubscribe = async (slug) => {
    if (!user) { navigate('/register'); return; }
    if (slug === 'free') {
      if (current?.plan_slug === 'free') { toast.info(t('pricing.alreadyFree')); return; }
      setSubscribing(slug);
      try {
        await api.subscribe(slug);
        toast.success(t('pricing.freeActivated'));
        const d = await api.myMembership();
        setCurrent(d.membership);
      } catch (e) { toast.error(e.message || t('pricing.subscriptionError')); }
      setSubscribing(null);
      return;
    }

    setSubscribing(slug);
    try {
      const result = await api.stripeCheckout({
        plan_slug: slug,
        success_url: window.location.origin + '/pricing',
        cancel_url: window.location.origin + '/pricing',
      });
      window.location.href = result.url;
    } catch (e) {
      toast.error(e.message || t('pricing.checkoutError'));
    }
    setSubscribing(null);
  };

  const handleManageBilling = async () => {
    try {
      const result = await api.stripePortal({ return_url: window.location.origin + '/pricing' });
      window.location.href = result.url;
    } catch (e) {
      toast.error(e.message || t('pricing.billingError'));
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900/80">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-amber-500 text-xl">♛</span>
            <span className="font-bold text-white">{t('app.title')}</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {user ? (
              <Link to="/" className="text-gray-400 hover:text-white">{t('pricing.goToDashboard')}</Link>
            ) : (
              <>
                <Link to="/login" className="text-gray-400 hover:text-white">{t('pricing.login')}</Link>
                <Link to="/register" className="bg-amber-600 hover:bg-amber-700 text-black px-4 py-2 rounded-lg font-medium">{t('pricing.signup')}</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white">{t('pricing.title')}</h1>
          <p className="text-gray-500 mt-3 text-lg">{t('pricing.subtitle')}</p>
        </div>

        {loading ? (
          <div className="flex justify-center"><div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full" /></div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => {
              const features = JSON.parse(plan.features || '[]');
              const isCurrent = current?.plan_slug === plan.slug;
              const hasStripeSub = current?.stripe_subscription_id;
              return (
                <div key={plan.id} className={`relative bg-gray-900 border rounded-2xl p-6 flex flex-col ${plan.recommended ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-gray-800'}`}>
                  {plan.recommended && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-xs font-bold px-4 py-1 rounded-full">{t('pricing.recommended')}</span>
                  )}
                  <div className="mb-6">
                    <h2 className="text-xl font-bold text-white">{plan.name}</h2>
                    <p className="text-gray-500 text-sm mt-1">{plan.description}</p>
                  </div>
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white">
                        {plan.price_usd === 0 ? t('pricing.free') : `$${plan.price_usd}`}
                      </span>
                      {plan.price_usd > 0 && <span className="text-gray-500 text-sm">{t('pricing.perMonth')}</span>}
                    </div>
                    {plan.price_mxn > 0 && (
                      <span className="text-gray-600 text-xs">${plan.price_mxn.toLocaleString()} MXN/mes</span>
                    )}
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                        <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {isCurrent && hasStripeSub ? (
                    <button onClick={handleManageBilling}
                      className="w-full py-3 rounded-xl text-sm font-bold border border-amber-500 text-amber-500 hover:bg-amber-500/10 transition">
                      {t('pricing.manageSubscription')}
                    </button>
                  ) : (
                    <button onClick={() => handleSubscribe(plan.slug)} disabled={subscribing === plan.slug}
                      className={`w-full py-3 rounded-xl text-sm font-bold transition ${isCurrent ? 'bg-gray-800 text-gray-500 cursor-default' : plan.recommended ? 'bg-amber-500 hover:bg-amber-600 text-black' : 'border border-gray-700 text-white hover:bg-gray-800'}`}>
                      {subscribing === plan.slug ? t('pricing.processing') : isCurrent ? t('pricing.currentPlan') : plan.price_usd === 0 ? t('pricing.startFree') : t('pricing.subscribe')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {user && current && (
          <div className="text-center mt-8 text-sm text-gray-600">
            {t('pricing.currentPlan')}: <span className="text-amber-500 font-medium">{current.plan_name}</span>
            {' | '}
            {current.stripe_subscription_id && (
              <button onClick={handleManageBilling} className="text-gray-400 hover:text-white underline mr-2">
                {t('pricing.manageBilling')}
              </button>
            )}
            <Link to="/" className="text-gray-400 hover:text-white underline">{t('pricing.goToDashboard')}</Link>
          </div>
        )}
      </div>
    </div>
  );
}
