import config from '../config.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = config.ai.model || 'google/gemini-2.0-flash-001';

let localKnowledge = null;

async function getLocalKnowledge() {
  if (localKnowledge) return localKnowledge;
  try {
    const mod = await import('../../client/src/data/fide-laws-2023.js');
    localKnowledge = mod;
    return mod;
  } catch {
    return null;
  }
}

function buildFallbackAnswer(question) {
  const q = question.toLowerCase();
  if (q.includes('ilegal') || q.includes('movimiento ilegal')) {
    return { answer: 'Artículo 7.1: Si durante una partida se descubre que una pieza ha sido desplazada por error, o se ha realizado un movimiento ilegal, la posición anterior al error debe restablecerse. Si la posición no puede restablecerse, la partida continuará desde la última posición identificable anterior al error. El árbitro aplicará las sanciones correspondientes.', article: '7.1', title: 'Movimientos ilegales', confidence: 'high', related: [] };
  }
  return { answer: 'Consulta las Leyes FIDE 2023 en la sección Artículos de este asistente para obtener información detallada sobre reglas específicas.', article: null, title: null, confidence: 'low', related: [] };
}

export async function askFideRules(question, history = []) {
  const apiKey = config.ai.openrouterKey;
  if (!apiKey) {
    const local = await getLocalKnowledge();
    if (local?.getArbiterResponse) {
      return { ...local.getArbiterResponse(question), source: 'local' };
    }
    return { ...buildFallbackAnswer(question), source: 'fallback' };
  }

  const messages = [
    { role: 'system', content: config.ai.systemPrompt },
    ...history.slice(-20).map(m => ({ role: m.role, content: m.text })),
    { role: 'user', content: question },
  ];

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': config.publicUrl,
        'X-Title': 'Chess Organizers Pro',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      console.warn(`OpenRouter error ${res.status}`);
      const local = await getLocalKnowledge();
      if (local?.getArbiterResponse) return { ...local.getArbiterResponse(question), source: 'local' };
      return { ...buildFallbackAnswer(question), source: 'fallback' };
    }

    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (answer) {
      return { answer, source: 'ai', model: data.model || MODEL };
    }

    const local = await getLocalKnowledge();
    if (local?.getArbiterResponse) return { ...local.getArbiterResponse(question), source: 'local' };
    return { ...buildFallbackAnswer(question), source: 'fallback' };
  } catch (err) {
    console.warn('OpenRouter fallback:', err.message);
    const local = await getLocalKnowledge();
    if (local?.getArbiterResponse) return { ...local.getArbiterResponse(question), source: 'local' };
    return { ...buildFallbackAnswer(question), source: 'fallback' };
  }
}
