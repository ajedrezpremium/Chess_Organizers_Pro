/**
 * FIDE Laws of Chess 2023 — Conocimiento Base para el Árbitro IA
 * Fuente oficial: https://handbook.fide.com/chapter/E012023
 * Aprobadas por la Asamblea General FIDE el 07/08/2022
 * Vigentes desde el 01/01/2023
 */

export const FIDE_LAWS_2023 = {
  meta: {
    title: 'FIDE Laws of Chess',
    approved: '07/08/2022',
    effectiveFrom: '01/01/2023',
    source: 'https://handbook.fide.com/chapter/E012023',
  },

  articles: [
    {
      id: 'intro',
      title: 'Introducción',
      summary: 'Las Leyes FIDE rigen el juego de ajedrez sobre el tablero. Tienen dos partes: 1. Reglas Básicas de Juego y 2. Reglas Competitivas.',
      rules: [
        'Las Leyes del Ajedrez cubren el juego sobre el tablero.',
        'El texto en inglés es la versión auténtica adoptada en el 93er Congreso FIDE en Chennai, India.',
        'Condición necesaria para que una partida sea homologada por FIDE es que se juegue según estas leyes.',
      ],
    },
    {
      id: '1',
      title: 'Artículo 1 — Naturaleza y objetivos del juego de ajedrez',
      rules: [
        '1.1: El juego se juega entre dos oponentes que mueven sus piezas en un tablero cuadrado llamado "tablero de ajedrez".',
        '1.2: El jugador con piezas de color claro (Blancas) hace el primer movimiento; luego los jugadores mueven alternadamente.',
        '1.3: Un jugador "tiene el turno" cuando el movimiento de su oponente ha sido "realizado".',
        '1.4: El objetivo es colocar al rey del oponente "bajo ataque" de tal manera que el oponente no tenga ningún movimiento legal (jaque mate).',
        '1.4.1: El jugador que logra dar jaque mate gana la partida.',
        '1.4.2: El oponente cuyo rey ha sido ajedreado pierde la partida.',
        '1.5: Si ningún jugador puede dar jaque mate al rey del oponente, la partida es tablas.',
      ],
    },
    {
      id: '2',
      title: 'Artículo 2 — Posición inicial de las piezas',
      rules: [
        '2.1: El tablero se compone de una cuadrícula de 8x8 con 64 casillas iguales, alternando claras y oscuras. El ángulo inferior derecho del jugador debe ser una casilla blanca.',
        '2.2: Al comienzo Blancas tienen 16 piezas de color claro; Negras tienen 16 piezas de color oscuro.',
        '2.3: La posición inicial: torres en las esquinas, caballos junto a ellas, alfiles, luego reina en su color y rey en la casilla restante.',
        '2.4: Las ocho columnas verticales se llaman "columnas". Las ocho filas horizontales se llaman "filas". Las líneas diagonales del mismo color se llaman "diagonales".',
      ],
    },
    {
      id: '3',
      title: 'Artículo 3 — Movimientos de las piezas',
      rules: [
        '3.1: No está permitido mover una pieza a una casilla ocupada por una pieza del mismo color.',
        '3.1.1: Si una pieza se mueve a una casilla ocupada por una pieza del oponente, esta es capturada y retirada del tablero como parte del mismo movimiento.',
        '3.2: El alfil puede moverse a cualquier casilla a lo largo de una diagonal.',
        '3.3: La torre puede moverse a cualquier casilla a lo largo de la columna o la fila.',
        '3.4: La reina puede moverse a cualquier casilla a lo largo de la columna, la fila o la diagonal.',
        '3.5: Alfil, torre y reina NO pueden pasar sobre piezas intermedias.',
        '3.6: El caballo puede moverse a una de las casillas más cercanas a la que se encuentra, pero NO en la misma fila, columna o diagonal (movimiento en "L").',
        '3.7: El peón: (a) puede avanzar a la casilla inmediatamente frente a él en la misma columna, si está desocupada; (b) en su primer movimiento puede avanzar dos casillas; (c) puede capturar en diagonal hacia adelante.',
        '3.7.3.1: Captura al paso (en passant): un peón en la misma fila que un peón oponente que acaba de avanzar dos casillas puede capturarlo como si solo hubiera avanzado una.',
        '3.7.3.2: Esta captura solo es legal en el movimiento inmediatamente siguiente a ese avance.',
        '3.7.3.3: Cuando un peón llega a la última fila, debe ser promovido inmediatamente a reina, torre, alfil o caballo del mismo color.',
        '3.8.1: El rey puede moverse a cualquier casilla adyacente.',
        '3.8.2: Enroque: movimiento del rey con una torre del mismo color a lo largo de la primera fila. El rey se mueve dos casillas hacia la torre y la torre pasa al otro lado del rey.',
        '3.8.2.1: El derecho a enrocar se pierde si: el rey ya se ha movido; o con una torre que ya se ha movido.',
        '3.8.2.2: El enroque está temporalmente impedido si: la casilla del rey, la que debe cruzar o la de destino está atacada; o hay piezas entre el rey y la torre.',
        '3.9.1: El rey está en jaque si está atacado por una o más piezas del oponente.',
        '3.9.2: Ninguna pieza puede moverse si eso deja al propio rey en jaque.',
        '3.10.1: Un movimiento es legal cuando cumple todos los requisitos de los artículos 3.1 a 3.9.',
        '3.10.2: Un movimiento es ilegal cuando no cumple esos requisitos.',
        '3.10.3: Una posición es ilegal cuando no puede haberse alcanzado mediante ninguna serie de movimientos legales.',
      ],
    },
    {
      id: '4',
      title: 'Artículo 4 — El acto de mover las piezas',
      rules: [
        '4.1: Cada movimiento debe jugarse con una sola mano.',
        '4.2.1: Solo el jugador con el turno puede ajustar piezas en sus casillas, siempre que exprese su intención (ej. "j\'adoube" o "ajusto").',
        '4.3: Si el jugador con el turno toca una pieza propia, debe moverla. Si toca una pieza del oponente, debe capturarla (si es posible).',
        '4.4.1: Si el jugador toca su rey y una torre simultáneamente, debe enrocar hacia ese lado si es legal.',
        '4.4.2: Si el jugador toca intencionalmente primero la torre y luego el rey, no puede enrocar hacia ese lado.',
        '4.6: La promoción puede realizarse de varias formas; el peón no tiene que ser colocado en la casilla de llegada.',
        '4.7: Una vez que una pieza se ha soltado en una casilla, no puede moverse a otra casilla en ese movimiento.',
        '4.8: Un jugador pierde el derecho a reclamar violaciones de los artículos 4.1 a 4.7 una vez que toca una pieza con intención de moverla o capturarla.',
      ],
    },
    {
      id: '5',
      title: 'Artículo 5 — Finalización de la partida',
      rules: [
        '5.1.1: La partida la gana el jugador que da jaque mate al rey del oponente.',
        '5.1.2: La partida la pierde el jugador que declara rendirse (tablas si el oponente no puede dar mate).',
        '5.2.1: Tablas por ahogado: el jugador con el turno no tiene movimiento legal y su rey no está en jaque.',
        '5.2.2: Tablas por posición muerta: ningún jugador puede dar jaque mate al rey del oponente con ninguna serie de movimientos legales.',
        '5.2.3: Tablas por acuerdo entre los dos jugadores, siempre que ambos hayan hecho al menos un movimiento.',
      ],
    },
    {
      id: '6',
      title: 'Artículo 6 — El reloj de ajedrez',
      rules: [
        '6.1: El reloj de ajedrez tiene dos indicadores de tiempo conectados de manera que solo uno puede funcionar a la vez. "Caída de bandera" = expiración del tiempo asignado.',
        '6.2.1: Tras cada movimiento, el jugador pausa su reloj y activa el del oponente (presiona el reloj). Esto "completa" el movimiento.',
        '6.2.3: El jugador debe presionar el reloj con la misma mano con la que hizo el movimiento. Prohibido mantener el dedo sobre el reloj.',
        '6.2.4: Prohibido presionar el reloj con fuerza, recogerlo, presionarlo antes de mover o volcarlo.',
        '6.7.1: Las bases del evento deben especificar el tiempo de incomparecencia (default time). Si no se especifica, es cero. El jugador que llegue tarde pierde, salvo criterio del árbitro.',
        '6.8: La bandera se considera caída cuando el árbitro lo observa o un jugador hace una reclamación válida.',
        '6.9: Si un jugador no completa el número prescrito de movimientos en el tiempo asignado, pierde. Pero si el oponente no puede dar jaque mate, son tablas.',
        '6.10.1: Cualquier indicación del reloj es definitiva en ausencia de defecto evidente.',
      ],
    },
    {
      id: '7',
      title: 'Artículo 7 — Irregularidades',
      rules: [
        '7.2.1: Si la posición inicial de las piezas era incorrecta, la partida se cancela y se juega una nueva.',
        '7.2.2: Si el tablero fue colocado incorrectamente (artículo 2.1), la partida continúa pero la posición se transfiere a un tablero correctamente colocado.',
        '7.3: Si comenzó con los colores invertidos y se han hecho menos de 10 movimientos por cada jugador, se interrumpe y se juega una nueva. Con 10 o más movimientos, continúa.',
        '7.4.1: Si un jugador desplaza una o más piezas, debe restablecer la posición correcta en su propio tiempo.',
        '7.5.1: Un movimiento ilegal se completa cuando el jugador presiona el reloj. Se restablece la posición anterior y se aplican los artículos 4.3 y 4.7 al movimiento sustituto.',
        '7.5.2: Si un jugador avanzó un peón a la última fila y presionó el reloj sin reemplazarlo, el movimiento es ilegal. El peón se reemplaza con una reina del mismo color.',
        '7.5.3: Presionar el reloj sin mover se considera y sanciona como movimiento ilegal.',
        '7.5.4: Usar dos manos para un solo movimiento (enroque, captura, promoción) y presionar el reloj, se trata como movimiento ilegal.',
        '7.5.5: Por el PRIMER movimiento ilegal completado: el árbitro da 2 minutos extra al oponente. Por el SEGUNDO movimiento ilegal del mismo jugador: el árbitro declara la partida perdida por ese jugador.',
      ],
    },
    {
      id: '8',
      title: 'Artículo 8 — Registro de los movimientos',
      rules: [
        '8.1.1: Durante la partida, cada jugador debe registrar sus movimientos y los de su oponente de manera correcta, movimiento a movimiento, con claridad y legibilidad.',
        '8.1.1.1: Usando la notación algebraica en la planilla de anotación en papel.',
        '8.1.1.2: Introduciendo movimientos en la planilla electrónica certificada por FIDE.',
        '8.1.2: Está prohibido anotar movimientos por anticipado, salvo al reclamar tablas por repetición o regla de los 50 movimientos.',
        '8.1.5: Ambos jugadores deben registrar la oferta de tablas en la planilla con el símbolo (=).',
        '8.2: La planilla debe ser visible para el árbitro durante toda la partida.',
        '8.4: Si un jugador tiene menos de 5 minutos y no recibe al menos 30 segundos adicionales por movimiento, no está obligado a registrar movimientos durante ese período.',
        '8.7: Al finalizar la partida, ambos jugadores deben indicar el resultado firmando ambas planillas.',
      ],
    },
    {
      id: '9',
      title: 'Artículo 9 — Partida tablas',
      rules: [
        '9.1.2.1: Quien ofrezca tablas debe hacerlo DESPUÉS de mover y ANTES de presionar el reloj. La oferta no puede retirarse.',
        '9.2: Tablas por repetición de posición: el jugador con el turno puede reclamar tablas cuando la misma posición va a aparecer o ha aparecido por TERCERA VEZ.',
        '9.2.3: Las posiciones son iguales si y solo si el mismo jugador tiene el turno, piezas del mismo tipo y color ocupan las mismas casillas y los posibles movimientos son los mismos.',
        '9.3: Tablas por regla de los 50 movimientos: el jugador con el turno puede reclamar si los últimos 50 movimientos de cada jugador se han completado sin mover ningún peón y sin captura.',
        '9.5.3: Si la reclamación es incorrecta, el árbitro añade 2 minutos al tiempo restante del oponente.',
        '9.6.1: Tablas automáticas si la misma posición aparece 5 VECES.',
        '9.6.2: Tablas automáticas si se hacen 75 MOVIMIENTOS de cada jugador sin movimiento de peón ni captura.',
      ],
    },
    {
      id: '10',
      title: 'Artículo 10 — Puntos',
      rules: [
        '10.1: El ganador recibe 1 punto, el perdedor 0 puntos, las tablas dan ½ punto a cada jugador.',
        '10.2: La puntuación total de cualquier partida nunca puede exceder el máximo normalmente otorgado. No se admiten puntuaciones como ¾-¼.',
      ],
    },
    {
      id: '11',
      title: 'Artículo 11 — Conducta de los jugadores',
      rules: [
        '11.1: Los jugadores no realizarán ninguna acción que desprestigie el ajedrez.',
        '11.2.3.1: Solo con permiso del árbitro puede un jugador abandonar el recinto de juego.',
        '11.2.3.2: Solo con permiso del árbitro puede el jugador con el turno abandonar el área de juego.',
        '11.3.1: Durante la partida, está prohibido usar notas, fuentes de información o consejos, o analizar en otro tablero.',
        '11.3.2: Durante la partida, está prohibido tener cualquier dispositivo electrónico no aprobado por el árbitro en el recinto de juego.',
        '11.3.2.2: Si es evidente que un jugador tiene dicho dispositivo, pierde la partida. El oponente gana.',
        '11.5: Está prohibido distraer o molestar al oponente de cualquier manera.',
        '11.7: La negativa persistente a cumplir las Leyes se sanciona con pérdida de la partida.',
        '11.9: Un jugador tiene derecho a solicitar al árbitro una explicación sobre puntos concretos de las Leyes.',
        '11.10: Un jugador puede apelar cualquier decisión del árbitro, aunque haya firmado la planilla.',
      ],
    },
    {
      id: '12',
      title: 'Artículo 12 — El papel del árbitro',
      rules: [
        '12.1: El árbitro velará por que se observen las Leyes del Ajedrez.',
        '12.2: El árbitro debe garantizar juego limpio; actuar en el mejor interés de la competición; mantener un buen ambiente de juego; garantizar que los jugadores no sean perturbados; supervisar el progreso.',
        '12.3: El árbitro observará las partidas, especialmente cuando los jugadores estén escasos de tiempo.',
        '12.6: El árbitro no debe intervenir en una partida salvo en los casos descritos por las Leyes.',
        '12.7: Si alguien observa una irregularidad, solo puede informar al árbitro. Los jugadores no deben interferir en otras partidas.',
        '12.8: Está prohibido usar teléfono móvil o cualquier dispositivo de comunicación en el recinto de juego.',
        '12.9: El árbitro dispone de las siguientes sanciones: (1) advertencia; (2) añadir tiempo al oponente; (3) reducir el tiempo del infractor; (4) otorgar los puntos máximos al oponente; (5) reducir los puntos del infractor; (6) declarar la partida perdida; (7) multa anunciada previamente; (8) exclusión de una o varias rondas; (9) expulsión de la competición.',
      ],
    },
    {
      id: 'A',
      title: 'Apéndice A — Ajedrez Rápido (Rapid)',
      rules: [
        'A.1: Partida rápida: tiempo de más de 10 minutos y menos de 60 minutos para cada jugador, o tiempo asignado + 60 veces el incremento entre 10 y 60 minutos.',
        'A.2: Los jugadores no necesitan registrar movimientos, pero no pierden sus derechos basados en la planilla.',
        'A.3: Las penalizaciones de los artículos 7 y 9 son de UN MINUTO (en lugar de dos).',
        'A.5.2: En Rápido, si el árbitro observa un movimiento ilegal, puede actuar si el oponente no ha hecho su siguiente movimiento. Si el oponente no reclama, el movimiento ilegal permanece.',
      ],
    },
    {
      id: 'B',
      title: 'Apéndice B — Ajedrez Relámpago (Blitz)',
      rules: [
        'B.1: Partida relámpago: tiempo de 10 minutos o menos para cada jugador, o tiempo + 60 veces el incremento ≤ 10 minutos.',
        'B.3: Se aplican las reglas del Rápido (A.2, A.3, A.5).',
      ],
    },
    {
      id: 'C',
      title: 'Apéndice C — Notación algebraica',
      rules: [
        'FIDE reconoce solo la notación algebraica para sus torneos y partidas.',
        'Piezas: K=Rey, Q=Reina, R=Torre, B=Alfil, N=Caballo (para evitar ambigüedad con K=Rey).',
        'Columnas: a-h (de izquierda a derecha para Blancas).',
        'Filas: 1-8 (de abajo hacia arriba para Blancas).',
        'Cada casilla tiene una combinación única de letra y número (ej. e4, d5).',
        'Captura: Bxe5, Nxf3. Peón: exd5, gxf3.',
        'Enroque de rey: 0-0. Enroque de dama: 0-0-0.',
        'Jaque: + Jaque doble: ++ Jaque mate: #',
        'Promoción: e8=Q',
        'Peón al paso (en passant): exd6 e.p.',
      ],
    },
  ],

  // Preguntas frecuentes con sus respuestas basadas en los artículos
  faq: [
    {
      q: '¿Qué pasa si un jugador hace un movimiento ilegal?',
      a: 'Artículo 7.5.5: Por el primer movimiento ilegal completado, el árbitro da 2 minutos extra al oponente. Por el segundo movimiento ilegal del mismo jugador, el árbitro declara la partida perdida por ese jugador. En Rápido (Apéndice A.3), la penalización es de 1 minuto en lugar de 2.',
      article: '7.5',
    },
    {
      q: '¿Cuándo se pueden reclamar tablas por repetición?',
      a: 'Artículo 9.2: El jugador con el turno puede reclamar cuando la misma posición va a aparecer (3ª vez) indicando su movimiento antes de hacerlo, o cuando ya ha aparecido por 3ª vez. Artículo 9.6.1: Tablas automáticas cuando la posición se repite 5 veces.',
      article: '9.2',
    },
    {
      q: '¿Qué es la regla de los 50 movimientos?',
      a: 'Artículo 9.3: Se pueden reclamar tablas si en los últimos 50 movimientos de cada jugador no se ha movido ningún peón y no ha habido ninguna captura. Artículo 9.6.2: Tablas automáticas si se superan los 75 movimientos de cada jugador sin peón ni captura.',
      article: '9.3',
    },
    {
      q: '¿Qué hacer si toco una pieza?',
      a: 'Artículo 4.3: Si el jugador con el turno toca una pieza propia, debe moverla. Si toca una pieza del oponente, debe capturarla (si es posible). Artículo 4.6: Si es imposible identificar qué pieza se tocó primero, se considera que es la pieza propia del jugador y no la del oponente.',
      article: '4.3',
    },
    {
      q: '¿Qué significa "j\'adoube"?',
      a: 'Artículo 4.2.1: Solo el jugador con el turno puede ajustar una o más piezas en sus casillas, siempre que exprese su intención previamente, por ejemplo diciendo "j\'adoube" (francés: "ajusto") o "I adjust".',
      article: '4.2.1',
    },
    {
      q: '¿Cuándo se pierde el derecho al enroque?',
      a: 'Artículo 3.8.2.1: El derecho al enroque se pierde definitivamente si el rey ya se ha movido, o si la torre con la que se quiere enrocar ya se ha movido. Está temporalmente impedido si el rey está en jaque, debe cruzar una casilla atacada, la casilla de destino está atacada, o hay piezas entre el rey y la torre.',
      article: '3.8.2.1',
    },
    {
      q: '¿Se puede tener un móvil en la sala de juego?',
      a: 'Artículo 11.3.2: Durante una partida, está prohibido tener cualquier dispositivo electrónico no aprobado por el árbitro en el recinto de juego. Artículo 11.3.2.2: Si es evidente que el jugador lo tiene, pierde la partida y el oponente gana. Artículo 12.8: Nadie puede usar móvil o dispositivos de comunicación en el recinto.',
      article: '11.3.2',
    },
    {
      q: '¿Cuándo se puede ofrecer tablas?',
      a: 'Artículo 9.1.2.1: Una oferta de tablas debe hacerse después de realizar un movimiento en el tablero y antes de presionar el reloj. La oferta no puede retirarse y permanece válida hasta que el oponente la acepta, la rechaza verbalmente, toca una pieza con intención de mover, o la partida concluye de otra forma.',
      article: '9.1.2.1',
    },
    {
      q: '¿Qué es el ajedrez rápido (rapid)?',
      a: 'Apéndice A.1: Una partida de ajedrez rápido es aquella donde todos los movimientos deben completarse en un tiempo fijo de más de 10 minutos pero menos de 60 minutos para cada jugador, o el tiempo asignado más 60 veces cualquier incremento es de más de 10 pero menos de 60 minutos.',
      article: 'A.1',
    },
    {
      q: '¿Qué es el ajedrez relámpago (blitz)?',
      a: 'Apéndice B.1: Una partida relámpago es aquella donde todos los movimientos deben completarse en un tiempo fijo de 10 minutos o menos para cada jugador, o el tiempo asignado más 60 veces cualquier incremento es de 10 minutos o menos.',
      article: 'B.1',
    },
    {
      q: '¿Qué sanciones puede aplicar el árbitro?',
      a: 'Artículo 12.9: El árbitro puede: (1) advertencia, (2) añadir tiempo al oponente, (3) reducir el tiempo del infractor, (4) otorgar los puntos máximos al oponente, (5) reducir los puntos del infractor, (6) declarar la partida perdida, (7) imponer una multa, (8) excluir de una o varias rondas, (9) expulsar de la competición.',
      article: '12.9',
    },
    {
      q: '¿Qué ocurre si comienza la partida con los colores invertidos?',
      a: 'Artículo 7.3: Si una partida ha comenzado con los colores invertidos y se han realizado menos de 10 movimientos por cada jugador, se interrumpe y se juega una nueva con los colores correctos. Después de 10 movimientos o más, la partida continúa.',
      article: '7.3',
    },
    {
      q: '¿Puede un jugador apelar una decisión del árbitro?',
      a: 'Artículo 11.10: A menos que las bases del evento especifiquen lo contrario, un jugador puede apelar cualquier decisión del árbitro, incluso si el jugador ha firmado la planilla.',
      article: '11.10',
    },
    {
      q: '¿Qué ocurre si un jugador llega tarde?',
      a: 'Artículo 6.7.1: Las bases del evento deben especificar el tiempo de incomparecencia (default time). Si no se especifica, es cero. Cualquier jugador que llegue al tablero después del tiempo de incomparecencia perderá la partida, a menos que el árbitro decida lo contrario.',
      article: '6.7',
    },
    {
      q: '¿Qué es la captura al paso (en passant)?',
      a: 'Artículo 3.7.3.1-3.7.3.2: Un peón en la misma fila que un peón oponente que acaba de avanzar dos casillas desde su posición inicial puede capturarlo como si solo hubiera avanzado una casilla. Esta captura solo es legal en el movimiento inmediatamente siguiente a ese avance.',
      article: '3.7.3',
    },
    {
      q: '¿Cuántos puntos se otorgan en una partida?',
      a: 'Artículo 10.1: El ganador recibe 1 punto. El perdedor recibe 0 puntos. En tablas, cada jugador recibe ½ punto. Artículo 10.2: No se permiten puntuaciones como ¾-¼.',
      article: '10.1',
    },
  ],

  // Palabras clave para búsqueda rápida
  keywords: {
    'movimiento ilegal': '7.5',
    'illegal move': '7.5',
    'tablas repetición': '9.2',
    'draw repetition': '9.2',
    '50 movimientos': '9.3',
    '50 moves rule': '9.3',
    'jadoube': '4.2.1',
    'j\'adoube': '4.2.1',
    'ajusto': '4.2.1',
    'enroque': '3.8.2',
    'castling': '3.8.2',
    'jaque mate': '5.1.1',
    'checkmate': '5.1.1',
    'ahogado': '5.2.1',
    'stalemate': '5.2.1',
    'reloj': '6',
    'clock': '6',
    'bandera': '6.8',
    'flag': '6.8',
    'pieza tocada': '4',
    'piezas tocadas': '4',
    'tocada': '4',
    'tocar pieza': '4',
    'touched piece': '4',
    'peón al paso': '3.7.3',
    'en passant': '3.7.3',
    'promoción': '3.7.3.3',
    'promotion': '3.7.3.3',
    'rendirse': '5.1.2',
    'resign': '5.1.2',
    'móvil': '11.3.2',
    'telefono': '11.3.2',
    'phone': '11.3.2',
    'electronic device': '11.3.2',
    'conducta': '11',
    'comportamiento': '11',
    'árbitro': '12',
    'arbiter': '12',
    'sanciones': '12.9',
    'penalties': '12.9',
    'colores invertidos': '7.3',
    'wrong colors': '7.3',
    'rápido': 'A',
    'rapid': 'A',
    'relámpago': 'B',
    'blitz': 'B',
    'notación': 'C',
    'notation': 'C',
    'algebraica': 'C',
    'puntos': '10',
    'points': '10',
    'score': '10',
  },
};

