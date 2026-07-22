import { useState, useRef, useEffect } from 'react';
import { useI18n } from '../i18n/context.jsx';

function buildFAQ(t) {
  return [
    { q: t('chat.faq1_q'), a: t('chat.faq1_a') },
    { q: t('chat.faq2_q'), a: t('chat.faq2_a') },
    { q: t('chat.faq3_q'), a: t('chat.faq3_a') },
    { q: t('chat.faq4_q'), a: t('chat.faq4_a') },
    { q: t('chat.faq5_q'), a: t('chat.faq5_a') },
    { q: t('chat.faq6_q'), a: t('chat.faq6_a') },
    { q: t('chat.faq7_q'), a: t('chat.faq7_a') },
    { q: t('chat.faq8_q'), a: t('chat.faq8_a') },
    { q: t('chat.faq9_q'), a: t('chat.faq9_a') },
    { q: t('chat.faq10_q'), a: t('chat.faq10_a') },
  ];
}

export default function ChatBot() {
  const { t, locale } = useI18n();
  const FAQ = buildFAQ(t);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: 'bot', text: t('chat.greeting') }]);
  const [input, setInput] = useState('');
  const [showQuick, setShowQuick] = useState(true);
  const [voiceGender, setVoiceGender] = useState('female');
  const [speakingId, setSpeakingId] = useState(null);
  const [listening, setListening] = useState(false);
  const endRef = useRef(null);
  const synth = window.speechSynthesis;
  const recognitionRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    setMessages([{ role: 'bot', text: t('chat.greeting') }]);
    setShowQuick(true);
  }, [locale]);

  const speak = (text, id) => {
    if (!synth) return;
    synth.cancel();
    if (speakingId === id) { setSpeakingId(null); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale === 'es' ? 'es-ES' : locale === 'fr' ? 'fr-FR' : locale === 'de' ? 'de-DE' : locale === 'pt' ? 'pt-PT' : 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = voiceGender === 'female' ? 1.3 : 0.8;
    utterance.onend = () => setSpeakingId(null);
    setSpeakingId(id);
    synth.speak(utterance);
  };

  const stopSpeech = () => { if (synth) synth.cancel(); setSpeakingId(null); };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('Speech recognition not supported in this browser'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = locale === 'es' ? 'es-ES' : locale === 'fr' ? 'fr-FR' : locale === 'de' ? 'de-DE' : locale === 'pt' ? 'pt-PT' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setListening(false);
      setTimeout(() => { document.getElementById('chat-send-btn')?.click(); }, 300);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) { recognitionRef.current.stop(); }
    setListening(false);
  };

  const ask = (question) => {
    const faq = FAQ.find((f) => f.q === question);
    if (!faq) return;
    setShowQuick(false);
    setMessages((prev) => [...prev, { role: 'user', text: question }, { role: 'bot', text: faq.a }]);
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
      setTimeout(() => setMessages((prev) => [...prev, { role: 'bot', text: t('chat.notFound') }]), 200);
    }
  };

  const resetFAQ = () => {
    setMessages([{ role: 'bot', text: t('chat.greetingFaq') }]);
    setShowQuick(true);
  };

  const shareChat = async () => {
    const text = messages.map((m) => `${m.role === 'user' ? '👤' : '♛'} ${m.text}`).join('\n');
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Chess Organizers Pro — Chat', text });
      } else {
        await navigator.clipboard.writeText(text);
        alert(t('chat.copied'));
      }
    } catch {}
  };

  const msgId = (i) => `msg-${i}`;

  return (
    <>
      <button onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-amber-600 hover:bg-amber-500 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
        title={t('chat.title')}>
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 h-[500px] bg-fide-900 border border-fide-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="bg-fide-800 px-4 py-3 flex items-center gap-3 border-b border-fide-700">
            <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-sm font-bold">♛</div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">{t('chat.title')}</div>
              <div className="text-[10px] text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> {t('chat.online')}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setVoiceGender(voiceGender === 'female' ? 'male' : 'female')}
                className="text-xs bg-fide-700 hover:bg-fide-600 text-fide-300 px-1.5 py-1 rounded transition" title={voiceGender === 'female' ? t('chat.voiceMale') : t('chat.voiceFemale')}>
                {voiceGender === 'female' ? '👩' : '👨'}
              </button>
              <button onClick={shareChat}
                className="text-xs bg-fide-700 hover:bg-fide-600 text-fide-300 px-1.5 py-1 rounded transition" title={t('chat.share')}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-amber-600 text-white rounded-br-sm'
                    : 'bg-fide-800 text-fide-200 rounded-bl-sm border border-fide-700/50'
                }`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1">{m.text}</div>
                    {m.role === 'bot' && (
                      <button onClick={() => speakingId === msgId(i) ? stopSpeech() : speak(m.text, msgId(i))}
                        className="shrink-0 text-fide-400 hover:text-amber-400 transition mt-0.5">
                        {speakingId === msgId(i) ? (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {showQuick && (
              <div className="space-y-1.5 pt-2">
                <p className="text-[10px] text-fide-400 text-center">{t('chat.faqTitle')}</p>
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

          {/* Input */}
          <div className="border-t border-fide-700 p-3">
            <div className="flex gap-2 mb-2">
              <button onClick={() => { setShowQuick(!showQuick); if (!showQuick) setMessages((prev) => [...prev, { role: 'bot', text: t('chat.greetingFaq') }]); }}
                className="text-[10px] bg-fide-800 hover:bg-fide-700 text-fide-300 px-2 py-1 rounded transition">
                {showQuick ? t('chat.hideFaq') : t('chat.showFaq')}
              </button>
              <button onClick={resetFAQ}
                className="text-[10px] bg-fide-800 hover:bg-fide-700 text-fide-300 px-2 py-1 rounded transition">{t('chat.reset')}</button>
              {listening && (
                <span className="text-[10px] text-red-400 animate-pulse ml-auto">🎤 Escuchando...</span>
              )}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('chat.placeholder')}
                className="flex-1 bg-fide-800 border border-fide-600 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-amber-500 placeholder-fide-400" />
              <button type="button" onClick={listening ? stopListening : startListening}
                className={`px-2 py-2 rounded-lg text-xs font-medium transition ${listening ? 'bg-red-600 text-white animate-pulse' : 'bg-fide-700 hover:bg-fide-600 text-fide-300'}`}
                title={t('chat.stt')}>
                🎤
              </button>
              <button id="chat-send-btn" type="submit" disabled={!input.trim()}
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
