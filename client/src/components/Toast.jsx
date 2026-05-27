import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ToastContext = createContext(null);

let toastId = 0;

function ToastIcon({ type }) {
  if (type === 'success') return <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>;
  if (type === 'error') return <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>;
  return <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" /></svg>;
}

function ToastItem({ t, onRemove }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const duration = 4000;
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`relative overflow-hidden px-4 py-3 rounded-xl shadow-xl text-sm font-medium text-white flex items-center gap-2.5 animate-toast-in ${
      t.type === 'error' ? 'bg-gradient-to-r from-red-600 to-red-500' :
      t.type === 'success' ? 'bg-gradient-to-r from-emerald-600 to-green-500' :
      'bg-gradient-to-r from-fide-600 to-fide-500'
    }`}>
      <ToastIcon type={t.type} />
      <span className="flex-1">{t.message}</span>
      <button onClick={() => onRemove(t.id)} className="text-white/60 hover:text-white transition-colors p-0.5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
      <div className="absolute bottom-0 left-0 h-0.5 bg-white/30 transition-all duration-100 ease-linear" style={{ width: `${progress}%` }} />
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const add = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type, duration }]);
    if (duration > 0) setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  const remove = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  const toast = { success: (m) => add(m, 'success'), error: (m) => add(m, 'error'), info: (m) => add(m, 'info') };

  return (
    <ToastContext.Provider value={{ add, remove, toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full sm:w-auto pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem t={t} onRemove={remove} />
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(1rem) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-toast-in { animation: toast-in 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() { return useContext(ToastContext); }
