// src/i18n/chessGlossary.js
/**
 * Diccionario y Glosario Contextual Multilingüe para Gestión de Torneos y Ajedrez Profesional FIDE
 * Soporte oficial para Español (ES), Inglés (EN), Francés (FR) y Portugués (PT).
 */

export const CHESS_GLOSSARY = {
  // Sistemas de Emparejamiento
  pairingSystems: {
    dutchSwiss: {
      es: "Sistema Suizo Neerlandés (FIDE)",
      en: "Dutch Swiss System (FIDE)",
      fr: "Système Suisse Hollandais (FIDE)",
      pt: "Sistema Suíço Holandês (FIDE)"
    },
    roundRobin: {
      es: "Liga / Round Robin",
      en: "Round Robin / All-Play-All",
      fr: "Toutes Rondes / Round Robin",
      pt: "Todos contra Todos / Round Robin"
    },
    knockout: {
      es: "Eliminatoria Directa",
      en: "Knockout Bracket",
      fr: "Élimination Directe",
      pt: "Eliminatória Direta"
    },
    scheveningen: {
      es: "Sistema Scheveningen",
      en: "Scheveningen System",
      fr: "Système de Schéveningue",
      pt: "Sistema Scheveningen"
    }
  },

  // Criterios de Desempate FIDE
  tiebreaks: {
    buchholzCut1: {
      es: "Buchholz Menos Peor (Cut-1)",
      en: "Buchholz Cut 1",
      fr: "Buchholz Tronqué 1",
      pt: "Buchholz Cortar o Pior (Cut-1)"
    },
    buchholzTotal: {
      es: "Buchholz Total",
      en: "Buchholz Total",
      fr: "Buchholz Total",
      pt: "Buchholz Total"
    },
    sonnebornBerger: {
      es: "Sonneborn-Berger",
      en: "Sonneborn-Berger",
      fr: "Sonneborn-Berger",
      pt: "Sonneborn-Berger"
    },
    directEncounter: {
      es: "Encuentro Directo",
      en: "Direct Encounter",
      fr: "Confrontation Directe",
      pt: "Confronto Direto"
    },
    performanceElo: {
      es: "Performance ELO",
      en: "Performance Rating (TPR)",
      fr: "Performance ELO",
      pt: "Performance ELO"
    }
  },

  // Ritmos de Juego
  timeControls: {
    classical: {
      es: "Ajedrez Clásico (90m + 30s)",
      en: "Classical Chess (90m + 30s)",
      fr: "Échecs Classiques (90m + 30s)",
      pt: "Xadrez Clássico (90m + 30s)"
    },
    rapid: {
      es: "Ajedrez Rápido (15m + 10s)",
      en: "Rapid Chess (15m + 10s)",
      fr: "Échecs Rapides (15m + 10s)",
      pt: "Xadrez Rápido (15m + 10s)"
    },
    blitz: {
      es: "Relámpago / Blitz (3m + 2s)",
      en: "Blitz Chess (3m + 2s)",
      fr: "Blitz (3m + 2s)",
      pt: "Relâmpago / Blitz (3m + 2s)"
    },
    armageddon: {
      es: "Armagedón (5m vs 4m)",
      en: "Armageddon (5m vs 4m)",
      fr: "Armageddon (5m vs 4m)",
      pt: "Armagedão (5m vs 4m)"
    }
  },

  // Roles Arbitrales y Técnicos
  roles: {
    chiefArbiter: {
      es: "Árbitro Principal / Chief Arbiter",
      en: "Chief Arbiter",
      fr: "Arbitre Principal",
      pt: "Árbitro Principal"
    },
    deputyArbiter: {
      es: "Árbitro Adjunto",
      en: "Deputy Arbiter",
      fr: "Arbitre Adjoint",
      pt: "Árbitro Adjunto"
    },
    tournamentDirector: {
      es: "Director del Torneo",
      en: "Tournament Director",
      fr: "Directeur du Tournoi",
      pt: "Diretor do Torneio"
    },
    antiCheatingOfficer: {
      es: "Oficial Anti-Cheating FIDE",
      en: "FIDE Anti-Cheating Officer",
      fr: "Officiel Anti-Triche FIDE",
      pt: "Oficial Anti-Batota FIDE"
    }
  },

  // Infraestructura y Signage
  venue: {
    digitalSignage: {
      es: "Pantalla Gigante de Proyección",
      en: "Giant Display Signage",
      fr: "Écran Géant de Projection",
      pt: "Ecrã Gigante de Projeção"
    },
    byodMobile: {
      es: "Seguimiento Móvil BYOD",
      en: "BYOD Live Mobile Tracking",
      fr: "Suivi Mobile BYOD",
      pt: "Acompanhamento Móvel BYOD"
    },
    offlineVenue: {
      es: "Modo Pabellón Deportivo (Sin Conexión)",
      en: "Sports Hall Offline Mode",
      fr: "Mode Gymnase Hors Ligne",
      pt: "Modo Pavilhão Desportivo (Sem Ligação)"
    }
  }
};

/**
 * Helper para obtener un término técnico del glosario en el idioma actual
 */
export function getGlossaryTerm(category, termKey, lang = 'es') {
  const normalizedLang = (lang || 'es').slice(0, 2).toLowerCase();
  const validLang = ['es', 'en', 'fr', 'pt'].includes(normalizedLang) ? normalizedLang : 'es';
  return CHESS_GLOSSARY[category]?.[termKey]?.[validLang] || CHESS_GLOSSARY[category]?.[termKey]?.['es'] || termKey;
}
