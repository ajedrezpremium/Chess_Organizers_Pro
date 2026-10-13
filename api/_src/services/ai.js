import config from '../config.js';
import { getSystemPrompt, normalizeAiLang } from '../data/fide-system-prompt.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

let localKnowledge = null;

async function getLocalKnowledge() {
  if (localKnowledge) return localKnowledge;
  try {
    const mod = await import('../data/fide-laws-2023.js');
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

// Preguntas sobre "reglas nuevas / novedades": no hay edición posterior a
// las Leyes 2023; respuesta estática honesta en cada idioma.
const NOVELTIES_HINTS = {
  es: ['nuevas reglas', 'reglas nuevas', 'nueva regla', 'novedad', 'novedades', 'últimas reglas', 'ultimas reglas', 'últimas', 'ultimas', 'nuevas', 'nuevo reglamento', 'reglamento', 'actualiz', '2024', '2025', '2026'],
  en: ["what's new", 'what is new', 'new rules', 'latest rules', 'newest', 'latest', 'rule change', 'rules changed', 'rule update', 'rules updated', 'updated rules', 'new regulation', '2024', '2025', '2026'],
  fr: ['nouvelle règle', 'nouveautés', 'dernières', 'dernieres', 'nouveaux', 'nouvelles', 'changements', 'modifi', '2024', '2025', '2026'],
  de: ['neue regeln', 'neuesten', 'neusten', 'neuerungen', 'änderung', 'geändert', 'aktualisiert', '2024', '2025', '2026'],
  pt: ['novas regras', 'regras novas', 'novidades', 'últimas', 'ultimas', 'novas', 'mudanças', 'atualiz', 'novo regulamento', 'regulamento', '2024', '2025', '2026'],
};

const NOVELTIES_ANSWER = {
  es: { answer: 'No hay una edición posterior a las Leyes FIDE 2023 (vigentes desde el 01/01/2023, handbook.fide.com): son las actuales. Puedo explicarte sus puntos clave o cualquier artículo concreto: jugada ilegal, pieza tocada, móvil, tablas, sanciones… Dime el tema.', article: null, title: 'Leyes FIDE 2023' },
  en: { answer: 'There is no edition after the FIDE Laws of Chess 2023 (in force since 01/01/2023, handbook.fide.com): they are current. I can explain key points or any specific article: illegal move, touch-move, mobile phones, draws, penalties… Tell me the topic.', article: null, title: 'FIDE Laws 2023' },
  fr: { answer: 'Il n’existe pas d’édition postérieure aux Lois FIDE 2023 (en vigueur depuis le 01/01/2023, handbook.fide.com). Je peux expliquer les points clés ou tout article : coup illégal, pièce touchée, mobile, nulles, sanctions… Précisez le sujet.', article: null, title: 'Lois FIDE 2023' },
  de: { answer: 'Es gibt keine Ausgabe nach den FIDE-Regeln 2023 (gültig seit 01.01.2023, handbook.fide.com). Ich kann Kernpunkte oder jeden Artikel erklären: regelwidrige Züge, berührte Figur, Handy, Remis, Strafen… Nenne das Thema.', article: null, title: 'FIDE-Regeln 2023' },
  pt: { answer: 'Não há edição posterior às Leis FIDE 2023 (vigentes desde 01/01/2023, handbook.fide.com). Posso explicar pontos-chave ou qualquer artigo: lance ilegal, peça tocada, celular, empates, sanções… Diga o tema.', article: null, title: 'Leis FIDE 2023' },
};

// Preguntas de tipo "qué sabes / conoce las leyes": demostrar experticia
const KNOWLEDGE_HINTS = {
  es: ['qué sabes', 'que sabes', 'conoces', 'conoces las leyes', 'sabes de las leyes', 'qué conoces', 'que conoces', 'experto', 'eres experto', 'conocimiento', 'domina'],
  en: ["what do you know", 'what do you know about', 'do you know', 'know the laws', 'are you expert', 'expert in', 'knowledge of'],
  fr: ['que savez-vous', 'savez-vous', 'connaissez-vous', 'connaissez les lois', 'expert', 'êtes-vous expert'],
  de: ['was wissen sie', 'was weißt du', 'kennen sie die regeln', 'kennst du', 'experte', 'bist du experte'],
  pt: ['o que você sabe', 'sabe das leis', 'conhece as leis', 'é especialista', 'conhecimento'],
};

const KNOWLEDGE_ANSWER = {
  es: { answer: 'Conozco en profundidad las Leyes FIDE 2023 (vigentes desde 01/01/2023): Art. 1-12 (reglas de juego), Apéndices A-G, Guidelines. Domino: jugadas ilegales (7.5), pieza tocada (4.3), tablas (5.1, 9.1-9.6), reloj (6.1-6.11), anotación (8.1-8.4), móvil (11.3), conducta (11.5), sanciones (12.9), apéndices A-G. También sistemas de emparejamiento (holandés, round-robin), desempates, emparejamientos por equipos, TRF, rating FIDE. Pregunta cualquier artículo o caso práctico.', article: null, title: 'Experto Leyes FIDE 2023' },
  en: { answer: 'I know the FIDE Laws 2023 in depth (in force since 01/01/2023): Arts. 1-12, Appendices A-G, Guidelines. Expert in: illegal moves (7.5), touch-move (4.3), draws (5.1, 9.1-9.6), clock (6.1-6.11), notation (8.1-8.4), mobile (11.3), conduct (11.5), penalties (12.9), appendices A-G. Also pairing systems (Dutch, RR), tie-breaks, team pairings, TRF, FIDE rating. Ask any article or practical case.', article: null, title: 'FIDE Laws 2023 Expert' },
  fr: { answer: 'Je connais en profondeur les Lois FIDE 2023 (en vigueur depuis 01/01/2023) : Arts. 1-12, Annexes A-G, Guidelines. Expert en : coups illégaux (7.5), pièce touchée (4.3), nulles (5.1, 9.1-9.6), pendules (6.1-6.11), notation (8.1-8.4), mobile (11.3), conduite (11.5), sanctions (12.9), annexes A-G. Aussi systèmes d\'appariement (hollandais, RR), départages, matchs par équipes, TRF, rating FIDE. Posez toute question.', article: null, title: 'Expert Lois FIDE 2023' },
  de: { answer: 'Ich kenne die FIDE-Regeln 2023 (gültig seit 01.01.2023) in der Tiefe: Art. 1-12, Anhänge A-G, Guidelines. Expertise: regelwidrige Züge (7.5), berührte Figur (4.3), Remis (5.1, 9.1-9.6), Uhren (6.1-6.11), Notation (8.1-8.4), Handy (11.3), Verhalten (11.5), Strafen (12.9), Anhänge A-G. Auch Paarungssysteme (holländisch, RR), Tie-Breaks, Mannschaftskämpfe, TRF, FIDE-Rating. Fragen Sie jeden Artikel.', article: null, title: 'FIDE-Regeln 2023 Experte' },
  pt: { answer: 'Conheço em profundidade as Leis FIDE 2023 (vigentes desde 01/01/2023): Arts. 1-12, Apêndices A-G, Guidelines. Domínio: lances ilegais (7.5), peça tocada (4.3), empates (5.1, 9.1-9.6), relógios (6.1-6.11), anotação (8.1-8.4), celular (11.3), conduta (11.5), sanções (12.9), apêndices A-G. Também sistemas de emparelhamento (holandês, RR), desempates, matchs por equipes, TRF, rating FIDE. Pergunte qualquer artigo.', article: null, title: 'Especialista Leis FIDE 2023' },
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
  if (NOVELTIES_HINTS[l].some((h) => q.includes(h))) {
    return { ...NOVELTIES_ANSWER[l], confidence: 'medium', related: [] };
  }
  if (KNOWLEDGE_HINTS[l].some((h) => q.includes(h))) {
    return { ...KNOWLEDGE_ANSWER[l], confidence: 'high', related: [] };
  }
  return { answer: t.generic, article: null, title: null, confidence: 'low', related: [] };
}

// Respuesta sin IA remota: 1) banco de casos prácticos, 2) base local de
// Leyes FIDE si responde con confianza; si no, el fallback multilingüe.
async function localAnswer(question, l) {
  try {
    const mod = await import('../data/arbiter-cases.js');
    if (mod?.searchArbiterCases) {
      const hits = mod.searchArbiterCases(question, 3);
      if (hits.length && hits[0]._score >= 10) {
        return {
          answer: hits[0].a, article: hits[0].article, title: hits[0].title,
          confidence: 'high', related: hits.slice(1).map((h) => ({ q: h.topic, article: h.article })),
          source: 'cases', lang: l,
        };
      }
    }
  } catch {}
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

  // Cadena de modelos: prueba en orden (free primero) hasta lograr respuesta.
  const chain = [...new Set([
    ...(config.ai.models || '').split(',').map((s) => s.trim()).filter(Boolean),
    config.ai.model,
  ].filter(Boolean))];

  for (const model of chain) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25000);
      let res;
      try {
        res = await fetch(OPENROUTER_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': config.publicUrl,
            'X-Title': 'Chess Organizers Pro',
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.3,
            max_tokens: 1024,
          }),
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) {
        console.warn(`OpenRouter ${model} error ${res.status}`);
        continue;
      }

      const data = await res.json();
      const answer = data.choices?.[0]?.message?.content?.trim();
      if (answer) {
        return { answer, source: 'ai', model: data.model || model, lang: l };
      }
      console.warn(`OpenRouter ${model} empty answer`);
    } catch (err) {
      console.warn(`OpenRouter ${model} failed:`, err.message);
    }
  }

  const local = await getLocalKnowledge();
  if (local?.getArbiterResponse) {
    const r = local.getArbiterResponse(question);
    if (r && r.confidence && r.confidence !== 'low') return { ...r, source: 'local', lang: l };
  }
  return { ...buildFallbackAnswer(question, l), source: 'fallback', lang: l };
}
