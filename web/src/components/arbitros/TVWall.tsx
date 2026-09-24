import React, { useState, useEffect } from 'react';

// Tipos
interface Player {
  id: number;
  name: string;
  rating: number;
  title?: string;
  federation?: string;
  score: number;
  performance?: number; // Performance rating
}

interface Pairing {
  id: number;
  table: number;
  whitePlayer: Player;
  blackPlayer: Player;
  result: '1-0' | '0-1' | '½-½' | null;
  status: 'pending' | 'played' | 'disputed' | 'adjourned';
}

interface TournamentInfo {
  id: number;
  name: string;
  location: string;
  date: string;
  round: number;
  totalRounds: number;
  timeControl: string;
  arbiter: string;
}

const TVWall: React.FC = () => {
  const [tournamentInfo, setTournamentInfo] = useState<TournamentInfo | null>(null);
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [standings, setStandings] = useState<Player[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Datos de ejemplo (en producción vendrían del backend vía WebSocket o polling)
  useEffect(() => {
    const loadSampleData = () => {
      setTournamentInfo({
        id: 1,
        name: 'Madrid Open 2026',
        location: 'Madrid, España',
        date: '15-22 Julio 2026',
        round: 4,
        totalRounds: 9,
        timeControl: '90+30',
        arbiter: 'Carlos Martínez IA'
      });

      setPairings([
        {
          id: 1,
          table: 1,
          whitePlayer: {
            id: 1,
            name: 'Magnus Carlsen',
            rating: 2850,
            title: 'GM',
            federation: 'NOR',
            score: 3.0,
            performance: 2865
          },
          blackPlayer: {
            id: 2,
            name: 'Ian Nepomniachtchi',
            rating: 2780,
            title: 'GM',
            federation: 'FID',
            score: 2.5,
            performance: 2750
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
            federation: 'CHN',
            score: 3.0,
            performance: 2820
          },
          blackPlayer: {
            id: 4,
            name: 'Fabiano Caruana',
            rating: 2775,
            title: 'GM',
            federation: 'USA',
            score: 2.5,
            performance: 2740
          },
          result: '½-½',
          status: 'played'
        },
        {
          id: 3,
          table: 3,
          whitePlayer: {
            id: 5,
            name: 'Hikaru Nakamura',
            rating: 2780,
            title: 'GM',
            federation: 'USA',
            score: 2.5,
            performance: 2720
          },
          blackPlayer: {
            id: 6,
            name: 'Alireza Firouzja',
            rating: 2760,
            title: 'GM',
            federation: 'FRA',
            score: 2.0,
            performance: 2680
          },
          result: null,
          status: 'pending'
        },
        {
          id: 4,
          table: 4,
          whitePlayer: {
            id: 7,
            name: 'Ana Martinez',
            rating: 2200,
            federation: 'ESP',
            score: 2.0,
            performance: 2180
          },
          blackPlayer: {
            id: 8,
            name: 'Carlos Lopez',
            rating: 2180,
            federation: 'ESP',
            score: 1.5,
            performance: 2120
          },
          result: '1-0',
          status: 'played'
        },
        {
          id: 5,
          table: 5,
          whitePlayer: {
            id: 9,
            name: 'Elena Rodriguez',
            rating: 2050,
            federation: 'ESP',
            score: 1.5,
            performance: 2030
          },
          blackPlayer: {
            id: 10,
            name: 'David Kim',
            rating: 2030,
            federation: 'USA',
            score: 1.0,
            performance: 1980
          },
          result: null,
          status: 'pending'
        }
      ]);

      setStandings([
        {
          id: 1,
          name: 'Magnus Carlsen',
          rating: 2850,
          title: 'GM',
          federation: 'NOR',
          score: 3.0,
          performance: 2865
        },
        {
          id: 2,
          name: 'Ding Liren',
          rating: 2790,
          title: 'GM',
          federation: 'CHN',
          score: 3.0,
          performance: 2820
        },
        {
          id: 3,
          name: 'Hikaru Nakamura',
          rating: 2780,
          title: 'GM',
          federation: 'USA',
          score: 2.5,
          performance: 2720
        },
        {
          id: 4,
          name: 'Fabiano Caruana',
          rating: 2775,
          title: 'GM',
          federation: 'USA',
          score: 2.5,
          performance: 2740
        },
        {
          id: 5,
          name: 'Ian Nepomniachtchi',
          rating: 2780,
          title: 'GM',
          federation: 'FID',
          score: 2.5,
          performance: 2750
        },
        {
          id: 6,
          name: 'Ana Martinez',
          rating: 2200,
          federation: 'ESP',
          score: 2.0,
          performance: 2180
        },
        {
          id: 7,
          name: 'Fabiano Caruana',
          rating: 2775,
          title: 'GM',
          federation: 'USA',
          score: 2.5,
          performance: 2740
        },
        {
          id: 8,
          name: 'Elena Rodriguez',
          rating: 2050,
          federation: 'ESP',
          score: 1.5,
          performance: 2030
        },
        {
          id: 9,
          name: 'Carlos Lopez',
          rating: 2180,
          federation: 'ESP',
          score: 1.5,
          performance: 2120
        },
        {
          id: 10,
          name: 'David Kim',
          rating: 2030,
          federation: 'USA',
          score: 1.0,
          performance: 1980
        }
      ]).sort((a, b) => b.score - a.score);
    };

    loadSampleData();

    // Simular actualización en tiempo real
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      setLastUpdate(new Date());
      
      // Simular cambios ocasionales en tiempo real
      if (Math.random() > 0.7) {
        // Simular actualización de resultado
        setPairings(prev => {
          const pendingPairings = prev.filter(p => p.status === 'pending');
          if (pendingPairings.length > 0) {
            const randomPairing = pendingPairings[Math.floor(Math.random() * pendingPairings.length)];
            const results = ['1-0', '0-1', '½-½'] as const;
            const randomResult = results[Math.floor(Math.random() * results.length)];
            
            return prev.map(p => 
              p.id === randomPairing.id 
                ? {...p, result: randomResult, status: 'played'} 
                : p
            );
          }
          return prev;
        });
        
        // Actualizar standings basado en nuevos resultados
        setStandings(prev => {
          // En una implementación real, esto vendría del backend
          return [...prev].sort((a, b) => b.score - a.score);
        });
      }
    }, 5000); // Actualizar cada 5 segundos

    return () => clearInterval(interval);
  }, []);

  // Manejar fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error intentando entrar en fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen().catch(err => {
        console.error(`Error intentando salir de fullscreen: ${err.message}`);
      });
    }
    setIsFullscreen(!isFullscreen);
  };

  // Formatear hora
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  // Formatear fecha
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('es-ES', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'});
  };

  // Obtener resultado con formato especial
  const getResultDisplay = (pairing: Pairing): string => {
    if (!pairing.result) return '-';
    
    switch (pairing.result) {
      case '1-0': return '1–0';
      case '0-1': return '0–1';
      case '½-½': return '½–½';
      default: return '-';
    }
  };

  // Obtener clase CSS para resultado
  const getResultClass = (pairing: Pairing): string => {
    if (!pairing.result) return 'result-pending';
    
    switch (pairing.result) {
      case '1-0': return 'result-white-win';
      case '0-1': return 'result-black-win';
      case '½-½': return 'result-draw';
      default: return 'result-pending';
    }
  };

  return (
    <div className="tv-wall" onContextMenu={(e) => e.preventPreventDefault()}> {/* Desactivar menú contextual */}
      {/* Header del Torneo */}
      {tournamentInfo && (
        <div className="tournament-header">
          <div className="tournament-info">
            <h1 className="tournament-name">{tournamentInfo.name}</h1>
            <div className="tournament-meta">
              <span className="tournament-location">{tournamentInfo.location}</span>
              <span className="tournament-date">{tournamentInfo.date}</span>
            </div>
          </div>
          
          <div className="tournament-status">
            <div className="round-info">
              <span className="round-label">Ronda</span>
              <span className="round-number">{tournamentInfo.round}/{tournamentInfo.totalRounds}</span>
            </div>
            <div className="time-control">
              <span className="tc-label">Control de tiempo:</span>
              <span className="tc-value">{tournamentInfo.timeControl}</span>
            </div>
            <div className="arbiter-info">
              <span className="arbiter-label">Árbitro:</span>
              <span className="arbiter-name">{tournamentInfo.arbiter}</span>
            </div>
          </div>
        </div>
      )}

      {/* Reloj y Controles Superiores */}
      <div className="tv-controls">
        <div className="current-time">
          <span className="time-label">Hora actual:</span>
          <span className="time-value">{formatTime(currentTime)}</span>
          <span className="date-value">{formatDate(currentTime)}</span>
        </div>
        
        <div className="tv-controls-right">
          <button 
            className="control-btn fullscreen-btn"
            onClick={toggleFullscreen}
            title="Pantalla completa"
          >
            {isFullscreen ? '⛶' : '⛬'}
          </button>
          <button 
            className="control-btn refresh-btn"
            onClick={() => {/* Forzar actualización */}}
            title="Actualizar ahora"
          >
            🔄
          </button>
          <button 
            className={autoRefresh ? 'control-btn refresh-btn active' : 'control-btn refresh-btn'}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? 'Desactivar actualización automática' : 'Activar actualización automática'}
          >
            ⏱️
          </button>
          <div className="update-info">
            <span className="update-label">Última actualización:</span>
            <span className="update-time">{formatTime(lastUpdate)}</span>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="tv-content">
        {/* Tabla de Emparejamientos */}
        <div className="tv-section pairings-section">
          <h2 className="section-title">Emparejamientos</h2>
          <div className="pairings-container">
            <div className="pairings-table-header">
              <div className="table-col">Mesa</div>
              <div className="players-col">Jugadores</div>
              <div className="result-col">Resultado</div>
              <div className="rating-col">Elo</div>
            </div>
            
            <div className="pairings-table-body">
              {pairings.map(pairing => (
                <div 
                  key={pairing.id} 
                  className={`pairing-row ${pairing.status}`}
                >
                  <div className="table-col">{pairing.table}</div>
                  
                  <div className="players-col">
                    <div className="player-entry">
                      <div className="player-name">{pairing.whitePlayer.name}</div>
                      {pairing.whitePlayer.title && (
                        <span className="player-title">{pairing.whitePlayer.title}</span>
                      )}
                      {pairing.whitePlayer.federation && (
                        <span className="player-federation">{pairing.whitePlayer.federation}</span>
                      )}
                    </div>
                    <div className="player-vs">–</div>
                    <div className="player-entry">
                      <div className="player-name">{pairing.blackPlayer.name}</div>
                      {pairing.blackPlayer.title && (
                        <span className="player-title">{pairing.blackPlayer.title}</span>
                      )}
                      {pairing.blackPlayer.federation && (
                        <span className="player-federation">{pairing.blackPlayer.federation}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="result-col">
                    <span className={`result-badge ${getResultClass(pairing)}`}>
                      {getResultDisplay(pairing)}
                    </span>
                  </div>
                  
                  <div className="rating-col">
                    <div className="rating-pair">
                      <span className="rating-value">{pairing.whitePlayer.rating}</span>
                      <span className="rating-label">Elo</span>
                    </div>
                    <div className="rating-pair">
                      <span className="rating-value">{pairing.blackPlayer.rating}</span>
                      <span className="rating-label">Elo</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Clasificación */}
        <div className="tv-section standings-section">
          <h2 className="section-title">Clasificación</h2>
          <div className="standings-container">
            <div className="standings-table-header">
              <div className="pos-col">#</div>
              <div className="player-col">Jugador</div>
              <div className="country-col">País</div>
              <div className="score-col">Puntos</div>
              <div className="rating-col">Elo</div>
              <div className="perf-col">Perf.</span>
            </div>
            
            <div className="standings-table-body">
              {standings.map((player, index) => (
                <div 
                  key={player.id} 
                  className={`standings-row ${index < 3 ? `top-${index + 1}` : ''}`}
                >
                  <div className="pos-col">
                    <span className="position-number">{index + 1}</span>
                    {index === 0 && <span className="position-crown">👑</span>}
                    {index === 1 && <span className="position-medal">🥈</span>}
                    {index === 2 && <span className="position-medal">🥉</span>}
                  </div>
                  
                  <div className="player-col">
                    <div className="player-name">{player.name}</div>
                    {player.title && (
                      <span className="player-title">{player.title}</span>
                    )}
                    {player.federation && (
                      <span className="player-federation">{player.federation}</span>
                    )}
                  </div>
                  
                  <div className="country-col">
                    {player.federation && (
                      <span className="country-flag">{player.federation}</span>
                    )}
                  </div>
                  
                  <div className="score-col">
                    <span className="score-value">{player.score}</span>
                  </div>
                  
                  <div className="rating-col">
                    <span className="rating-value">{player.rating}</span>
                  </div>
                  
                  <div className="perf-col">
                    <span className="perf-value">{player.performance || '-'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel de Información Adicional (opcional) */}
        <div className="tv-section info-panel">
          <h2 className="section-title">Información del Torneo</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Partidas completadas:</span>
              <span className="info-value">
                {pairings.filter(p => p.status === 'played').length}/{pairings.length}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Tiempo promedio de partida:</span>
              <span className="info-value">2h 15m</span>
            </div>
            <div className="info-item">
              <span className="info-label">Partidas en curso:</span>
              <span className="info-value">
                {pairings.filter(p => p.status === 'pending').length}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Próxima ronda:</span>
              <span className="info-value">
                {new Date(Date.now() + 2 * 60 * 60 * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="tv-footer">
        <div className="footer-left">
          <span className="footer-text">
            Transmitido en vivo desde Chess Organizers Pro
          </span>
        </div>
        <div className="footer-center">
          <span className="footer-text">
            © 2026 Chess Organizers Pro - Torneos de Ajedrez Profesionales
          </span>
        </div>
        <div className="footer-right">
          <span className="footer-text">
            Actualización automática: {autoRefresh ? 'Activada' : 'Desactivada'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TVWall;