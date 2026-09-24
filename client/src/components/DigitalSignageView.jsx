// src/components/tournament/DigitalSignageView.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { normalizeResultValue } from '../../services/roundNormalization';
import './DigitalSignageView.css';

const normalizeStandingResult = (result) => normalizeResultValue(result);
const getPlayerRating = (player) => Number(player?.fideRating || player?.rating || 0);

const ISO3_TO_ISO2 = {
  AZE: "az", GEO: "ge", POL: "pl", ESP: "es", ARM: "am", DNK: "dk",
  RUS: "ru", USA: "us", CHN: "cn", FRA: "fr", NED: "nl", ROU: "ro",
  IND: "in", SWE: "se", CZE: "cz", NOR: "no", ARG: "ar", GER: "de",
  ENG: "gb", TUR: "tr", UKR: "ua", ISR: "il", SRB: "rs", HUN: "hu",
  AUT: "at", BEL: "be", FIN: "fi", POR: "pt", ITA: "it", CRO: "hr"
};

const countryToFlag = (code) => {
  if (!code || code.length < 2) return null;
  const iso2 = code.length === 3
    ? (ISO3_TO_ISO2[code.toUpperCase()] || code.slice(0, 2).toUpperCase())
    : code.toUpperCase().slice(0, 2);
  return iso2.toLowerCase();
};

