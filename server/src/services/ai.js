import config from '../config.js';
import { getSystemPrompt, normalizeAiLang } from '../data/fide-system-prompt.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = config.ai.model || 'google/gemini-2.0-flash-001';

let localKnowledge = null;

async function getLocalKnowledge() {
  if (localKnowledge) return localKnowledge;
  try {
    // server/src/services → raíz del repo → client/src/data/...
    const mod = await import('../../../client/src/data/fide-laws-2023.js');
    localKnowledge = mod;
    return mod;
  } catch {
    return null;
  }
}

const FALLBACK_TEXT = {
  es: {
    illegal: { answer: 'Artículo 7.1: Si durante una partida se descubre que una pieza ha sido desplazada por error, o se ha realizado un movimiento ilegal, la posición anterior al error debe restablecerse. Si la posición no puede restablecerse, la partida continuará desde la última posición identificable anterior al error. El árbitro aplicará las sanciones correspondientes.', article: '7.1', title: 'Movimientos ilegales' },
    touched: { answer: 'Artículo 4.3: Si el jugador con el turno toca una pieza propia, debe moverla. Si toca una pieza del oponente, debe capturarla (si es posible). Artículo 4.6: Si es imposible identificar qué pieza se tocó primero, se considera que es la pieza propia del jugador y no la del oponente.', article: '4.3', title: 'Pieza tocada' },
    generic: 'Consulta las Leyes FIDE 2023 en la sección Artículos de este asistente para obtener información detallada sobre reglas específicas.',
  },
  en: {
    illegal: { answer: 'Article 7.1: If during a game it is found that a piece has been displaced by mistake, or an illegal move has been made, the position before the error must be reinstated. If the position cannot be reinstated, the game continues from the last identifiable position before the error. The arbiter shall apply the appropriate penalties.', article: '7.1', title: 'Illegal moves' },
    touched: { answer: 'Article 4.3: If the player having the move touches one of their own pieces, they must move it. If they touch an opponent\'s piece, they must capture it (if possible). Article 4.6: If it is impossible to identify which piece was touched first, it is deemed to be the player\'s own piece and not the opponent\'s.', article: '4.3', title: 'Touched piece' },
    generic: 'See the FIDE Laws of Chess 2023 in the Articles section of this assistant for detailed information on specific rules.',
  },
  fr: {
    illegal: { answer: 'Article 7.1 : Si pendant une partie on constate qu\'une pièce a été déplacée par erreur, ou qu\'un coup illégal a été joué, la position antérieure à l\'erreur doit être rétablie. Si la position ne peut pas être rétablie, la partie continue depuis la dernière position identifiable avant l\'erreur. L\'arbitre appliquera les sanctions appropriées.', article: '7.1', title: 'Coups illégaux' },
    touched: { answer: 'Article 4.3 : Si le joueur ayant le trait touche une de ses propres pièces, il doit la jouer. S\'il touche une pièce adverse, il doit la prendre (si possible). Article 4.6 : S\'il est impossible d\'identifier quelle pièce a été touchée en premier, elle est réputée être la pièce du joueur et non celle de l\'adversaire.', article: '4.3', title: 'Pièce touchée' },
    generic: 'Consultez les Lois FIDE 2023 dans la section Articles de cet assistant pour des informations détaillées sur des règles spécifiques.',
  },
  de: {
    illegal: { answer: 'Artikel 7.1: Wird während einer Partie festgestellt, dass eine Figur versehentlich verschoben oder ein regelwidriger Zug ausgeführt wurde, muss die Stellung vor dem Fehler wiederhergestellt werden. Kann die Stellung nicht wiederhergestellt werden, wird die Partie ab der letzten identifizierbaren Stellung vor dem Fehler fortgesetzt. Der Schiedsrichter verhängt die entsprechenden Strafen.', article: '7.1', title: 'Regelwidrige Züge' },
    touched: { answer: 'Artikel 4.3: Berührt der am Zug befindliche Spieler eine eigene Figur, muss er sie ziehen. Berührt er eine gegnerische Figur, muss er sie schlagen (falls möglich). Artikel 4.6: Lässt sich nicht feststellen, welche Figur zuerst berührt wurde, gilt sie als eigene Figur des Spielers und nicht als gegnerische.', article: '4.3', title: 'Berührte Figur' },
    generic: 'Siehe FIDE-Schachregeln 2023 im Abschnitt Artikel dieses Assistenten für Details zu bestimmten Regeln.',
  },
  pt: {
    illegal: { answer: 'Artigo 7.1: Se durante uma partida se descobrir que uma peça foi deslocada por erro, ou que um lance ilegal foi feito, a posição anterior ao erro deve ser restabelecida. Se a posição não puder ser restabelecida, a partida continua da última posição identificável anterior ao erro. O árbitro aplicará as sanções correspondentes.', article: '7.1', title: 'Lances ilegais' },
    touched: { answer: 'Artigo 4.3: Se o jogador com o turno tocar uma peça própria, deve movê-la. Se tocar uma peça do oponente, deve capturá-la (se possível). Artigo 4.6: Se for impossível identificar qual peça foi tocada primeiro, considera-se que é a peça do próprio jogador e não a do oponente.', article: '4.3', title: 'Peça tocada' },
    generic: 'Consulte as Leis FIDE 2023 na seção Artigos deste assistente para informações detalhadas sobre regras específicas.',
  },
};

