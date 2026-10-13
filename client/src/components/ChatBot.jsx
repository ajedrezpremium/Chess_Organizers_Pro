import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/context.jsx';

buildFAQ(t) {
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

const LANG_TAG = { es: 'es-ES', fr: 'fr-FR', de: 'de-DE', pt: 'pt-PT', en: 'en-US' };
const langTag = (locale) => LANG_TAG[locale] || 'es-ES';
const langPrefix = (locale) => (LANG_TAG[locale] || 'es-ES').split('-')[0].toLowerCase();

// Heurística de género por nombre de voz (la API no expone género).
const FEMALE_HINT = /female|femenina|féminine|weiblich|feminina|zira|samantha|sofia|sofía|lucia|lucía|paulina|mónica|monica|elena|carmen|maría|anna|emma|alice|amelie|amelie|leonor|inês|ines|marlene|petra|claudia|julia|laura|natalia|valentina|camila|isabella|victoria|helena|karen|moira|tessa|veena|kathy|aiko|haruka|yuna/i;
const MALE_HINT = /male|masculino|masculin|männlich|david|pablo|jorge|diego|carlos|miguel|antonio|manuel|francisco|alejandro|daniel|thomas|markus|stefan|michael|hans|pierre|jean|louis|arthur|hugo|lucas|gabriel|rafael|tiago|joão|pedro|miguel|james|john|daniel|george|alex/i;

function pickVoice(voices, locale, gender) {
  if (!voices.length) return null;
  const prefix = langPrefix(locale);
  const local = voices.filter((v) => (v.lang || '').toLowerCase().startsWith(prefix));
  const pool = local.length ? local : voices.filter((v) => (v.lang || '').toLowerCase().startsWith('en'));
  const list = pool.length ? pool : voices;
  const hint = gender === 'female' ? FEMALE_HINT : MALE_HINT;
  return (
    list.find((v) => hint.test(v.name)) ||
    list.find((v) => /google|microsoft|samsung|natural|neural|premium/i.test(v.name)) ||
    list[0]
  );
}

// Limpia emojis para que el TTS no los deletree.
function speechClean(text) {
  return String(text || '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem('cop-chat-prefs') || '{}'); } catch { return {}; }
}
function loadPos() {
  try {
    const p = JSON.parse(localStorage.getItem('cop-chat-pos') || 'null');
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return p;
  } catch {}
  return null;
}

const IconBtn = ({ title, onClick, children, active }) => (
  <button type="button" title={title} aria-label={title} onClick={onClick}
    className={`p-1.5 rounded-lg transition shrink-0 ${active ? 'bg-amber-600 text-white' : 'text-fide-300 hover:text-white hover:bg-fide-700'}`}>
    {children}
  </button>
);

const SpeakerIcon = ({ off }) => off ? (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
) : (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
);

const CopyIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
);

export default function ChatBot() {
  const { t, locale } = useI18n();
  const FAQ = buildFAQ(t);

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState([{ role: 'bot', text: t('chat.greeting') }]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [showQuick, setShowQuick] = useState(true);
  const [toast, setToast] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // ── TTS ──
  const prefs = useRef(loadPrefs());
  const [voices, setVoices] = useState([]);
  const [voiceGender, setVoiceGender] = useState(prefs.current.gender || 'female');
  const [voiceURI, setVoiceURI] = useState(prefs.current.voiceURI || '');
  const [rate, setRate] = useState(prefs.current.rate || 1);
  const [autoRead, setAutoRead] = useState(!!prefs.current.autoRead);
  const [speakingId, setSpeakingId] = useState(null);
  const [voiceOpen, setVoiceOpen] = useState(false);

  // ── STT ──
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [listenSecs, setListenSecs] = useState(0);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const sttFinalRef = useRef('');
  const sttActiveRef = useRef(false);
  const sendRef = useRef(null);

  // ── Drag ──
  const [pos, setPos] = useState(loadPos);
  const winRef = useRef(null);
  const dragRef = useRef(null);

  // ── Share ──
  const [shareOpen, setShareOpen] = useState(false);

  const endRef = useRef(null);
  const inputRef = useRef(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, thinking, open, expanded]);

  useEffect(() => {
    setMessages([{ role: 'bot', text: t('chat.greeting') }]);
    setShowQuick(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  // Cargar voces del sistema
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const load = () => setVoices(synth.getVoices() || []);
    load();
    synth.addEventListener('voiceschanged', load);
    return () => synth.removeEventListener('voiceschanged', load);
  }, []);

  // Persistir preferencias de voz
  useEffect(() => {
    prefs.current = { ...prefs.current, gender: voiceGender, voiceURI, rate, autoRead };
    try { localStorage.setItem('cop-chat-prefs', JSON.stringify(prefs.current)); } catch {}
  }, [voiceGender, voiceURI, rate, autoRead]);

  // Limpieza global
  useEffect(() => () => {
    try { window.speechSynthesis?.cancel(); } catch {}
    try { recognitionRef.current?.abort(); } catch {}
    clearInterval(timerRef.current);
    clearTimeout(toastTimer.current);
  }, []);

  // Escape cierra menús
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { setShareOpen(false); setVoiceOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const activeVoice = voices.find((v) => v.voiceURI === voiceURI)
    || pickVoice(voices, locale, voiceGender);

  // ── TTS ──────────────────────────────────────────────
  const stopSpeech = useCallback(() => {
    try { window.speechSynthesis?.cancel(); } catch {}
    setSpeakingId(null);
  }, []);

  const speak = useCallback((text, id) => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (speakingId === id) { stopSpeech(); return; }
    const clean = speechClean(text);
    if (!clean) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = langTag(locale);
    u.rate = rate;
    u.pitch = voiceGender === 'female' ? 1.15 : 0.85;
    const v = voices.find((x) => x.voiceURI === voiceURI) || pickVoice(voices, locale, voiceGender);
    if (v) u.voice = v;
    u.onend = () => setSpeakingId(null);
    u.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    synth.speak(u);
  }, [locale, rate, voiceGender, voiceURI, voices, speakingId, stopSpeech]);

  // ── Copiar / pegar ───────────────────────────────────
  const copyText = useCallback(async (text, id, doneMsg) => {
    try {
      await navigator.clipboard.writeText(text);
      if (id !== undefined) {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1500);
      }
      if (doneMsg) showToast(doneMsg);
    } catch {
      showToast(t('chat.pasteError'));
    }
  }, [showToast, t]);

  const copyTranscript = useCallback(() => {
    const text = messages.map((m) => `${m.role === 'user' ? '👤' : '♛'} ${m.text}`).join('\n\n');
    copyText(text, 'transcript', t('chat.copied'));
  }, [messages, copyText, t]);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInput((prev) => (prev ? `${prev}\n${text}` : text));
        inputRef.current?.focus();
      }
    } catch {
      showToast(t('chat.pasteError'));
      inputRef.current?.focus();
    }
  }, [showToast, t]);

  // ── Envío + IA ───────────────────────────────────────
  const pushBot = useCallback((text) => {
    setMessages((prev) => {
      const next = [...prev, { role: 'bot', text }];
      if (autoRead && window.speechSynthesis) {
        const clean = speechClean(text);
        if (clean) {
          try {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(clean);
            u.lang = langTag(locale);
            u.rate = rate;
            const v = pickVoice(window.speechSynthesis.getVoices() || [], locale, voiceGender);
            if (v) u.voice = v;
            u.onend = () => setSpeakingId(null);
            setSpeakingId('auto');
            window.speechSynthesis.speak(u);
          } catch {}
        }
      }
      return next;
    });
  }, [autoRead, locale, rate, voiceGender]);

  const localAnswer = useCallback((q) => {
    const qLower = q.toLowerCase();
    const isFideLawsTest = (qLower.includes('conoces') && qLower.includes('leyes'))
      || qLower.includes('fide laws') || qLower.includes('conheces as leis')
      || (qLower.includes('know') && qLower.includes('fide laws'));
    if (isFideLawsTest) return t('chat.fideLawsYes');
    const faq = FAQ.find((f) => f.q.toLowerCase().includes(qLower) || f.a.toLowerCase().includes(qLower));
    return faq ? faq.a : t('chat.notFound');
  }, [FAQ, t]);

  const sendMessage = useCallback(async (raw) => {
    const q = (raw ?? '').trim();
    if (!q || thinking) return;
    stopSpeech();
    setShowQuick(false);
    setShareOpen(false);
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setInput('');
    setInterim('');
    setThinking(true);
    const history = [...messages, { role: 'user', text: q }]
      .slice(-8)
      .map((m) => ({ role: m.role, text: m.text }));
    try {
      const resp = await Promise.race([
        api.askFide(q, history, locale),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 25000)),
      ]);
      const answer = resp && resp.answer ? resp.answer : localAnswer(q);
      pushBot(answer);
    } catch {
      // Sin IA (offline / error / timeout): respuesta local FAQ
      await new Promise((r) => setTimeout(r, 250));
      pushBot(localAnswer(q));
    } finally {
      setThinking(false);
    }
  }, [thinking, messages, locale, stopSpeech, pushBot, localAnswer]);

  const handleSend = () => sendMessage(input);
  sendRef.current = sendMessage;

  const ask = (question) => {
    const faq = FAQ.find((f) => f.q === question);
    if (!faq) return;
    stopSpeech();
    setShowQuick(false);
    setMessages((prev) => [...prev, { role: 'user', text: question }, { role: 'bot', text: faq.a }]);
    if (autoRead) speak(faq.a, `faq-${Date.now()}`);
  };

  const resetFAQ = () => {
    stopSpeech();
    setThinking(false);
    setMessages([{ role: 'bot', text: t('chat.greetingFaq') }]);
    setShowQuick(true);
  };

  // ── STT ──────────────────────────────────────────────
  const stopListening = useCallback((commit = true) => {
    sttActiveRef.current = false;
    clearInterval(timerRef.current);
    try { recognitionRef.current?.stop(); } catch {}
    recognitionRef.current = null;
    setListening(false);
    const final = sttFinalRef.current.trim();
    sttFinalRef.current = '';
    setInterim('');
    if (commit && final) setTimeout(() => sendRef.current?.(final), 350);
  }, []);

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast(t('chat.sttNoSupport')); return; }
    stopSpeech();
    if (listening) { stopListening(true); return; }
    const rec = new SR();
    rec.lang = langTag(locale);
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    sttFinalRef.current = '';
    setInterim('');
    rec.onresult = (event) => {
      let interimTxt = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) sttFinalRef.current += res[0].transcript + ' ';
        else interimTxt += res[0].transcript;
      }
      const live = `${sttFinalRef.current}${interimTxt}`.trim();
      setInterim(interimTxt);
      setInput(live);
    };
    rec.onerror = (event) => {
      const code = event?.error;
      if (code === 'not-allowed' || code === 'service-not-allowed') showToast(t('chat.sttDenied'));
      else if (code !== 'aborted') showToast(t('chat.sttNoSpeech'));
      sttActiveRef.current = false;
      clearInterval(timerRef.current);
      recognitionRef.current = null;
      setListening(false);
      setInterim('');
    };
    rec.onend = () => {
      clearInterval(timerRef.current);
      recognitionRef.current = null;
      if (!sttActiveRef.current) return;
      sttActiveRef.current = false;
      setListening(false);
      const final = sttFinalRef.current.trim();
      sttFinalRef.current = '';
      setInterim('');
      if (final) setTimeout(() => sendRef.current?.(final), 350);
    };
    recognitionRef.current = rec;
    sttActiveRef.current = true;
    setListenSecs(0);
    timerRef.current = setInterval(() => setListenSecs((s) => s + 1), 1000);
    setListening(true);
    try { rec.start(); } catch {
      setListening(false);
      clearInterval(timerRef.current);
    }
  };

  // ── Drag ─────────────────────────────────────────────
  const onHeaderPointerDown = (e) => {
    if (expanded) return;
    if (e.target.closest('button, select, input, a')) return;
    e.preventDefault();
    const rect = winRef.current?.getBoundingClientRect();
    const origin = pos || (rect ? { x: rect.left, y: rect.top } : { x: window.innerWidth - 420, y: window.innerHeight - 580 });
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: origin.x, origY: origin.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onHeaderPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const w = winRef.current?.offsetWidth || 384;
    const h = winRef.current?.offsetHeight || 500;
    const x = Math.min(Math.max(d.origX + e.clientX - d.startX, 8), Math.max(8, window.innerWidth - w - 8));
    const y = Math.min(Math.max(d.origY + e.clientY - d.startY, 8), Math.max(8, window.innerHeight - h - 8));
    setPos({ x, y });
  };
  const onHeaderPointerUp = () => {
    if (dragRef.current && pos) {
      try { localStorage.setItem('cop-chat-pos', JSON.stringify(pos)); } catch {}
    }
    dragRef.current = null;
  };

  const toggleOpen = () => {
    if (open) {
      stopSpeech();
      try { recognitionRef.current?.abort(); } catch {}
      clearInterval(timerRef.current);
      setListening(false);
      setShareOpen(false);
      setVoiceOpen(false);
    }
    setOpen(!open);
  };

  // ── Share RRSS ───────────────────────────────────────
  const lastExchange = () => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'bot' && messages[i].text !== t('chat.greeting') && messages[i].text !== t('chat.greetingFaq')) {
        const q = i > 0 && messages[i - 1].role === 'user' ? messages[i - 1].text : '';
        return { q, a: messages[i].text };
      }
    }
    return { q: '', a: t('chat.sharePromo') };
  };

  const shareLinks = () => {
    const { q, a } = lastExchange();
    const url = window.location.origin;
    const text = q ? `♛ ${q}\n${a}\n\n— ${t('chat.sharePromo')} ${url}` : `♛ ${a}\n\n— Chess Organizers Pro ${url}`;
    const enc = encodeURIComponent;
    return {
      text,
      x: `https://twitter.com/intent/tweet?text=${enc(text)}`,
      fb: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}&quote=${enc(text)}`,
      wa: `https://wa.me/?text=${enc(text)}`,
      tg: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`,
    };
  };

  const nativeShare = async () => {
    const { text } = shareLinks();
    try {
      if (navigator.share) await navigator.share({ title: 'Chess Organizers Pro', text, url: window.location.origin });
      else copyTranscript();
    } catch {}
    setShareOpen(false);
  };

  const openShare = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer,width=640,height=560');
    setShareOpen(false);
  };

  // ── Layout ───────────────────────────────────────────
  const winStyle = expanded
    ? {}
    : pos
      ? { left: pos.x, top: pos.y, bottom: 'auto', right: 'auto' }
      : {};
  const winClass = expanded
    ? 'fixed inset-3 sm:inset-6 z-50'
    : 'fixed bottom-24 right-6 z-50 w-[calc(100vw-3rem)] max-w-80 sm:w-96 sm:max-w-none';

  const autoSize = (e) => {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  return (
    <>
      <button onClick={toggleOpen}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-amber-600 hover:bg-amber-500 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
        title={t('chat.title')} aria-label={t('chat.title')}>
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
        )}
      </button>

      {open && (
        <div ref={winRef} style={winStyle}
          className={`${winClass} ${expanded ? '' : 'h-[500px] max-h-[calc(100vh-8rem)]'} bg-fide-900 border border-fide-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn`}>
          {/* Header (arrastrable) */}
          <div onPointerDown={onHeaderPointerDown} onPointerMove={onHeaderPointerMove} onPointerUp={onHeaderPointerUp} onPointerCancel={onHeaderPointerUp}
            className={`bg-fide-800 px-3 py-2.5 flex items-center gap-2 border-b border-fide-700 select-none ${expanded ? '' : 'cursor-move touch-none'}`}
            title={expanded ? '' : t('chat.moveHint')}>
            <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-sm font-bold shrink-0">♛</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{t('chat.title')}</div>
              <div className="text-[10px] text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> {t('chat.online')}
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              {/* Ajustes de voz */}
              <div className="relative">
                <IconBtn title={t('chat.voiceSettings')} active={voiceOpen} onClick={() => { setVoiceOpen(!voiceOpen); setShareOpen(false); }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </IconBtn>
                {voiceOpen && (
                  <div className="absolute right-0 top-9 w-60 bg-fide-800 border border-fide-600 rounded-xl shadow-2xl p-3 z-10 space-y-2.5 text-xs" onPointerDown={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setVoiceGender(voiceGender === 'female' ? 'male' : 'female')}
                        className="flex-1 bg-fide-700 hover:bg-fide-600 text-fide-200 px-2 py-1.5 rounded-lg transition text-xs"
                        title={voiceGender === 'female' ? t('chat.voiceMale') : t('chat.voiceFemale')}>
                        {voiceGender === 'female' ? `👩 ${t('chat.voiceFemale')}` : `👨 ${t('chat.voiceMale')}`}
                      </button>
                      <label className="flex items-center gap-1 text-fide-300 cursor-pointer" title={t('chat.autoRead')}>
                        <input type="checkbox" checked={autoRead} onChange={(e) => setAutoRead(e.target.checked)} className="accent-amber-500" />
                        🔊
                      </label>
                    </div>
                    <div>
                      <div className="text-[10px] text-fide-400 mb-1">{t('chat.voiceLabel')}</div>
                      <select value={voiceURI} onChange={(e) => setVoiceURI(e.target.value)}
                        className="w-full bg-fide-900 border border-fide-600 rounded-lg px-2 py-1.5 text-xs text-white outline-none">
                        <option value="">{t('chat.voiceAuto')} ({activeVoice?.name || '—'})</option>
                        {voices.filter((v) => (v.lang || '').toLowerCase().startsWith(langPrefix(locale))).map((v) => (
                          <option key={v.voiceURI} value={v.voiceURI}>{v.name} · {v.lang}</option>
                        ))}
                        {voices.filter((v) => !(v.lang || '').toLowerCase().startsWith(langPrefix(locale))).map((v) => (
                          <option key={v.voiceURI} value={v.voiceURI}>{v.name} · {v.lang}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-fide-400 mb-1">
                        <span>{t('chat.rateLabel')}</span><span>{rate.toFixed(1)}x</span>
                      </div>
                      <input type="range" min="0.5" max="1.5" step="0.1" value={rate} onChange={(e) => setRate(parseFloat(e.target.value))} className="w-full accent-amber-500" />
                    </div>
                    <button onClick={() => activeVoice && speak(t('chat.voiceTest'), 'test')}
                      className="w-full bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 px-2 py-1.5 rounded-lg transition text-xs">
                      ▶ {t('chat.voiceTest')}
                    </button>
                  </div>
                )}
              </div>
              {/* Compartir RRSS */}
              <div className="relative">
                <IconBtn title={t('chat.shareTitle')} active={shareOpen} onClick={() => { setShareOpen(!shareOpen); setVoiceOpen(false); }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                </IconBtn>
                {shareOpen && (
                  <div className="absolute right-0 top-9 w-52 bg-fide-800 border border-fide-600 rounded-xl shadow-2xl p-2 z-10" onPointerDown={(e) => e.stopPropagation()}>
                    <p className="text-[10px] text-fide-400 px-2 pt-1 pb-2">{t('chat.shareTitle')}</p>
                    {[
                      { label: 'X', url: shareLinks().x, icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg> },
                      { label: 'Facebook', url: shareLinks().fb, icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg> },
                      { label: 'WhatsApp', url: shareLinks().wa, icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg> },
                      { label: 'Telegram', url: shareLinks().tg, icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg> },
                    ].map((s) => (
                      <button key={s.label} onClick={() => openShare(s.url)}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-fide-200 hover:bg-fide-700 hover:text-white transition">
                        <span className="text-fide-300">{s.icon}</span>{s.label}
                      </button>
                    ))}
                    <button onClick={() => { copyText(shareLinks().text, 'share', t('chat.copied')); setShareOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-fide-200 hover:bg-fide-700 hover:text-white transition">
                      <CopyIcon />{t('chat.shareCopy')}
                    </button>
                    {typeof navigator.share === 'function' && (
                      <button onClick={nativeShare}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-fide-200 hover:bg-fide-700 hover:text-white transition">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        {t('chat.shareNative')}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {/* Pantalla completa */}
              <IconBtn title={expanded ? t('chat.collapse') : t('chat.expand')} onClick={() => { setExpanded(!expanded); setShareOpen(false); setVoiceOpen(false); }}>
                {expanded ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 9h4.5M15 9V4.5M15 9l5.5-5.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 15h4.5M15 15v4.5M15 15l5.5 5.5" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.5 3.5L9 9M9 9V4.5M9 9H4.5M20.5 3.5L15 9M15 9h4.5M15 9V4.5M3.5 20.5L9 15M9 15v4.5M9 15H4.5M20.5 20.5L15 15M15 15h4.5M15 15v4.5" /></svg>
                )}
              </IconBtn>
              {/* Cerrar */}
              <IconBtn title={t('chat.closeChat')} onClick={toggleOpen}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </IconBtn>
            </div>
          </div>

          {/* Messages */}
          <div className={`flex-1 overflow-y-auto p-3 space-y-3 ${expanded ? 'text-sm' : 'text-xs'}`}>
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] rounded-xl px-3 py-2 whitespace-pre-wrap group ${
                  m.role === 'user'
                    ? 'bg-amber-600 text-white rounded-br-sm'
                    : 'bg-fide-800 text-fide-200 rounded-bl-sm border border-fide-700/50'
                }`}>
                  <div>{m.text}</div>
                  <div className="flex items-center gap-1 mt-1 -mb-0.5 opacity-70 group-hover:opacity-100 transition">
                    {m.role === 'bot' && (
                      <button onClick={() => speak(m.text, i)} title={speakingId === i ? t('chat.ttsStop') : t('chat.tts')}
                        className={`p-1 rounded transition ${speakingId === i ? 'text-amber-400' : 'text-fide-400 hover:text-amber-400'}`}>
                        <SpeakerIcon off={speakingId === i} />
                      </button>
                    )}
                    <button onClick={() => copyText(m.text, i, t('chat.copiedMsg'))} title={t('chat.copyMsg')}
                      className={`p-1 rounded transition ${copiedId === i ? 'text-green-400' : 'text-fide-400 hover:text-amber-400'}`}>
                      {copiedId === i ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      ) : <CopyIcon />}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {thinking && (
              <div className="flex justify-start">
                <div className="bg-fide-800 border border-fide-700/50 rounded-xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="text-[10px] text-fide-400 ml-1">{t('chat.thinking')}</span>
                </div>
              </div>
            )}

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

          {/* Toast inline */}
          {toast && (
            <div className="mx-3 mb-1 bg-fide-950/95 border border-amber-600/40 text-amber-300 text-[11px] rounded-lg px-3 py-1.5 text-center animate-fadeIn">
              {toast}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-fide-700 p-3">
            <div className="flex gap-2 mb-2 items-center">
              <button onClick={() => { setShowQuick(!showQuick); if (!showQuick) setMessages((prev) => [...prev, { role: 'bot', text: t('chat.greetingFaq') }]); }}
                className="text-[10px] bg-fide-800 hover:bg-fide-700 text-fide-300 px-2 py-1 rounded transition">
                {showQuick ? t('chat.hideFaq') : t('chat.showFaq')}
              </button>
              <button onClick={resetFAQ}
                className="text-[10px] bg-fide-800 hover:bg-fide-700 text-fide-300 px-2 py-1 rounded transition">{t('chat.reset')}</button>
              <button onClick={copyTranscript}
                className="text-[10px] bg-fide-800 hover:bg-fide-700 text-fide-300 px-2 py-1 rounded transition" title={t('chat.copyChat')}>
                {copiedId === 'transcript' ? '✓' : '📋'}
              </button>
              {listening ? (
                <button onClick={() => stopListening(false)} className="text-[10px] text-red-400 animate-pulse ml-auto font-mono">
                  🎤 {t('chat.listening')} {listenSecs}s · {t('chat.stopListen')}
                </button>
              ) : interim ? (
                <span className="text-[10px] text-amber-400/80 italic ml-auto truncate max-w-[45%]">“{interim}…”</span>
              ) : null}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2 items-end">
              <textarea ref={inputRef} value={input} rows={1}
                onChange={(e) => { setInput(e.target.value); autoSize(e); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={listening ? `${t('chat.listening')}…` : t('chat.placeholder')}
                className="flex-1 bg-fide-800 border border-fide-600 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-amber-500 placeholder-fide-400 resize-none overflow-y-auto max-h-[120px]" />
              <button type="button" onClick={pasteFromClipboard}
                className="px-2 py-2 rounded-lg text-xs bg-fide-700 hover:bg-fide-600 text-fide-300 transition"
                title={t('chat.paste')}>
                📋
              </button>
              <button type="button" onClick={startListening}
                className={`px-2 py-2 rounded-lg text-xs font-medium transition ${listening ? 'bg-red-600 text-white animate-pulse' : 'bg-fide-700 hover:bg-fide-600 text-fide-300'}`}
                title={t('chat.stt')}>
                🎤
              </button>
              <button type="submit" disabled={!input.trim() || thinking}
                className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-xs font-medium transition" title={t('chat.send')}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
