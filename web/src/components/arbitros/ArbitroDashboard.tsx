import React, { useState, useEffect } from 'react';

// Tipo para emparejamientos
interface Pairing {
  id: number;
  table: number;
  whitePlayer: {
    id: number;
    name: string;
    rating: number;
    title?: string;
  };
  blackPlayer: {
    id: number;
    name: string;
    rating: number;
    title?: string;
  };
  result: '1-0' | '0-1' | '½-½' | null;
  status: 'pending' | 'played' | 'disputed';
}

// Tipo para alertas de Fair Play
interface FairPlayAlert {
  id: number;
  playerId: number;
  playerName: string;
  table: number;
  correlation: number; // 0-100%
  engine: string;
  timestamp: string;
  status: 'new' | 'reviewed' | 'dismissed';
}

// Tipo para notificaciones
interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

const ArbitroDashboard: React.FC = () => {
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [fairPlayAlerts, setFairPlayAlerts] = useState<FairPlayAlert[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(9);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [isFIDEAssistantOpen, setIsFIDEAssistantOpen] = useState(false);
  const [fideQuery, setFideQuery] = useState('');
  const [fideResponse, setFideResponse] = useState<string | null>(null);
  const [isLoadingFIDE, setIsLoadingFIDE] = useState(false);

  // Datos de ejemplo (en producción vendrían del backend)
  useEffect(() => {
    // Simular carga de datos
    const loadSampleData = () => {
      setPairings([
        {
          id: 1,
          table: 1,
          whitePlayer: { id: 1, name: 'Magnus Carlsen', rating: 2850, title: 'GM' },
          blackPlayer: { id: 2, name: 'Ian Nepomniachtchi', rating: 2780, title: 'GM' },
          result: null,
          status: 'pending'
        },
        {
          id: 2,
          table: 2,
          whitePlayer: { id: 3, name: 'Ding Liren', rating: 2790, title: 'GM' },
          blackPlayer: { id: 4, name: 'Fabiano Caruana', rating: 2775, title: 'GM' },
          result: '½-½',
          status: 'played'
        },
        {
          id: 3,
          table: 3,
          whitePlayer: { id: 5, name: 'Hikaru Nakamura', rating: 2780, title: 'GM' },
          blackPlayer: { id: 6, name: 'Alireza Firouzja', rating: 2760, title: 'GM' },
          result: null,
          status: 'pending'
        },
        {
          id: 4,
          table: 4,
          whitePlayer: { id: 7, name: 'Ana Martinez', rating: 2200 },
          blackPlayer: { id: 8, name: 'Carlos Lopez', rating: 2180 },
          result: '1-0',
          status: 'played'
        },
        {
          id: 5,
          table: 5,
          whitePlayer: { id: 9, name: 'Elena Rodriguez', rating: 2050 },
          blackPlayer: { id: 10, name: 'David Kim', rating: 2030 },
          result: null,
          status: 'pending'
        }
      ]);

      setFairPlayAlerts([
        {
          id: 1,
          playerId: 9,
          playerName: 'Elena Rodriguez',
          table: 5,
          correlation: 96.8,
          engine: 'Stockfish 16',
          timestamp: new Date().toISOString(),
          status: 'new'
        }
      ]);

      setNotifications([
        {
          id: '1',
          type: 'warning',
          title: 'Alerta de Fair Play',
          message: 'Jugador en Mesa 5 muestra 96.8% de correlación con Stockfish 16',
          timestamp: new Date().toISOString(),
          read: false
        },
        {
          id: '2',
          type: 'info',
          title: 'Emparejamientos publicados',
          message: 'Los emparejamientos de la ronda 3 han sido publicados',
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          read: true
        }
      ]);
    };

    loadSampleData();
  }, []);

  // Manejar selección de mesa
  const handleTableSelect = (tableId: number) => {
    setSelectedTable(tableId);
  };

  // Manejar resultado de partida
  const handleResultSubmit = (tableId: number, result: '1-0' | '0-1' | '½-½') => {
    setPairings(prev => prev.map(p => 
      p.table === tableId 
        ? {...p, result, status: 'played'} 
        : p
    ));
    
    setNotifications(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        type: 'success',
        title: 'Resultado registrado',
        message: `Resultado registrado para mesa ${tableId}`,
        timestamp: new Date().toISOString(),
        read: false
      }
    ]);
  };

  // Manejar alerta de Fair Play
  const handleFairPlayAlert = (alertId: number, action: 'reviewed' | 'dismissed') => {
    setFairPlayAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? {...alert, status: action} 
        : alert
    ));

    setNotifications(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        type: action === 'reviewed' ? 'info' : 'success',
        title: `Alerta de Fair Play ${action === 'reviewed' ? 'revisada' : 'desestimada'}`,
        message: `La alerta de Fair Play ha sido ${action === 'reviewed' ? 'revisada' : 'desestimada'} correctamente`,
        timestamp: new Date().toISOString(),
        read: false
      }
    ]);
  };

  // Consulta al Agente FIDE Arbiter Assistant
  const handleFIDEQuery = async () => {
    if (!fideQuery.trim()) return;

    setIsLoadingFIDE(true);
    setFideResponse(null);

    // Simular llamada al agente FIDE (en producción sería llamada al backend)
    try {
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simular latencia
      
      // Respuestas simuladas basadas en consultas comunes
      const responses: Record<string, string> = {
        'llegada tardia': 'Según el Artículo 11.9.1: Un jugador que llegue tarde al tablero perderá la partida, a menos que el árbitro decida lo contrario. La penalización por defecto es la pérdida de la partida.',
        'movimiento ilegal': 'Según el Artículo 7.5.1: Si se comprueba un movimiento ilegal, se reinstala la posición inmediatamente anterior a la irregularidad. Se otorgarán 2 minutos adicionales al reloj del adversario.',
        'jaque al rey expuesto': 'Según el Artículo 3.9.b: Es ilegal hacer un movimiento que ponga o deje al propio rey en jaque.',
        'empate por acuerdo': 'Según el Artículo 9.1: Las partes pueden acordar tablas en cualquier momento del juego, sin necesidad de jugar un número determinado de jugadas.',
        'uso de dispositivo electronico': 'Según el Artículo 11.3.2: Está prohibido tener un dispositivo electrónico en funcionamiento en la zona de juego.',
        'repeticion de jugadas': 'Según el Artículo 9.2.1: La partida es tablas cuando se haya producido la misma posición, con el mismo jugador de turno y los mismos posibles movimientos, al menos tres veces.'
      };

      // Buscar respuesta más cercana
      let response = 'Consulta no reconocida. Por favor, reformule su pregunta usando términos específicos de las Leyes FIDE.';
      
      Object.keys(responses).forEach(key => {
        if (fideQuery.toLowerCase().includes(key)) {
          response = responses[key];
        }
      });

      setFideResponse(response);
    } catch (error) {
      setFideResponse('Error al consultar al Agente FIDE. Por favor, intente nuevamente.');
    } finally {
      setIsLoadingFIDE(false);
    }
  };

  // Limpiar consulta FIDE
  const clearFIDEQuery = () => {
    setFideQuery('');
    setFideResponse(null);
  };

  // Formatear correlación para visualización
  const formatCorrelation = (correlation: number): string => {
    return `${correlation.toFixed(1)}%`;
  };

  // Clase CSS para correlación según nivel de riesgo
  const getCorrelationClass = (correlation: number): string => {
    if (correlation >= 95) return 'correlation-critical';
    if (correlation >= 85) return 'correlation-high';
    if (correlation >= 70) return 'correlation-medium';
    return 'correlation-low';
  };

  return (
    <div className="arbitro-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <h1>Panel de Árbitro Principal</h1>
        <div className="dashboard-info">
          <div className="round-info">
            <span>Ronda:</span>
            <strong>{currentRound}/{totalRounds}</strong>
          </div>
          <div className="tournament-status">
            <span className="status-indicator live"></span>
            <span>Torneo en vivo</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="dashboard-main">
        {/* Left Column - Emparejamientos y Alertas */}
        <div className="dashboard-left">
          
          {/* Sección de Emparejamientos */}
          <section className="dashboard-section">
            <h2>Emparejamientos Actuales</h2>
            <div className="pairings-table">
              {pairings.map(pairing => (
                <div 
                  key={pairing.id}
                  className={`pairing-row ${pairing.status === 'played' ? 'played' : pairing.status === 'disputed' ? 'disputed' : 'pending'} ${selectedTable === pairing.table ? 'selected' : ''}`}
                  onClick={() => handleTableSelect(pairing.table)}
                >
                  <div className="table-number">Mesa {pairing.table}</div>
                  
                  <div className="players">
                    <div className="player white">
                      <div className="player-name">{pairing.whitePlayer.name}</div>
                      <div className="player-rating">{pairing.whitePlayer.rating}</div>
                      {pairing.whitePlayer.title && <span className="player-title">{pairing.whitePlayer.title}</span>}
                    </div>
                    <div className="player vs">VS</div>
                    <div className="player black">
                      <div className="player-name">{pairing.blackPlayer.name}</div>
                      <div className="player-rating">{pairing.blackPlayer.rating}</div>
                      {pairing.blackPlayer.title && <span className="player-title">{pairing.blackPlayer.title}</span>}
                    </div>
                  </div>
                  
                  <div className="result-actions">
                    {pairing.status === 'played' && (
                      <div className="result-display">
                        {pairing.whitePlayer.name} {pairing.result} {pairing.blackPlayer.name}
                      </div>
                    )}
                    {pairing.status === 'pending' && (
                      <div className="result-buttons">
                        <button 
                          onClick={() => handleResultSubmit(pairing.table, '1-0')}
                          className="result-btn white-win"
                        >
                          1-0
                        </button>
                        <button 
                          onClick={() => handleResultSubmit(pairing.table, '½-½')}
                          className="result-btn draw"
                        >
                          ½-½
                        </button>
                        <button 
                          onClick={() => handleResultSubmit(pairing.table, '0-1')}
                          className="result-btn black-win"
                        >
                          0-1
                        </button>
                      </div>
                    )}
                    {pairing.status === 'disputed' && (
                      <span className="status-disputed">Disputado</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Sección de Alertas de Fair Play */}
          {fairPlayAlerts.length > 0 && (
            <section className="dashboard-section fair-play-section">
              <h2>Alertas de Fair Play</h2>
              <div className="fair-play-alerts">
                {fairPlayAlerts.map(alert => (
                  <div 
                    key={alert.id} 
                    className={`fair-play-alert ${getCorrelationClass(alert.correlation)} ${alert.status === 'new' ? 'new' : ''}`}
                  >
                    <div className="alert-header">
                      <div className="alert-info">
                        <span className="alert-table">Mesa {alert.table}</span>
                        <span className="alert-player">{alert.playerName}</span>
                      </div>
                      <div className="alert-correlation">
                        <span className="correlation-label">Correlación:</span>
                        <span className="correlation-value">{formatCorrelation(alert.correlation)}</span>
                      </div>
                    </div>
                    <div className="alert-details">
                      <span className="alert-engine">Motor: {alert.engine}</span>
                      <span className="alert-time">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                    </div>
                    {alert.status === 'new' && (
                      <div className="alert-actions">
                        <button 
                          onClick={() => handleFairPlayAlert(alert.id, 'reviewed')}
                          className="alert-btn review"
                        >
                          Revisar
                        </button>
                        <button 
                          onClick={() => handleFairPlayAlert(alert.id, 'dismissed')}
                          className="alert-btn dismiss"
                        >
                          Desestimar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Sección de Notificaciones */}
          <section className="dashboard-section notifications-section">
            <h2>Notificaciones</h2>
            <div className="notifications-list">
              {notifications
                .slice()
                .reverse()
                .map(notification => (
                  <div 
                    key={notification.id} 
                    className={`notification notification-${notification.type} ${notification.read ? 'read' : 'unread'}`}
                  >
                    <div className="notification-header">
                      <span className="notification-title">{notification.title}</span>
                      <span className="notification-time">
                        {new Date(notification.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="notification-message">{notification.message}</span>
                  </div>
                ))}
            </div>
          </section>
        </div>

        {/* Right Column - Detalles y Herramientas */}
        <div className="dashboard-right">
          
          {/* Detalle de Mesa Seleccionada */}
          {selectedTable !== null && (
            <section className="dashboard-section table-detail">
              <h2>Detalle de Mesa {selectedTable}</h2>
              {pairings.find(p => p.table === selectedTable) && (
                <>
                  <div className="table-board-placeholder">
                    <div className="board-label">Tablero Virtual</div>
                    <div className="board-grid">
                      {/* 8x8 board placeholder */}
                      {[...Array(64)].map((_, index) => (
                        <div 
                          key={index} 
                          className={`board-square ${(Math.floor(index/8) + index) % 2 === 0 ? 'white' : 'black'}`}
                        ></div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="table-actions">
                    <button 
                      onClick={() => handleResultSubmit(selectedTable, '1-0')}
                      className="action-btn result-btn"
                    >
                      1-0
                    </button>
                    <button 
                      onClick={() => handleResultSubmit(selectedTable, '½-½')}
                      className="action-btn result-btn"
                    >
                      ½-½
                    </button>
                    <button 
                      onClick={() => handleResultSubmit(selectedTable, '0-1')}
                      className="action-btn result-btn"
                    >
                      0-1
                    </button>
                    <button 
                      onClick={() => {/* Lógica para marcar como disputado */}}
                      className="action-btn dispute-btn"
                    >
                      Disputado
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          {/* Agente FIDE Arbiter Assistant */}
          <section className="dashboard-section fide-assistant">
            <h2>Agente FIDE Arbiter Assistant</h2>
            <div className="fide-assistant-container">
              <div className="fide-assistant-header">
                <span className="assistant-status">
                  {/* Indicador de estado */}
                  <span className="status-dot online"></span>
                  <span>En línea</span>
                </span>
                <button 
                  onClick={() => setIsFIDEAssistantOpen(!isFIDEAssistantOpen)}
                  className="toggle-assistant-btn"
                >
                  {isFIDEAssistantOpen ? 'Cerrar' : 'Abrir'}
                </button>
              </div>
              
              {isFIDEAssistantOpen && (
                <div className="fide-assistant-content">
                  <div className="fide-input-group">
                    <input
                      type="text"
                      value={fideQuery}
                      onChange={(e) => setFideQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleFIDEQuery()}
                      placeholder="¿Cuál es el procedimiento para...?"
                      className="fide-input"
                    />
                    <button 
                      onClick={handleFIDEQuery}
                      disabled={isLoadingFIDE}
                      className="fide-submit-btn"
                    >
                      {isLoadingFIDE ? 'Consultando...' : 'Consultar'}
                    </button>
                    <button 
                      onClick={clearFIDEQuery}
                      className="fide-clear-btn"
                    >
                      Limpiar
                    </button>
                  </div>
                  
                  {fideResponse && (
                    <div className="fide-response">
                      <div className="fide-response-header">
                        <span className="response-label">Respuesta FIDE:</span>
                        <button 
                          onClick={() => setFideResponse(null)}
                          className="response-close"
                        >
                          ×
                        </button>
                      </div>
                      <div className="fide-response-body">
                        {fideResponse}
                      </div>
                    </div>
                  )}
                  
                  {!fideResponse && !isLoadingFIDE && (
                    <div className="fide-placeholder">
                      <p>Haga su consulta sobre las Leyes FIDE del Ajedrez 2023</p>
                      <p className="fide-examples">
                        Ejemplos: "llegada tardía", "movimiento ilegal", "jaque al rey expuesto", 
                        "empate por acuerdo", "uso de dispositivo electrónico"
                      </p>
                    </div>
                  )}
                  
                  {isLoadingFIDE && (
                    <div className="fide-loading">
                      Consultando al Agente FIDE Arbiter Assistant...
                      <div className="loading-dots">
                        <span>.</span><span>.</span><span>.</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Atajos rápidos */}
          <section className="dashboard-section quick-actions">
            <h2>Accesos Rápidos</h2>
            <div className="quick-actions-grid">
              <button 
                className="quick-action-btn"
                onClick={() => {/* Abrir TV Wall */}}
              >
                <span className="action-icon">📺</span>
                <span>TV Wall</span>
              </button>
              <button 
                className="quick-action-btn"
                onClick={() => {/* Abrir chat de árbitros */}}
              >
                <span className="action-icon">💬</span>
                <span>Chat Árbitros</span>
              </button>
              <button 
                className="quick-action-btn"
                onClick={() => {/* Abrir historial de partidas */}}
              >
                <span className="action-icon">📜</span>
                <span>Historial</span>
              </button>
              <button 
                className="quick-action-btn"
                onClick={() => {/* Abrir estadísticas */}}
              >
                <span className="action-icon">📊</span>
                <span>Estadísticas</span>
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Footer */}
      <div className="dashboard-footer">
        <div className="footer-info">
          <span>Usuario: Árbitro Principal • Última actualización: {new Date().toLocaleTimeString()}</span>
        </div>
        <div className="footer-actions">
          <button className="footer-btn" onClick={() => {/* Pausar torneo */}}>
            Pausar Torneo
          </button>
          <button className="footer-btn primary" onClick={() => {/* Finalizar ronda */}}>
            Finalizar Ronda
          </button>
        </div>
      </div>
    </div>
  );
};

export default ArbitroDashboard;