const ILLEGAL_HINTS = {
  es: ['ilegal', 'movimiento ilegal'],
  en: ['illegal', 'illegal move'],
  fr: ['illégal', 'coup illégal'],
  de: ['regelwidrig', 'illegal'],
  pt: ['ilegal', 'lance ilegal'],
};

const TOUCH_HINTS = {
  es: ['pieza tocada', 'tocar', 'tocada'],
  en: ['touched', 'touch-move', 'touch move'],
  fr: ['touchée', 'toucher', 'pièce touchée'],
  de: ['berührt', 'berühren'],
  pt: ['tocada', 'tocar', 'peça tocada'],
};

function buildFallbackAnswer(question, lang) {
  const l = normalizeAiLang(lang);
  const t = FALLBACK_TEXT[l];
  const q = question.toLowerCase();
  if (ILLEGAL_HINTS[l].some((h) => q.includes(h))) {
    return { ...t.illegal, confidence: 'high', related: [] };
  }
  if (TOUCH_HINTS[l].some((h) => q.includes(h))) {
    return { ...t.touched, confidence: 'high', related: [] };
  }
  return { answer: t.generic, article: null, title: null, confidence: 'low', related: [] };
}

// Respuesta sin IA remota: usa la base local de Leyes FIDE si responde con
// confianza; si no, el fallback multilingüe (cubre los temas más comunes
// — jugada ilegal, pieza tocada — en el idioma pedido).
async function localAnswer(question, l) {
  const local = await getLocalKnowledge();
  if (local?.getArbiterResponse) {
    const r = local.getArbiterResponse(question);
    if (r && r.confidence && r.confidence !== 'low') {
      return { ...r, source: 'local', lang: l };
    }
  }
  return { ...buildFallbackAnswer(question, l), source: 'fallback', lang: l };
}

export async function askFideRules(question, history = [], lang = 'es') {
  const l = normalizeAiLang(lang);
  const apiKey = config.ai.openrouterKey;
  if (!apiKey) {
    return localAnswer(question, l);
  }

  const messages = [
    { role: 'system', content: getSystemPrompt(l) },
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
      return localAnswer(question, l);
    }

    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (answer) {
      return { answer, source: 'ai', model: data.model || MODEL, lang: l };
    }

    const local = await getLocalKnowledge();
    if (local?.getArbiterResponse) return { ...local.getArbiterResponse(question), source: 'local', lang: l };
    return { ...buildFallbackAnswer(question, l), source: 'fallback', lang: l };
  } catch (err) {
    console.warn('OpenRouter fallback:', err.message);
    const local = await getLocalKnowledge();
    if (local?.getArbiterResponse) return { ...local.getArbiterResponse(question), source: 'local', lang: l };
    return { ...buildFallbackAnswer(question, l), source: 'fallback', lang: l };
  }
}
