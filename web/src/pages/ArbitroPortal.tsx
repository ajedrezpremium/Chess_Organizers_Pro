import React, { useState } from 'react';
import ArbitroDashboard from '../components/arbitros/ArbitroDashboard';
import TVWall from '../components/arbitros/TVWall';
import MobileResultInput from '../components/arbitros/MobileResultInput';

const ArbitroPortal: React.FC = () => {
  const [activeView, setActiveView] = useState<'dashboard' | 'tv-wall' | 'mobile-input'>('dashboard');
  const [isMobileView, setIsMobileView] = useState(false);

  // Detectar si estamos en un dispositivo móvil (para mostrar la interfaz táctil por defecto)
  React.useEffect(() => {
    const checkIfMobile = () => {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
                      || window.innerWidth < 768;
      setIsMobileView(isMobile);
    };

    checkIfMobile();
    
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // En móviles, mostrar la interfaz de entrada de resultados por defecto
  React.useEffect(() => {
    if (isMobileView && activeView !== 'mobile-input') {
      setActiveView('mobile-input');
    }
  }, [isMobileView, activeView]);

  const handleViewChange = (view: 'dashboard' | 'tv-wall' | 'mobile-input') => {
    setActiveView(view);
  };

  return (
    <div className="arbitro-portal">
      {/* En móviles pequeños, mostrar directamente la interfaz de entrada de resultados */}
      {isMobileView && window.innerWidth < 480 && (
        <MobileResultInput />
      )}
      
      {/* En tablets y escritorio, mostrar el portal completo con navegación */}
      {! (isMobileView && window.innerWidth < 480) && (
        <>
          {/* Header del Portal */}
          <div className="portal-header">
            <div className="portal-branding">
              <div className="portal-logo">♟️</div>
              <div className="portal-title">
                <h1>Chess Organizers Pro</h1>
                <p className="portal-subtitle">Panel de Árbitro Profesional</p>
              </div>
            </div>
            
            <div className="portal-user">
              <div className="user-info">
                <span className="user-name">Árbitro Principal</span>
                <span className="user-role">Certificado FIDE</span>
              </div>
              <div className="user-actions">
                <button 
                  className="user-btn settings-btn"
                  title="Configuración"
                  onClick={() => {/* Abrir configuración */}}
                >
                  ⚙️
                </button>
                <button 
                  className="user-btn logout-btn"
                  title="Cerrar sesión"
                  onClick={() => {/* Cerrar sesión */}}
                >
                  🚪
                </button>
              </div>
            </div>
          </div>

          {/* Navegación Principal */}
          <div className="portal-nav">
            <button 
              className={`nav-btn ${activeView === 'dashboard' ? 'active' : ''}`}
              onClick={() => handleViewChange('dashboard')}
            >
              <span className="nav-icon">📊</span>
              <span className="nav-label">Panel Principal</span>
            </button>
            
            <button 
              className={`nav-btn ${activeView === 'tv-wall' ? 'active' : ''}`}
              onClick={() => handleViewChange('tv-wall')}
            >
              <span className="nav-icon">📺</span>
              <span className="nav-label">TV Wall</span>
            </button>
            
            <button 
              className={`nav-btn ${activeView === 'mobile-input' ? 'active' : ''}`}
              onClick={() => handleViewChange('mobile-input')}
            >
              <span className="nav-icon">📱</span>
              <span className="nav-label">Entrada Móvil</span>
            </button>
          </div>

          {/* Contenido Principal */}
          <div className="portal-content">
            {activeView === 'dashboard' && (
              <ArbitroDashboard onViewChange={handleViewChange} />
            )}
            
            {activeView === 'tv-wall' && (
              <TVWall onViewChange={handleViewChange} />
            )}
            
            {activeView === 'mobile-input' && (
              <MobileResultInput onViewChange={handleViewChange} />
            )}
          </div>

          {/* Footer */}
          <div className="portal-footer">
            <div className="footer-info">
              <span>Chess Organizers Pro v1.0 • </span>
              <span>Actualizado: {new Date().toLocaleTimeString()}</span>
              <span>• </span>
              <span>Modo: {isMobileView ? 'Móvil' : 'Escritorio'}</span>
            </div>
            <div className="footer-links">
              <a href="#" className="footer-link">Ayuda</a>
              <span className="footer-separator">|</span>
              <a href="#" className="footer-link">Soporte</a>
              <span className="footer-separator">|</span>
              <a href="#" className="footer-link">Sobre nosotros</a>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ArbitroPortal;