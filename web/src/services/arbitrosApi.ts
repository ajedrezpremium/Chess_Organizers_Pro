// Simulación de la API para el módulo de árbitros
// En producción, estos serían llamados reales al backend

export interface Pairing {
  id: number;
  table: number;
  whitePlayer: {
    id: number;
    name: string;
    rating: number;
    title?: string;
    federation?: string;
  };
  blackPlayer: {
    id: number;
    name: string;
    : string;
    rating: number;
    title?: string;
    federation?: string;
  };
  result: '1-0' | '0-1' | '½-½' | null;
  status: 'pending' | 'played' | 'disputed';
}

export interface TournamentInfo {
  id: number;
  name: string;
  location: string;
  date: string;
  round: number;
  totalRounds: number;
  timeControl: string;
  arbiter: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'paused';
}

export interface Standing {
  id: number;
  name: string;
  rating: number;
  title?: string;
  federation?: string;
  score: number;
  performance?: number;
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface FairPlayAlert {
  id: number;
  playerId: number;
  playerName: string;
  table: number;
  correlation: number; // 0-100%
  engine: string;
  timestamp: string;
  status: 'new' | 'reviewed' | 'dismissed';
  details?: string;
}

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

// Simulación de funciones de API (en producción usar fetch/axios)
export const arbitrosApi = {
  // Torneos
  getTournamentInfo: async (tournamentId: number): Promise<TournamentInfo> => {
    // Simular delay de red
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // En producción: return fetch(`/api/tournaments/${tournamentId}`).then(res => res.json());
    return {
      id: 1,
      name: 'Madrid Open 2026',
      location: 'Madrid, España',
      date: '15-22 Julio 2026',
      round: 4,
      totalRounds: 9,
      timeControl: '90+30',
      arbiter: 'Carlos Martínez IA',
      status: 'in_progress'
    };
  },

  getPairings: async (tournamentId: number, round?: number): Promise<Pairing[]> => {
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // En producción: return fetch(`/api/tournaments/${tournamentId}/pairings${round ? `?round=${round}` : ''}`).then(res => res.json());
    return [
      {
        id: 1,
        table: 1,
        whitePlayer: {
          id: 1,
          name: 'Magnus Carlsen',
          rating: 2850,
          title: 'GM',
          federation: 'NOR'
        },
        blackPlayer: {
          id: 2,
          name: 'Ian Nepomniachtchi',
          rating: 2780,
          title: 'GM',
          federation: 'FID'
        },
        result: null,
        status: 'pending'
      },
      {
        id: 2,
        table: 2,
        whitePlayer: {
          id: 3,
          name: 'Ding Liren',
          rating: 2790,
          title: 'GM',
          federation: 'CHN'
        },
        blackPlayer: {
          id: 4,
          name: 'Fabiano Caruana',
          rating: 2775,
          title: 'GM',
          federation: 'USA'
        },
        result: '½-½',
        status: 'played'
      }
    ];
  },

  getStandings: async (tournamentId: number): Promise<Standing[]> => {
    await new Promise(resolve => setTimeout(reserve, 300));
    
    // En producción: return fetch(`/api/tournaments/${tournamentId}/standings`).then(res => res.json());
    return [
      {
        id: 1,
        name: 'Magnus Carlsen',
        rating: 2850,
        title: 'GM',
        federation: 'NOR',
        score: 3.0,
        performance: 2865,
        gamesPlayed: 3,
        wins: 3,
        draws: 0,
        losses: 0
      },
      {
        id: 2,
        name: 'Ding Liren',
        rating: 2790,
        title: 'GM',
        federation: 'CHN',
        score: 3.0,
        performance: 2820,
        gamesPlayed: 3,
        wins: 3,
        draws: 0,
        losses: 0
      }
    ];
  },

  // Resultados
  submitResult: async (tableId: number, result: '1-0' | '0-1' | '½-½'): Promise<boolean> => {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // En producción: 
    // return fetch(`/api/pairings/${tableId}/result`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ result })
    // }).then(res => res.ok);
    
    return true; // Simular éxito
  },

  // Alertas de Fair Play
  getFairPlayAlerts: async (tournamentId: number): Promise<FairPlayAlert[]> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // En producción: return fetch(`/api/tournaments/${tournamentId}/fairplay-alerts`).then(res => res.json());
    return [
      {
        id: 1,
        playerId: 5,
        playerName: 'Jugador de Prueba',
        table: 3,
        correlation: 96.8,
        engine: 'Stockfish 16',
        timestamp: new Date().toISOString(),
        status: 'new',
        details: 'Análisis estadístico muestra alta correlación con movimientos de motor en las últimas 3 partidas'
      }
    ];
  },

  updateFairPlayAlertStatus: async (alertId: number, status: 'reviewed' | 'dismissed'): Promise<boolean> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // En producción: 
    // return fetch(`/api/fairplay-alerts/${alertId}/status`, {
    //   method: 'PUT',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ status })
    // }).then(res => res.ok);
    
