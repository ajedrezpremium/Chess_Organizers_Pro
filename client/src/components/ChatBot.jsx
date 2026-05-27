import { useState, useRef, useEffect } from 'react';

const FAQ = [
  { q: '¿Cómo crear un torneo?', a: 'Ve a "Nuevo Torneo" en el menú, completa nombre, sistema y rondas. El torneo se crea en estado pendiente.' },
  { q: '¿Cómo inscribir jugadores?', a: 'Desde la pestaña "Jugadores" puedes buscar en la BD, importar de FIDE, o compartir el enlace público de inscripción.' },
  { q: '¿Cómo generar rondas?', a: 'En la pestaña "Rondas", haz clic en "Generar Ronda N". Debes tener al menos 2 jugadores inscritos.' },
  { q: '¿Cómo registrar resultados?', a: 'En cada ronda, usa el selector de resultado junto a cada pairing (1/0/=/U/F/H/Z).' },
  { q: '¿Cómo funciona el pago Stripe?', a: 'En Configuración, activa "Costo de inscripción" y pon un monto en centavos. Stripe debe estar configurado en el servidor.' },
  { q: '¿Qué sistemas de pairings hay?', a: 'Suizo Holandés, Round Robin, Burstein y Dubov. Todos compatibles FIDE.' },
  { q: '¿Se puede usar sin conexión?', a: 'Sí. La PWA cachea los datos. Los resultados se encolan y sincronizan al reconectar.' },
  { q: '¿Cómo exportar a FIDE?', a: 'Usa el botón "Exportar TRF" o "Enviar a FIDE" en la página del torneo. Genera XML formato C.02.' },
  { q: '¿Cómo añadir árbitros?', a: 'En Configuración → Árbitros, busca por email y añade. El creador del torneo es siempre árbitro.' },
  { q: '¿Qué planes hay?', a: 'Free (2 torneos, 30 jugadores), Básico (10 torneos, 100 jugadores) y Pro (ilimitado).' },
];

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', text: '¡Hola! Soy el asistente de Chess Organizers Pro. ¿En qué puedo ayudarte?' },
  ]);
  const [input, setInput] = useState('');
  const [showQuick, setShowQuick] = useState(true);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const ask = (question) => {
    const faq = FAQ.find((f) => f.q === question);
    if (!faq) return;
    setShowQuick(false);
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: question },
      { role: 'bot', text: faq.a },
    ]);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const q = input.trim();
    setInput('');
    setShowQuick(false);
    const faq = FAQ.find((f) => f.q.toLowerCase().includes(q.toLowerCase()) || f.a.toLowerCase().includes(q.toLowerCase()));
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    if (faq) {
      setTimeout(() => setMessages((prev) => [...prev, { role: 'bot', text: faq.a }]), 200);
    } else {
      setTimeout(() => setMessages((prev) => [...prev, { role: 'bot', text: 'No encontré esa respuesta. Tocá "FAQ" para ver todas las preguntas disponibles.' }]), 200);
    }
  };

  const resetFAQ = () => {
    setMessages([{ role: 'bot', text: '¡Hola! Elegí una pregunta o escribila abajo.' }]);
    setShowQuick(true);
  };

  return (
    <>
      <button onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-amber-600 hover:bg-amber-500 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
        title="Asistente">
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 h-[500px] bg-fide-900 border border-fide-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
          <div className="bg-fide-800 px-4 py-3 flex items-center gap-3 border-b border-fide-700">
            <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-sm font-bold">♛</div>
            <div>
              <div className="text-sm font-semibold text-white">Asistente COP</div>
              <div className="text-[10px] text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Online
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-amber-600 text-white rounded-br-sm'
                    : 'bg-fide-800 text-fide-200 rounded-bl-sm border border-fide-700/50'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}

            {showQuick && (
              <div className="space-y-1.5 pt-2">
                <p className="text-[10px] text-fide-400 text-center">— Preguntas frecuentes —</p>
                {FAQ.map((f) => (
                  <button key={f.q} onClick={() => ask(f.q)}
                    className="w-full text-left bg-fide-800/60 hover:bg-fide-700 border border-fide-700/50 hover:border-amber-600/50 rounded-lg px-3 py-2 text-xs text-fide-200 transition-all duration-200">
                    {f.q}
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-fide-700 p-3">
            <div className="flex gap-2 mb-2">
              <button onClick={() => { setShowQuick(!showQuick); if (!showQuick) setMessages((prev) => [...prev, { role: 'bot', text: 'Elegí una pregunta abajo o escribila:' }]); }}
                className="text-[10px] bg-fide-800 hover:bg-fide-700 text-fide-300 px-2 py-1 rounded transition">
                {showQuick ? '✕ Ocultar FAQ' : '📋 FAQ'}
              </button>
              <button onClick={resetFAQ}
                className="text-[10px] bg-fide-800 hover:bg-fide-700 text-fide-300 px-2 py-1 rounded transition">🔄 Reiniciar</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escribe tu pregunta..."
                className="flex-1 bg-fide-800 border border-fide-600 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-amber-500 placeholder-fide-400" />
              <button type="submit" disabled={!input.trim()}
                className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-xs font-medium transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
