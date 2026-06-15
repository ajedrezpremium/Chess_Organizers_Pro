import { useState, useRef, useEffect } from 'react';
import { FIDE_LAWS_2023 } from '../data/fide-laws-2023.js';
import { api } from '../api/client.js';

const QUICK_QUESTIONS = [
  '¿Qué pasa si hago un movimiento ilegal?',
  '¿Cuándo puedo reclamar tablas por repetición?',
  '¿Qué sanciones puede aplicar el árbitro?',
  '¿Cuándo se pierde el derecho al enroque?',
  '¿Se puede tener el móvil en la sala?',
  '¿Qué es la regla de los 50 movimientos?',
  '¿Cuándo puedo ofrecer tablas?',
  '¿Qué es j\'adoube?',
  '¿Qué ocurre si llego tarde a la partida?',
  '¿Qué es la captura al paso?',
];

function ArticleCard({ article }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border dark:border-fide-700 rounded-lg overflow-hidden text-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-fide-800 hover:bg-gray-100 dark:hover:bg-fide-700 transition text-left"
      >
        <span className="font-semibold dark:text-white text-xs">{article.title}</span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <ul className="px-3 py-2 space-y-1.5 bg-white dark:bg-fide-900">
          {article.rules.map((r, i) => (
            <li key={i} className="text-xs dark:text-fide-300 text-gray-700 leading-snug border-l-2 border-amber-400 pl-2">
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ArbiterAssistant() {
  const [messages, setMessages] = useState([
    {
      role: 'arbiter',
      text: '👋 Soy el **Árbitro IA**, formado con las Leyes FIDE del Ajedrez 2023 (vigentes desde el 1 de enero de 2023).\n\nPuedo responder dudas sobre reglas, sanciones, reclamaciones y procedimientos oficiales. ¿En qué te puedo ayudar?',
      article: null,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [tab, setTab] = useState('chat'); // 'chat' | 'articles' | 'faq'
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = (question) => {
    const q = question || input.trim();
    if (!q) return;

    setMessages((prev) => [...prev, { role: 'user', text: q, timestamp: new Date() }]);
    setInput('');

    api.askFide(q, messages.map(m => ({ role: m.role, text: m.text }))).then((resp) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'arbiter',
          text: resp.answer || 'Lo siento, no pude procesar tu pregunta.',
          article: resp.article || null,
          title: resp.title || null,
          confidence: resp.confidence || 'low',
          related: resp.related || [],
          timestamp: new Date(),
        },
      ]);
    }).catch(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'arbiter',
          text: 'Hubo un error al consultar. Intenta de nuevo.',
          article: null,
          title: null,
          confidence: 'low',
          related: [],
          timestamp: new Date(),
        },
      ]);
    });
  };

  const confidenceColor = {
    high: 'text-green-500',
    medium: 'text-amber-500',
    low: 'text-gray-400',
  };

  const confidenceLabel = {
    high: '✓ Alta confianza',
    medium: '~ Confianza media',
    low: '? Sin resultado directo',
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-xl shrink-0">
          ⚖️
        </div>
        <div>
          <h2 className="text-lg font-bold dark:text-white">Árbitro IA — Leyes FIDE 2023</h2>
          <p className="text-xs text-gray-500 dark:text-fide-400">
            Base de conocimiento: <a href="https://handbook.fide.com/chapter/E012023" target="_blank" rel="noreferrer" className="underline hover:text-amber-500">handbook.fide.com</a> · Vigentes desde 01/01/2023
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b dark:border-fide-700">
        {[
          { id: 'chat', label: '💬 Consultar', },
          { id: 'articles', label: '📖 Artículos', },
          { id: 'faq', label: '❓ FAQ', },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              tab === t.id
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-gray-500 dark:text-fide-400 hover:text-gray-700 dark:hover:text-fide-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: CHAT */}
      {tab === 'chat' && (
        <div className="space-y-3">
          {/* Chat window */}
          <div className="bg-gray-50 dark:bg-fide-900 border dark:border-fide-700 rounded-xl overflow-hidden">
            <div className="h-80 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'arbiter' && (
                    <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-sm shrink-0 mr-2 mt-0.5">⚖️</div>
                  )}
                  <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                    <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-amber-500 text-white rounded-tr-none'
                        : 'bg-white dark:bg-fide-800 dark:text-fide-100 border dark:border-fide-700 rounded-tl-none shadow-sm'
                    }`}>
                      {msg.text.replace(/\*\*(.*?)\*\*/g, '$1')}
                    </div>
                    {msg.article && (
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`text-[10px] ${confidenceColor[msg.confidence]}`}>
                          {confidenceLabel[msg.confidence]}
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-fide-500">
                          Art. {msg.article} FIDE 2023
                        </span>
                      </div>
                    )}
                    {msg.related && msg.related.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {msg.related.map((r, ri) => (
                          <button
                            key={ri}
                            onClick={() => send(r.q || r.title)}
                            className="text-[10px] bg-gray-100 dark:bg-fide-700 dark:text-fide-300 rounded px-2 py-0.5 hover:bg-amber-100 dark:hover:bg-fide-600 transition"
                          >
                            {r.q || r.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t dark:border-fide-700 p-3 bg-white dark:bg-fide-800 flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Pregunta sobre las reglas FIDE 2023..."
                className="flex-1 border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-gray-50 dark:bg-fide-700 dark:text-white outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                onClick={() => send()}
                disabled={!input.trim()}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
              >
                Enviar
              </button>
            </div>
          </div>

          {/* Quick questions */}
          <div>
            <p className="text-xs text-gray-500 dark:text-fide-400 mb-2">Preguntas frecuentes:</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-xs border dark:border-fide-600 rounded-full px-3 py-1 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-400 dark:text-fide-300 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: ARTICLES */}
      {tab === 'articles' && (
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
          <p className="text-xs text-gray-500 dark:text-fide-400 mb-3">
            Todas las leyes FIDE 2023 — haz clic en un artículo para expandirlo.
          </p>
          {FIDE_LAWS_2023.articles.map((art) => (
            <ArticleCard key={art.id} article={art} />
          ))}
        </div>
      )}

      {/* TAB: FAQ */}
      {tab === 'faq' && (
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
          <p className="text-xs text-gray-500 dark:text-fide-400 mb-3">
            Preguntas y respuestas más frecuentes basadas en los artículos oficiales.
          </p>
          {FIDE_LAWS_2023.faq.map((f, i) => (
            <div key={i} className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-4 shadow-sm">
              <div className="flex items-start gap-2 mb-2">
                <span className="text-amber-500 text-base shrink-0">❓</span>
                <p className="text-sm font-semibold dark:text-white">{f.q}</p>
              </div>
              <div className="border-l-2 border-amber-400 pl-3 ml-6">
                <p className="text-sm dark:text-fide-200 text-gray-700 leading-relaxed">{f.a}</p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-medium">Artículo {f.article} — FIDE Laws 2023</p>
              </div>
              <button
                onClick={() => { setTab('chat'); send(f.q); }}
                className="mt-2 ml-6 text-[11px] text-amber-600 hover:underline"
              >
                Preguntar al árbitro →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
