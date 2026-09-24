// src/utils/xgPredictiveCopilot.js
/**
 * Copiloto IA Predictivo para el Ecosistema XG (200 Tareas Operativas de Ajedrez & Gestión Deportiva)
 */

export function analyzeXGTaskPredictor(tasks = [], eventDate = null) {
  const total = tasks.length || 200;
  const completed = tasks.filter(t => t.completed || t.status === 'completed').length;
  const inProgress = tasks.filter(t => t.status === 'inProgress' || t.status === 'in_progress').length;
  const pending = total - completed - inProgress;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Distribución por fase (1: Anteproyecto, 2: Proyecto, 3: Evento, 4: Post-Evento)
  const phases = { 1: { total: 0, done: 0 }, 2: { total: 0, done: 0 }, 3: { total: 0, done: 0 }, 4: { total: 0, done: 0 } };

  tasks.forEach(t => {
    const p = t.phaseNumber || (t.phase === 'preproject' ? 1 : t.phase === 'project' ? 2 : t.phase === 'event' ? 3 : 4);
    if (phases[p]) {
      phases[p].total++;
      if (t.completed || t.status === 'completed') phases[p].done++;
    }
  });

  // Cálculo de días restantes si hay fecha del evento
  let daysRemaining = null;
  if (eventDate) {
    const target = new Date(eventDate);
    const today = new Date();
    const diffTime = target - today;
    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Generación de Alertas e Insights Inteligentes
  const alerts = [];
  const recommendations = [];

  if (daysRemaining !== null && daysRemaining <= 7 && phases[2].total > 0 && (phases[2].done / phases[2].total) < 0.8) {
    alerts.push({
      level: 'critical',
      title: '🚨 Cuello de Botella en Fase 2 (Planificación)',
      message: `Faltan solo ${daysRemaining} días para el torneo y la Fase 2 está al ${Math.round((phases[2].done / phases[2].total) * 100)}%. Se recomienda cerrar tareas de arbitraje y permisos.`
    });
  }

  const antiCheatingTask = tasks.find(t => (t.title || '').toLowerCase().includes('anti-cheating') || (t.title || '').toLowerCase().includes('antifraude'));
  if (!antiCheatingTask || !antiCheatingTask.completed) {
    alerts.push({
      level: 'warning',
      title: '⚠️ Protocolo Anti-Cheating FIDE Pendiente',
      message: 'Es obligatorio definir el oficial responsable y el protocolo de escaneo de metal previa a la Ronda 1.'
    });
  }

  const basesTask = tasks.find(t => (t.title || '').toLowerCase().includes('bases') || (t.title || '').toLowerCase().includes('reglamento'));
  if (!basesTask || !basesTask.completed) {
    recommendations.push({
      action: 'generate_bases_pdf',
      label: '📄 Generar Bases Oficiales en PDF',
      description: 'El copiloto puede redactar y descargar las Bases del Torneo automáticamente.'
    });
  }

  return {
    metrics: {
      total,
      completed,
      inProgress,
      pending,
      progressPct,
      daysRemaining
    },
    phaseProgress: {
      preProjectPct: phases[1].total > 0 ? Math.round((phases[1].done / phases[1].total) * 100) : 0,
      projectPct: phases[2].total > 0 ? Math.round((phases[2].done / phases[2].total) * 100) : 0,
      eventPct: phases[3].total > 0 ? Math.round((phases[3].done / phases[3].total) * 100) : 0,
      postEventPct: phases[4].total > 0 ? Math.round((phases[4].done / phases[4].total) * 100) : 0
    },
    alerts,
    recommendations
  };
}
