import { useState, useEffect } from 'react';

export default function SWUpdatePrompt() {
  const [show, setShow] = useState(false);
  const [reg, setReg] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      setReg(e.detail.registration);
      setShow(true);
    };
    window.addEventListener('sw-update', handler);
    return () => window.removeEventListener('sw-update', handler);
  }, []);

  if (!show) return null;

  const handleUpdate = () => {
    if (reg?.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    setShow(false);
    window.location.reload();
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-fide-800 border border-amber-600/50 rounded-lg shadow-2xl px-4 py-3 flex items-center gap-3 animate-fadeIn">
      <div className="text-amber-400 text-lg">⟳</div>
      <div className="text-sm text-fide-200">
        <span className="font-medium text-white">Nueva versión disponible</span>
        <p className="text-xs text-fide-400">Actualiza para obtener los últimos cambios.</p>
      </div>
      <button
        onClick={handleUpdate}
        className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200"
      >
        Actualizar
      </button>
      <button
        onClick={() => setShow(false)}
        className="text-fide-400 hover:text-white text-xs"
      >
        ✕
      </button>
    </div>
  );
}
