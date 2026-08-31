import { useState } from 'react';
import ArbitroPortal from './pages/ArbitroPortal';
import './App.css';

function App() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isNightMode, setIsNightMode] = useState(false);
  const [isHighContrast, setIsHighContrast] = useState(false);

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

  const toggleNightMode = () => {
    setIsNightMode(!isNightMode);
  };

  const toggleHighContrast = () => {
    setIsHighContrast(!isHighContrast);
  };

  return (
    <div 
      className={`app-container ${isFullscreen ? 'fullscreen' : ''} 
                ${isNightMode ? 'night-mode' : ''} 
                ${isHighContrast ? 'high-contrast' : ''}`}
    >
      <ArbitroPortal 
        onFullscreenChange={toggleFullscreen}
        onNightModeChange={toggleNightMode}
        onHighContrastChange={toggleHighContrast}
      />
      
      {/* Controles flotantes para modo fullscreen */}
      {isFullscreen && (
        <div className="fullscreen-controls">
          <button 
            className="fs-control-btn"
            onClick={toggleFullscreen}
            title="Salir de pantalla completa"
          >
            ⛬
          </button>
          <button 
            className="fs-control-btn"
            onClick={toggleNightMode}
            title={isNightMode ? 'Modo día' : 'Modo noche'}
          >
            {isNightMode ? '☀️' : '🌙'}
          </button>
          <button 
            className="fs-control-btn"
            onClick={toggleHighContrast}
            title={isHighContrast ? 'Contraste normal' : 'Alto contraste'}
          >
            {isHighContrast ? '⚪' : '●'}
          </button>
        </div>
      )}
    </div>
  );
}

export default App;