    return true;
  },

  // Notificaciones
  getNotifications: async (tournamentId: number, unreadOnly: boolean = false): Promise<Notification[]> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // En producción: 
    // return fetch(`/api/tournaments/${tournamentId}/notifications${unreadOnly ? '?unread=true' : ''}`).then(res => res.json());
    return [
      {
        id: '1',
        type: 'warning',
        title: 'Alerta de Fair Play',
        message: 'Jugador en Mesa 3 muestra 96.8% de correlación con Stockfish 16',
        timestamp: new Date().toISOString(),
        read: false
      },
      {
        id: '2',
        type: 'info',
        title: 'Emparejamientos publicados',
        message: 'Los emparejamientos de la ronda 4 han sido publicados',
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        read: true
      }
    ];
  },

  markNotificationAsRead: async (notificationId: string): Promise<boolean> => {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // En producción: 
    // return fetch(`/api/notifications/${notificationId}/read`, {
    //   method: 'PUT'
    // }).then(res => res.ok);
    
    return true;
  },

  // Agente FIDE Arbiter Assistant (nuestro diferencial clave)
  queryFIDEAssistant: async (question: string): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 1200)); // Simular latencia de procesamiento
    
    // En producción: 
    // return fetch(`/api/fide-assistant/query`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ question })
    // }).then(res => res.text());
    
    // Base de conocimiento simulada del agente FIDE
    const knowledgeBase: Record<string, string> = {
      'llegada tardia': 'Según el Artículo 11.9.1: Un jugador que llegue tarde al tablero perderá la partida, a menos que el árbitro decida lo contrario. La penalización por defecto es la pérdida de la partida.',
      'llegada tardía': 'Según el Artículo 11.9.1: Un jugador que llegue tarde al tablero perderá la partida, a menos que el árbitro decida lo contrario. La penalización por defecto es la pérdida de la partida.',
      'movimiento ilegal': 'Según el Artículo 7.5.1: Si se comprueba un movimiento ilegal, se reinstala la posición inmediatamente anterior a la irregularidad. Se otorgarán 2 minutos adicionales al reloj del adversario.',
      'jaque': 'Según el Artículo 3.9: Ninguna pieza puede hacer un movimiento que ponga o deje al propio rey en jaque.',
      'jaque al rey expuesto': 'Según el Artículo 3.9.b: Es ilegal hacer un movimiento que ponga o deje al propio rey en jaque.',
      'empate': 'Según el Artículo 9.1: Las partes pueden acordar tablas en cualquier momento del juego, sin necesidad de jugar un número determinado de jugadas.',
      'empate por acuerdo': 'Según el Artículo 9.1: Las partes pueden acordar tablas en cualquier momento del juego, sin necesidad de jugar un número determinado de jugadas.',
      'repetición de jugadas': 'Según el Artículo 9.2.1: La partida es tablas cuando se haya producido la misma posición, con el mismo jugador de turno y los mismos posibles movimientos, al menos tres veces.',
      'repetición de jugadas': 'Según el Artículo 9.2.1: La partida es tablas cuando se haya producido la misma posición, con el mismo jugador de turno y los mismos posibles movimientos, al menos tres veces.',
      'jaque perpetuo': 'Según el Artículo 9.2.2: La partida es tablas cuando se haya producido la misma posición, con el mismo jugador de turno y los mismos posibles movimientos, al menos cinco veces consecutivas.',
      'regla de las 50 jugadas': 'Según el Artículo 9.3.1: La partida es tablas si se han realizado cincuenta movimientos consecutivos por cada lado sin el movimiento de ningún peón y sin ninguna captura.',
      'regla de las 75 jugadas': 'Según el Artículo 9.3.2: La partida es tablas si se han realizado setenta y cinco movimientos consecutivos por cada lado sin el movimiento de ningún peón y sin ninguna captura.',
      'inmaterial': 'Según el Artículo 9.6: La partida es tablas cuando se llega a una posición en la que ni siquiera un lado puede dar jaque mate al rey del oponente con cualquier serie de jugadas legales.',
      'uso de dispositivo electronico': 'Según el Artículo 11.3.2: Está prohibido tener un dispositivo electrónico en funcionamiento en la zona de juego.',
      'uso de dispositivo electrónico': 'Según el Artículo 11.3.2: Está prohibido tener un dispositivo electrónico en funcionamiento en la zona de juego.',
      'notación': 'Según el Artículo 8.1: En la competición, durante la partida, los jugadores están obligados a anotar ella misma, movimiento tras movimiento, legiblemente y en la notación algebraica, el juego de ambos jugadores.',
      'reloj': 'Según el Artículo 6.1: En una partida se utilizan dos relojes. Cada reloj tiene una pantalla y una banderita.',
      'toca mover': 'Según el Artículo 4.1: Si el jugador que tiene el turno intencionalmente toca en el tablero una o más piezas propias, deberá mover la primera de estas piezas que pueda ser movida legalmente.',
      'toca tomar': 'Según el Artículo 4.2: Si el jugador que tiene el turno intencionalmente toca en el tablero una o más piezas del oponente, deberá capturar la primera de estas piezas que pueda ser capturada legalmente.',
      'enroque': 'Según el Artículo 3.8.1: El enroque está impedido temporalmente si la casilla por la cual el rey debe pasar, o la que ocupa el rey, o la que ocupa la torre, está atacada por una o más piezas del oponente.',
      'promoción': 'Según el Artículo 3.7.1: Cuando un peón llega a la fila más lejana desde su posición de partida, deberá ser sustituido, como parte del mismo movimiento, por una dama, una torre, un alfil o un caballo de elección del propio jugador.',
      'alfilero': 'Según el Artículo 3.6.b: El alfil se mueve en diagonal sobre cualquier número de casillas libres.',
      'caballo': 'Según el Artículo 3.5.b: El caballo se mueve casillando en forma de "L": dos casillas en una dirección y luego una casilla perpendicular a esa dirección, o viceversa.',
      'peon': 'Según el Artículo 3.4.b: El peón se mueve hacia adelante una casilla, si esa casilla está libre.',
      'rey': 'Según el Artículo 3.1.b: El rey se mueve a una casilla contigua que no esté atacada por una o más piezas del oponente.',
      'dama': 'Según el Artículo 3.2.b: La dama se mueve sobre cualquier número de casillas libres en horizontal, vertical o diagonal.',
      'torre': 'Según el Artículo 3.3.b: La torre se mueve sobre cualquier número de casillas libres en horizontal o vertical.',
      'absoluto': 'Según el Artículo 6.10: Un reloj se considera absoluto si, cuando se agota el tiempo de un jugador, el propio reloj indica que dicho jugador ha perdido la partida por dépassement de tiempo.',
      'analógico': 'Según el Artículo 6.10: Un reloj se considera analógico si indica el tiempo mediante manecillas y una esfera, típicamente con una banderita que indica el agotamiento del tiempo.',
      'digital': 'Según el Artículo 6.10: Un reloj se considera digital si indica el tiempo mediante números.',
      'incremento': 'Según el Artículo 6.3.b: Cuando se utiliza un incremento, el jugador recibe un tiempo adicional antes de hacer su movimiento.',
      'retardo': 'Según el Artículo 6.3.c: Cuando se utiliza un retardo, el reloj espera un periodo de tiempo antes de comenzar a contar el tiempo transcurrido.',
      'partida perdida': 'Según el Artículo 6.8: La partida se pierde por quien llegue tarde al tablero después de que haya terminado el tiempo para llegar.',
      'partida ganada': 'Según el Artículo 5.1.1: La partida se gana por el jugador que haya dado jaque mate al rey del oponente.',
      'partida tablas': 'Según el Artículo 5.2.1: La partida es tablas cuando cualquiera de las condiciones del Artículo 9.1 al 9.6 se cumple.',
      'abandono': 'Según el Artículo 5.3.1: La partida se pierde por abandono cuando un jugador anuncia su abandono o se retira del tablero mientras la partida está en curso.',
      'rendición': 'Según el Artículo 5.3.2: La partida se pierde por rendición cuando un jugador anuncia su rendición mientras la partida está en curso.',
      'empate': 'Según el Artículo 5.2: La partida termina en empate cuando se alcanza cualquiera de las condiciones establecidas en el Artículo 9.1 al 9.6.',
      'perdio por tiempo': 'Según el Artículo 6.9: Se pierde la partida quien, habiendo agotado su tiempo, no produzca el jaque mate requerido.',
      'gano por tiempo': 'Según el Artículo 6.9: Se gana la partida quien, habiendo agotado su tiempo, produzca el jaque mate requerido siempre que dicha posición se pueda alcanzar mediante una serie de jugadas legales.'
    };

    // Buscar coincidencia
    const lowerQuestion = question.toLowerCase().trim();
    
    // Primero buscar coincidencia exacta
    if (knowledgeBase[lowerQuestion]) {
      return knowledgeBase[lowerQuestion];
    }
    
    // Luego buscar coincidencias parciales
    for (const [key, value] of Object.entries(knowledgeBase)) {
      if (lowerQuestion.includes(key) || key.includes(lowerQuestion)) {
        return value;
      }
    }
    
    // Si no hay coincidencia, devolver respuesta genérica
    return `No se encontró una respuesta específica para su consulta: "${question}". Por favor, reformule su pregunta usando términos específicos de las Leyes FIDE del Ajedrez 2023. Puede intentar con términos como: llegada tardía, movimiento ilegal, jaque, empate, repetición de jugadas, regla de las 50 jugadas, uso de dispositivo electrónico, etc.`;
  }
};

export default arbitrosApi;