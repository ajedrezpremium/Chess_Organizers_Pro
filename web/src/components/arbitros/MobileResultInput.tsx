import React, { useState } from 'react';

// Tipos
interface Player {
  id: number;
  name: string;
  rating: number;
  title?: string;
  federation?: string;
}

interface Pairing {
  id: number;
  table: number;
  whitePlayer: Player;
  blackPlayer: Player;
  result: '1-0' | '0-1' | '½-½' | null;
  status: 'pending' | 'played' | 'disputed';
}

interface TournamentInfo {
  id: number;
  name: string;
  round: number;
  totalRounds: number;
}

const MobileResultInput: React.FC = () => {
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [tournamentInfo, setTournamentInfo] = useState<TournamentInfo | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<{message: string; type: 'success' | 'error'} | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [recentResults, setRecentResults] = useState<Array<{table: number; result: string; time: string}>>([]);

  // Simular carga de datos
  React.useEffect(() => {
    const loadSampleData = () => {
      setTournamentInfo({
        id: 1,
        name: 'Madrid Open 2026',
        round: 4,
        totalRounds: 9
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
          result: null,
          status: 'pending'
        },
        {
          id: 3,
          table: 3,
          whitePlayer: {
            id: 5,
            name: 'Hikaru Nakamura',
            rating: 2780,
            title: 'GM',
            federation: 'USA'
          },
          blackPlayer: {
            id: 6,
            name: 'Alireza Firouzja',
            rating: 2760,
            title: 'GM',
            federation: 'FRA'
          },
          result: null,
          status: 'pending'
        }
      ]);
    };

    loadSampleData();
  }, []);

  // Manejar selección de mesa
  const handleTableSelect = (tableId: number) => {
    setSelectedTable(tableId);
    // Limpiar mensaje de éxito al cambiar de mesa
    setSubmitSuccess(null);
  };

  // Manejar envío de resultado
  const handleResultSubmit = async (result: '1-0' | '0-1' | '½-½') => {
    if (!selectedTable) return;

    setIsSubmitting(true);
    setSubmitSuccess(null);

    try {
      // Simular llamada al API
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Actualizar emparejamiento localmente
      setPairings(prev => 
        prev.map(p => 
          p.table === selectedTable 
            ? {...p, result, status: 'played'} 
            : p
        )
      );

      // Agregar al historial
      const newResult = {
        table: selectedTable,
        result: result === '1-0' ? '1–0' : result === '0-1' ? '0–1' : '½–½',
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      };
      
      setRecentResults(prev => [newResult, ...prev.slice(0, 4)]); // Mantener últimos 5

      setSubmitSuccess({
        message: `Resultado registrado correctamente para la mesa ${selectedTable}`,
        type: 'success'
      });

      // Vibrar dispositivo si está disponible (en móvil real)
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }

      // Auto-limpiar después de 3 segundos
      setTimeout(() => {
        setSubmitSuccess(null);
      }, 3000);
    } catch (error) {
      setSubmitSuccess({
        message: 'Error al registrar el resultado. Por favor, intente nuevamente.',
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Limpiar selección
  const clearSelection = () => {
    setSelectedTable(null);
    setSubmitSuccess(null);
  };

  // Obtener colores para indicadores de estado
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'played': return '#10b981'; // Verde
      case 'disputed': return '#f59e0b'; // Amarillo
      default: return '#6b7280'; // Gris
    }
  };

  // Formatear resultado para visualización
  const formatResult = (result: '1-0' | '0-1' | '½-½' | null): string => {
    if (!result) return 'Pending';
    
    switch (result) {
      case '1-0': return '1–0';
      case '0-1': return '0–1';
      case '½-½': return '½–½';
      default: return '-';
    }
  };

  return (
    <div className="mobile-result-input">
      {/* Header */}
      <div className="input-header">
        <div className="header-left">
          <button 
            className="header-btn back-btn"
            onClick={clearSelection}
            title="Cancelar selección"
          >
            ←
          </button>
          <h1 className="tournament-name">
            {tournamentInfo?.name} 
            <span className="round-info">
              Ronda {tournamentInfo?.round}/{tournamentInfo?.totalRounds}
            </span>
          </h1>
        </div>
        
        <div className="header-right">
          <button 
            className="header-btn history-btn"
            onClick={() => setShowHistory(!showHistory)}
            title="Ver historial reciente"
          >
            📜
          </button>
        </div>
      </div>

      {/* Mensaje de estado */}
      {submitSuccess && (
        <div className={`status-message status-${submitSuccess.type}`}>
          {submitSuccess.message}
        </div>
      )}

      {/* Selección de Mesa */}
      {!selectedTable && (
        <div className="table-selection">
          <h2 className="section-title">Seleccionar Mesa</h2>
          <div className="tables-grid">
            {pairings.map(pairing => {
              const isAvailable = pairing.status === 'pending';
              return (
                <button
                  key={pairing.id}
                  className={`table-btn ${isAvailable ? 'available' : 'unavailable'} ${pairing.status === 'played' ? 'played' : pairing.status === 'disputed' ? 'disputed' : ''}`}
                  onClick={isAvailable ? () => handleTableSelect(pairing.table) : undefined}
                  disabled={!isAvailable}
                >
                  <div className="table-number">Mesa {pairing.table}</div>
                  <div className="table-players">
                    <div className="player-name">{pairing.whitePlayer.name}</div>
                    <div className="player-vs">VS</div>
                    <div className="player-name">{pairing.blackPlayer.name}</div>
                  </div>
                  {!isAvailable && (
                    <div className="table-status-indicator">
                      <span className="status-dot" style={{backgroundColor: getStatusColor(pairing.status)}}></span>
                      <span className="status-text">
                        {pairing.status === 'played' ? 'Jugada' : 'Disputada'}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Entrada de Resultado */}
      {selectedTable && !showHistory && (
        <>
          <div className="selected-table-info">
            <div className="table-label">Mesa Seleccionada:</div>
            <div className="table-number-large">{selectedTable}</div>
          </div>
          
          <div className="players-display">
            <div className="player white">
              <div className="player-name">{pairings.find(p => p.table === selectedTable)?.whitePlayer.name || ''}</div>
              <div className="player-details">
                {pairings.find(p => p.table === selectedTable)?.whitePlayer.title && (
                  <span className="player-title">{pairings.find(p => p.table === selectedTable)?.whitePlayer.title}</span>
                )}
                {pairings.find(p => p.table === selectedTable)?.whitePlayer.federation && (
                  <span className="player-federation">{pairings.find(p => p.table === selectedTable)?.whitePlayer.federation}</span>
                )}
              </div>
            </div>
            
            <div className="vs-indicator">VS</div>
            
            <div className="player black">
              <div className="player-name">{pairings.find(p => p.table === selectedTable)?.blackPlayer.name || ''}</div>
              <div className="player-details">
                {pairings.find(p => p.table === selectedTable)?.blackPlayer.title && (
                  <span className="player-title">{pairings.find(p => p.table === selectedTable)?.blackPlayer.title}</span>
                )}
                {pairings.find(p => p.table === selectedTable)?.blackPlayer.federation && (
                  <span className="player-federation">{pairings.find(p => p.table === selectedTable)?.blackPlayer.federation}</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="result-input">
            <h2 className="section-title">Seleccionar Resultado</h2>
            <div className="result-options">
              <button 
                className="result-btn white-win"
                onClick={() => handleResultSubmit('1-0')}
                disabled={isSubmitting}
              >
                <div className="result-symbol">1</div>
                <div className="result-text">Blancas ganan</div>
              </button>
              
              <button 
                className="result-btn draw"
                onClick={() => handleResultSubmit('½-½')}
                disabled={isSubmitting}
              >
                <div className="result-symbol">½</div>
                <div className="result-text">Tablas</div>
              </button>
              
              <button 
                className="result-btn black-win"
                onClick={() => handleResultSubmit('0-1')}
                disabled={isSubmitting}
              >
                <div className="result-symbol">0</div>
                <div className="result-text">Negras ganan</div>
              </button>
            </div>
          </div>
          
          <div className="input-footer">
            <button 
              className="footer-btn clear-btn"
              onClick={clearSelection}
            >
              Limpiar Selección
            </button>
          </div>
        </>
      )}

      {/* Historial Reciente */}
      {showHistory && (
        <div className="history-section">
          <h2 className="section-title">Historial Reciente</h2>
          {recentResults.length === 0 ? (
            <div className="history-empty">
              <p>Aún no hay resultados registrados en esta sesión.</p>
            </div>
          ) : (
            <div className="history-list">
              {recentResults.map((item, index) => (
                <div key={index} className="history-item">
                  <div className="history-table">Mesa {item.table}</div>
                  <div className="history-result">{item.result}</div>
                  <div className="history-time">{item.time}</div>
                </div>
              ))}
            </div>
          )}
          <button 
            className="history-close-btn"
            onClick={() => setShowHistory(false)}
          >
            Cerrar Historial
          </button>
        </div>
      )}
    </div>
  );
};

export default MobileResultInput;