/**
 * Busca artículos relevantes para una pregunta dada
 */
export function searchFideLaws(query) {
  const q = query.toLowerCase();
  const results = [];

  // Buscar por palabras clave
  for (const [kw, articleId] of Object.entries(FIDE_LAWS_2023.keywords)) {
    if (q.includes(kw.toLowerCase())) {
      const article = FIDE_LAWS_2023.articles.find((a) => a.id === articleId);
      if (article && !results.find((r) => r.id === article.id)) {
        results.push(article);
      }
    }
  }

  // Buscar en FAQs
  const faqResults = FIDE_LAWS_2023.faq.filter(
    (f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)
  );

  // Buscar en reglas de artículos
  if (results.length === 0) {
    for (const article of FIDE_LAWS_2023.articles) {
      const matches = article.rules.some((r) => r.toLowerCase().includes(q));
      if (matches) results.push(article);
    }
  }

  return { articles: results.slice(0, 3), faqs: faqResults.slice(0, 3) };
}

/**
 * Genera respuesta del árbitro IA
 */
export function getArbiterResponse(question) {
  const q = question.toLowerCase().trim();
  const { articles, faqs } = searchFideLaws(q);

  // Primero mirar si hay una FAQ directa
  if (faqs.length > 0) {
    const best = faqs[0];
    return {
      answer: best.a,
      article: best.article,
      confidence: 'high',
      related: faqs.slice(1).map((f) => ({ q: f.q, article: f.article })),
    };
  }

  // Si hay artículos relevantes
  if (articles.length > 0) {
    const art = articles[0];
    return {
      answer: art.rules.join('\n\n'),
      article: art.id,
      title: art.title,
      confidence: 'medium',
      related: articles.slice(1).map((a) => ({ title: a.title, id: a.id })),
    };
  }

  // Respuesta genérica
  return {
    answer: 'No encontré una regla específica para esa consulta en las Leyes FIDE 2023. Te recomiendo consultar directamente el handbook oficial: https://handbook.fide.com/chapter/E012023 o preguntar al árbitro de tu torneo.',
    confidence: 'low',
    article: null,
  };
}