const DigitalSignageView = ({ tournamentId, tournament }) => {
  const { t } = useTranslation(['tournament']);
  const [basePlayers, setBasePlayers] = useState([]);
  const [roundsData, setRoundsData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Signage Configuration States
  const [slideshowSpeed, setSlideshowSpeed] = useState(10); // seconds
  const [selectedTheme, setSelectedTheme] = useState('classic'); // classic, emerald, cyber
  const [customQrText, setCustomQrText] = useState('Escanear para emparejamientos y resultados en vivo');
  const [showFullscreen, setShowFullscreen] = useState(false);

  // Slideshow Navigation States
  const [activeFrame, setActiveFrame] = useState(0); // overall view frame index
  const [isPaused, setIsPaused] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [currentTime, setCurrentTime] = useState('');

  // Subscriptions to Firestore
  useEffect(() => {
    if (!tournamentId) return;
    setLoading(true);

    const unsubPlayers = onSnapshot(collection(db, 'tournaments', tournamentId, 'players'), (snap) => {
      setBasePlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubRounds = onSnapshot(collection(db, 'tournaments', tournamentId, 'rounds'), (snap) => {
      const sortedRounds = snap.docs.map(d => d.data())
        .sort((a, b) => (a.roundNumber || 0) - (b.roundNumber || 0));
      setRoundsData(sortedRounds);
      setLoading(false);
    });

    return () => {
      unsubPlayers();
      unsubRounds();
    };
  }, [tournamentId]);

  // Clock Update
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Standings Calculation
  const standingsList = useMemo(() => {
    if (basePlayers.length === 0) return [];

    const ps = {};
    basePlayers.forEach(p => {
      ps[p.id] = {
        player: p, points: 0, games: { played: 0, won: 0, drawn: 0, lost: 0 },
        opponents: [], colorHistory: [], results: []
      };
    });

    roundsData.forEach(round => {
      const matches = round.pairings || round.matches || [];
      matches.forEach(match => {
        const wId = match.white?.id || match.whiteId;
        const bId = match.black?.id || match.blackId;
        const res = normalizeStandingResult(match.result);

        if (!res) return;

        if (wId && ps[wId]) {
          ps[wId].games.played++;
          ps[wId].colorHistory.push('W');
          if (bId && bId !== 'BYE' && ps[bId]) {
            ps[wId].opponents.push(bId);
          }
          if (res === '1-0') { ps[wId].points += 1; ps[wId].games.won++; }
          else if (res === '0-1') { ps[wId].games.lost++; }
          else { ps[wId].points += 0.5; ps[wId].games.drawn++; }
        }

        if (bId && bId !== 'BYE' && ps[bId]) {
          ps[bId].games.played++;
          ps[bId].colorHistory.push('B');
          ps[bId].opponents.push(wId);
          if (res === '0-1') { ps[bId].points += 1; ps[bId].games.won++; }
          else if (res === '1-0') { ps[bId].games.lost++; }
          else { ps[bId].points += 0.5; ps[bId].games.drawn++; }
        }

        if (wId && bId && bId !== 'BYE' && ps[wId] && ps[bId]) {
          const wSc = res === '1-0' ? 1 : res === '0-1' ? 0 : 0.5;
          ps[wId].results.push({ opponentId: bId, score: wSc });
          ps[bId].results.push({ opponentId: wId, score: 1 - wSc });
        }
      });
    });

    const calc = Object.values(ps).map(stat => {
      const oppScores = stat.opponents.map(id => ps[id]?.points || 0).filter(n => typeof n === 'number');
      const buchholz = oppScores.reduce((a, b) => a + b, 0);
      const buchholzCut1 = oppScores.length > 1
        ? [...oppScores].sort((a, b) => a - b).slice(1).reduce((a, b) => a + b, 0)
        : buchholz;
      const sonnebornBerger = stat.results.reduce((sum, item) => sum + ((ps[item.opponentId]?.points || 0) * item.score), 0);

      const avgOppRating = stat.results.length > 0
        ? stat.results.reduce((s, item) => s + getPlayerRating(ps[item.opponentId]?.player), 0) / stat.results.length
        : getPlayerRating(stat.player);

      const performance = Math.round(avgOppRating + ((stat.points - stat.games.played / 2) * 400));

      return {
        id: stat.player.id,
        player: stat.player,
        points: stat.points,
        tiebreaks: { buchholz, buchholzCut1, sonnebornBerger },
        games: stat.games,
        performance,
        category: stat.player.category
      };
    });

    calc.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.tiebreaks.buchholzCut1 !== a.tiebreaks.buchholzCut1) return b.tiebreaks.buchholzCut1 - a.tiebreaks.buchholzCut1;
      if (b.tiebreaks.buchholz !== a.tiebreaks.buchholz) return b.tiebreaks.buchholz - a.tiebreaks.buchholz;
      if (b.tiebreaks.sonnebornBerger !== a.tiebreaks.sonnebornBerger) return b.tiebreaks.sonnebornBerger - a.tiebreaks.sonnebornBerger;
      return b.performance - a.performance;
    });

    return calc.map((e, i) => ({ ...e, position: i + 1 }));
  }, [basePlayers, roundsData]);

  // Current Round & Pairings
  const activeRound = useMemo(() => {
    if (roundsData.length === 0) return null;
    return roundsData[roundsData.length - 1];
  }, [roundsData]);

  const activeRoundNumber = activeRound?.roundNumber || 0;

  const pairingsList = useMemo(() => {
    if (!activeRound) return [];
    return activeRound.pairings || activeRound.matches || [];
  }, [activeRound]);

  // Paginated structures (10 rows per page for large signage readability)
  const ROWS_PER_PAGE = 10;

  const paginatedPairings = useMemo(() => {
    const pages = [];
    for (let i = 0; i < pairingsList.length; i += ROWS_PER_PAGE) {
      pages.push(pairingsList.slice(i, i + ROWS_PER_PAGE));
    }
    return pages;
  }, [pairingsList]);

  const paginatedStandings = useMemo(() => {
    const pages = [];
    for (let i = 0; i < standingsList.length; i += ROWS_PER_PAGE) {
      pages.push(standingsList.slice(i, i + ROWS_PER_PAGE));
    }
    return pages;
  }, [standingsList]);

  // Calculate overall frames in the slideshow
  // Frame 0: Welcome Frame
  // Frames 1 to P: Pairings Pages
  // Frames P+1 to P+S: Standings Pages
  const totalFrames = useMemo(() => {
    return 1 + paginatedPairings.length + paginatedStandings.length;
  }, [paginatedPairings, paginatedStandings]);

  // Carousel transition loops
  useEffect(() => {
    if (!showFullscreen || isPaused) return;

    setProgressPct(0);
    const totalMs = slideshowSpeed * 1000;
    const intervalMs = 100;
    let elapsedMs = 0;

    const timer = setInterval(() => {
      elapsedMs += intervalMs;
      setProgressPct((elapsedMs / totalMs) * 100);

      if (elapsedMs >= totalMs) {
        setActiveFrame(prev => (prev + 1) % totalFrames);
        elapsedMs = 0;
        setProgressPct(0);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [showFullscreen, isPaused, slideshowSpeed, totalFrames, activeFrame]);

  // Fullscreen Handlers
  const handleLaunchFullscreen = () => {
    setShowFullscreen(true);
    setActiveFrame(0);
    setProgressPct(0);
    const element = document.documentElement;
    if (element.requestFullscreen) element.requestFullscreen();
  };

  const handleExitFullscreen = () => {
    setShowFullscreen(false);
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setShowFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Public share URL for BYOD
  const shareUrl = `${window.location.origin}/public-tournament/${tournamentId}`;

  // Print poster
  const handlePrintQr = () => {
    window.print();
  };

  // Determine what slides to show based on activeFrame index
  const renderedSlide = useMemo(() => {
    if (activeFrame === 0) {
      // Welcome Slide
      return (
        <div className="ds-welcome-slide">
          <div className="ds-welcome-info">
            <h2>{t('digitalSignage.welcome', 'Bienvenidos al Torneo')}</h2>
            <div className="ds-welcome-meta-grid">
              <div className="ds-welcome-meta-item">
                <div className="meta-label">{t('manager.system', 'Sistema')}</div>
                <div className="meta-value">{tournament?.system || 'Suizo'}</div>
              </div>
              <div className="ds-welcome-meta-item">
                <div className="meta-label">{t('manager.timeControl', 'Ritmo de Juego')}</div>
                <div className="meta-value">{tournament?.timeControl || '—'}</div>
              </div>
              <div className="ds-welcome-meta-item">
                <div className="meta-label">{t('manager.players', 'Jugadores')}</div>
                <div className="meta-value">{basePlayers.length}</div>
              </div>
              <div className="ds-welcome-meta-item">
                <div className="meta-label">{t('digitalSignage.activeRound', 'Ronda Activa')}</div>
                <div className="meta-value">{activeRoundNumber > 0 ? `${activeRoundNumber} / ${tournament?.rounds || '?'}` : t('digitalSignage.noStarted', 'Sin iniciar')}</div>
              </div>
            </div>
            <p style={{ fontSize: '18px', lineHeight: 1.6, color: '#94a3b8' }}>
              {t('digitalSignage.welcomeMsg', 'Mantente informado en tiempo real. Los emparejamientos y resultados de cada ronda se proyectarán automáticamente en esta pantalla.')}
            </p>
          </div>
          <div className="ds-welcome-qr-card">
            <div className="ds-welcome-qr-img">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(shareUrl)}`} alt="BYOD QR Code" />
            </div>
            <h4>{t('digitalSignage.scanTitle', 'Resultados en tu móvil')}</h4>
            <p>{t('digitalSignage.scanDesc', 'Escanea para ver clasificaciones y mesas activas.')}</p>
          </div>
        </div>
      );
    } else if (activeFrame <= paginatedPairings.length) {
      // Pairings Slide Page
      const pageIndex = activeFrame - 1;
      const pagePairings = paginatedPairings[pageIndex] || [];
      return (
        <div>
          <h3 className="ds-table-title">
            <span>🤝 {t('digitalSignage.pairingsTitle', 'Emparejamientos')} — {t('digitalSignage.round', 'Ronda')} {activeRoundNumber}</span>
            <span className="ds-table-page-info">{t('digitalSignage.page', 'Página')} {pageIndex + 1} / {paginatedPairings.length}</span>
          </h3>
          <table className="ds-table">
            <thead>
              <tr>
                <th style={{ width: '10%' }}>{t('digitalSignage.board', 'Mesa')}</th>
                <th style={{ width: '38%' }}>{t('digitalSignage.white', 'Blancas')}</th>
                <th style={{ width: '14%', textAlign: 'center' }}>{t('digitalSignage.result', 'Resultado')}</th>
                <th style={{ width: '38%' }}>{t('digitalSignage.black', 'Negras')}</th>
              </tr>
            </thead>
            <tbody>
              {pagePairings.map((p, idx) => {
                const boardNum = p.boardNumber || (pageIndex * ROWS_PER_PAGE) + idx + 1;
                const whiteFlag = countryToFlag(p.white?.country);
                const blackFlag = countryToFlag(p.black?.country);

                return (
                  <tr key={idx}>
                    <td className="ds-txt-board">#{boardNum}</td>
                    <td>
                      {p.white?.title && p.white.title !== 'None' && <span className="ds-txt-title">{p.white.title}</span>}
                      {whiteFlag && <img src={`https://flagcdn.com/16x12/${whiteFlag}.png`} alt="" style={{ marginRight: '8px', verticalAlign: 'middle' }} />}
                      <strong>{p.white?.lastName || p.white?.name || '—'}</strong>
                      {p.white?.fideRating > 0 && <span className="ds-txt-rating">({p.white.fideRating})</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="ds-txt-result">{p.result || '—'}</span>
                    </td>
                    <td>
                      {p.black?.title && p.black.title !== 'None' && <span className="ds-txt-title">{p.black.title}</span>}
                      {blackFlag && <img src={`https://flagcdn.com/16x12/${blackFlag}.png`} alt="" style={{ marginRight: '8px', verticalAlign: 'middle' }} />}
                      <strong>{p.black?.lastName || p.black?.name || '—'}</strong>
                      {p.black?.fideRating > 0 && <span className="ds-txt-rating">({p.black.fideRating})</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    } else {
      // Standings Slide Page
      const pageIndex = activeFrame - 1 - paginatedPairings.length;
      const pageStandings = paginatedStandings[pageIndex] || [];
      return (
        <div>
          <h3 className="ds-table-title">
            <span>🥇 {t('digitalSignage.standingsTitle', 'Clasificación General')}</span>
            <span className="ds-table-page-info">{t('digitalSignage.page', 'Página')} {pageIndex + 1} / {paginatedStandings.length}</span>
          </h3>
          <table className="ds-table">
            <thead>
              <tr>
                <th style={{ width: '10%' }}>{t('digitalSignage.rank', 'Pos')}</th>
                <th style={{ width: '50%' }}>{t('digitalSignage.player', 'Jugador')}</th>
                <th style={{ width: '15%' }}>{t('digitalSignage.rating', 'Elo')}</th>
                <th style={{ width: '10%', textAlign: 'right' }}>{t('digitalSignage.pts', 'Pts')}</th>
                <th style={{ width: '15%', textAlign: 'right' }}>Buch. Cut1</th>
              </tr>
            </thead>
            <tbody>
              {pageStandings.map((s, idx) => {
                const flag = countryToFlag(s.player?.country);
                const medal = s.position <= 3 ? (s.position === 1 ? '🥇' : s.position === 2 ? '🥈' : '🥉') : null;

                return (
                  <tr key={idx}>
                    <td style={{ fontWeight: 'bold' }}>
                      {medal ? <span style={{ fontSize: '20px' }}>{medal}</span> : s.position}
                    </td>
                    <td>
                      {s.player?.title && s.player.title !== 'None' && <span className="ds-txt-title">{s.player.title}</span>}
                      {flag && <img src={`https://flagcdn.com/16x12/${flag}.png`} alt="" style={{ marginRight: '8px', verticalAlign: 'middle' }} />}
                      <strong>{s.player?.lastName || s.player?.name || '—'}</strong>
                    </td>
                    <td>{s.player?.fideRating || s.player?.rating || '—'}</td>
                    <td style={{ fontWeight: 800, textAlign: 'right' }}>{s.points}</td>
                    <td style={{ textAlign: 'right', color: '#94a3b8' }}>{s.tiebreaks?.buchholzCut1 ?? s.tiebreaks?.buchholz ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }
  }, [activeFrame, paginatedPairings, paginatedStandings, tournament, basePlayers, activeRoundNumber, shareUrl, t]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '32px', marginBottom: '16px' }}></i>
        <p>{t('common.loading', 'Cargando datos...')}</p>
      </div>
    );
  }

  return (
    <>
      {/* -------------------- PRINTABLE BYOD QR POSTER -------------------- */}
      <div className="ds-print-card" style={{ display: 'none' }}>
        <div className="ds-print-title">🏆 {tournament?.name || 'Torneo de Ajedrez'}</div>
        <div className="ds-print-subtitle">{customQrText}</div>
        <div className="ds-print-qr">
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(shareUrl)}`} alt="QR Code" />
        </div>
        <div className="ds-print-footer">
          CHESS ORGANIZERS PRO - Chess-AI®
        </div>
      </div>

      {/* -------------------- CONFIGURATION PANEL -------------------- */}
      {!showFullscreen && (
        <div className="ds-config-container">
          <div className="ds-config-title">
            <i className="fas fa-tv"></i>
            <h2>Digital Signage & BYOD</h2>
          </div>
          <p className="ds-config-subtitle">
            Proyecta las rondas en una pantalla gigante en el recinto y genera accesos QR móviles para que los jugadores sigan sus partidas.
          </p>

          <div className="ds-config-grid">
            {/* Column 1: Customizer */}
            <div className="ds-config-card">
              <h3><i className="fas fa-sliders-h"></i> Configuración de Pantalla</h3>
              <div className="ds-form-group">
                <label>Tiempo de rotación (segundos)</label>
                <select className="ds-select" value={slideshowSpeed} onChange={(e) => setSlideshowSpeed(Number(e.target.value))}>
                  <option value={5}>5 segundos</option>
                  <option value={10}>10 segundos (Recomendado)</option>
                  <option value={15}>15 segundos</option>
                  <option value={20}>20 segundos</option>
                  <option value={30}>30 segundos</option>
                </select>
              </div>

              <div className="ds-form-group">
                <label>Tema visual</label>
                <select className="ds-select" value={selectedTheme} onChange={(e) => setSelectedTheme(e.target.value)}>
                  <option value="classic">Classic Dark (Azul Noche)</option>
                  <option value="emerald">Emerald Knight (Verde Abeto)</option>
                  <option value="cyber">Cyber Chess (Púrpura Tecnológico)</option>
                </select>
              </div>

              <div style={{ marginTop: '24px' }}>
                <button className="ds-btn ds-btn-primary" onClick={handleLaunchFullscreen}>
                  <i className="fas fa-expand"></i> Lanzar Pantalla Gigante
                </button>
              </div>
            </div>

            {/* Column 2: BYOD QR Generator */}
            <div className="ds-config-card">
              <h3><i className="fas fa-qrcode"></i> Cartel de Seguimiento QR</h3>
              <div className="ds-qr-preview">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}`} alt="QR preview" />
              </div>

              <div className="ds-form-group">
                <label>Encabezado del cartel</label>
                <input
                  type="text"
                  className="ds-input"
                  value={customQrText}
                  onChange={(e) => setCustomQrText(e.target.value)}
                  placeholder="Texto informativo del QR..."
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button className="ds-btn ds-btn-secondary" onClick={handlePrintQr}>
                  <i className="fas fa-print"></i> Imprimir Cartel
                </button>
                <button className="ds-btn ds-btn-secondary" onClick={() => navigator.clipboard.writeText(shareUrl)}>
                  <i className="fas fa-copy"></i> Copiar URL
                </button>
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '13px', color: '#94a3b8' }}>
            <strong><i className="fas fa-info-circle" style={{ color: '#3b82f6', marginRight: '6px' }}></i> Consejo de proyección:</strong> Recomendamos conectar el portátil a un proyector o televisión externa mediante HDMI, abrir esta vista en modo pantalla completa en la pantalla secundaria y configurar el tiempo de rotación a 10 o 15 segundos para dar tiempo a los jugadores a leer sus mesas.
          </div>
        </div>
      )}

      {/* -------------------- FULLSCREEN SIGNAGE VIEW -------------------- */}
      {showFullscreen && (
        <div className={`ds-signage-fullscreen ds-theme-${selectedTheme}`}>
          {/* Header */}
          <div className="ds-header">
            <div className="ds-header-title">
              <h1>{tournament?.name || 'Torneo de Ajedrez'}</h1>
              <p>Chess Organizers Pro</p>
            </div>
            <div className="ds-header-right">
              {activeRoundNumber > 0 && <span className="ds-badge">{t('digitalSignage.round', 'Ronda')} {activeRoundNumber}</span>}
              <span className="ds-clock">{currentTime}</span>
            </div>
          </div>

          {/* Slide Content Area */}
          <div className="ds-slide-container">
            {renderedSlide}

            {/* Hover Controller bar */}
            <div className="ds-controller">
              <button className="ds-ctrl-btn" onClick={() => setActiveFrame(prev => (prev - 1 + totalFrames) % totalFrames)} title="Anterior">
                <i className="fas fa-chevron-left"></i>
              </button>
              <button className="ds-ctrl-btn" onClick={() => setIsPaused(!isPaused)} title={isPaused ? 'Reanudar' : 'Pausar'}>
                <i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'}`}></i>
              </button>
              <button className="ds-ctrl-btn" onClick={() => setActiveFrame(prev => (prev + 1) % totalFrames)} title="Siguiente">
                <i className="fas fa-chevron-right"></i>
              </button>
              <div className="ds-ctrl-divider"></div>
              <button className="ds-ctrl-btn" onClick={handleExitFullscreen} title="Salir Pantalla Completa" style={{ color: '#ef4444' }}>
                <i className="fas fa-compress-alt"></i>
              </button>
            </div>
          </div>

          {/* Footer with progress tracker */}
          <div className="ds-footer">
            <div className="ds-progressBar-container">
              <div className="ds-progressBar-fill" style={{ width: `${progressPct}%` }}></div>
            </div>
            <div className="ds-footer-status">
              {t('digitalSignage.cycling', 'Vista')} {activeFrame + 1} / {totalFrames} {isPaused && `(${t('digitalSignage.paused', 'Pausado')})`}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DigitalSignageView;
