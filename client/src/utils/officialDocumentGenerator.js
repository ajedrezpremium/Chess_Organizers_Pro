// src/utils/officialDocumentGenerator.js
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Generador de Documentos Oficiales en PDF para Torneos y Eventos Deportivos
 */

export function generateBasesPDF(tournament = {}) {
  const doc = new jsPDF();
  const name = tournament.name || 'Torneo de Ajedrez Profesional';
  const system = tournament.system || 'Suizo Neerlandés (FIDE)';
  const rounds = tournament.rounds || 7;
  const timeControl = tournament.timeControl || '90 min + 30 seg / jugada';
  const venue = tournament.venue || 'Recinto Deportivo Municipal';
  const dates = tournament.dates || '2026';

  // Encabezado
  doc.setFillColor(30, 41, 59); // Dark blue header
  doc.rect(0, 0, 210, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('BASES OFICIALES DEL TORNEO', 15, 18);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('CHESS ORGANIZERS PRO — FIDE COMPLIANT', 15, 27);

  // Cuerpo
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(name, 15, 48);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Lugar de juego: ${venue}`, 15, 56);
  doc.text(`Fechas: ${dates}`, 15, 62);
  doc.text(`Sistema de juego: ${system}`, 15, 68);
  doc.text(`Número de Rondas: ${rounds} Rondas`, 15, 74);
  doc.text(`Ritmo de juego: ${timeControl}`, 15, 80);

  // Sección Reglamento
  doc.setFont('helvetica', 'bold');
  doc.text('1. Reglamentación Técnica y Desempates FIDE', 15, 95);
  
  doc.setFont('helvetica', 'normal');
  const rulesText = [
    'El torneo se regirá por las Leyes del Ajedrez de la FIDE vigentes.',
    'Sistemas de Desempate en orden de prioridad:',
    '  a) Buchholz Cut-1 (Buchholz menos el peor resultado)',
    '  b) Buchholz Total',
    '  c) Sonneborn-Berger',
    '  d) Resultado Directo',
    '  e) Performance ELO',
    '',
    '2. Tolerancia y Comparecencia:',
    'El tiempo de demora máximo permitido en la mesa será de 15 minutos desde el inicio oficial de la ronda.',
    '',
    '3. Dispositivos Electrónicos y Protocolo Anti-Cheating:',
    'Queda estrictamente prohibida la entrada a la sala de juego con teléfonos móviles o relojes inteligentes activos.',
    'Se realizarán controles aleatorios de escaneo electromagnético antes del inicio de cada ronda.'
  ];

  let yPos = 103;
  rulesText.forEach(line => {
    doc.text(line, 15, yPos);
    yPos += 6;
  });

  // Tabla de Premios Ejemplo
  autoTable(doc, {
    startY: yPos + 5,
    head: [['Puesto', 'Premio General', 'Categoría Especial']],
    body: [
      ['1º Clasificado', '500 € + Trofeo', 'Campeón General'],
      ['2º Clasificado', '300 € + Trofeo', 'Subcampeón General'],
      ['3º Clasificado', '200 € + Medalla', '3º General'],
      ['1º Sub-18 / Senior', '100 € + Medalla', 'Mejor Tramo ELO'],
    ],
    headStyles: { fillColor: [37, 99, 235] },
    theme: 'grid'
  });

  // Pie de página
  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 20 : 250;
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text('Documento oficial generado por la Plataforma Chess Organizers.', 15, finalY);
  doc.text(`Fecha de emisión: ${new Date().toLocaleDateString()}`, 15, finalY + 5);

  doc.save(`Bases_Oficiales_${name.replace(/\s+/g, '_')}.pdf`);
}

export function generateContractPDF(data = {}) {
  const doc = new jsPDF();
  const title = data.title || 'Contrato de Servicios Arbitrales y Organización';
  const contractor = data.contractor || 'Organización Chess Kings Events S.L.';
  const arbiter = data.arbiter || 'Árbitro Principal FIDE';

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 15, 20);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Entidad Contratante: ${contractor}`, 15, 32);
  doc.text(`Prestador de Servicios: ${arbiter}`, 15, 40);
  doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 15, 48);

  const content = [
    'CLÁUSULAS DEL ACUERDO:',
    '1. El prestador de servicios se compromete a dirigir técnicamente el evento deportivo de acuerdo con la normativa vigente.',
    '2. La entidad organizadora facilitará la infraestructura física, tableros, relojes homologados y salas de descanso.',
    '3. Honorarios pactados conforme a las tarifas oficiales del Comité Técnico de Árbitros.',
    '4. Protección de datos conforme al RGPD de la Unión Europea.'
  ];

  let y = 62;
  content.forEach(line => {
    doc.text(line, 15, y);
    y += 8;
  });

  // Firmas
  doc.line(15, y + 40, 85, y + 40);
  doc.text('Firma Organización', 15, y + 46);

  doc.line(125, y + 40, 195, y + 40);
  doc.text('Firma Árbitro / Prestador', 125, y + 46);

  doc.save('Acuerdo_Oficial_Servicios.pdf');
}

export function generateArbiterActPDF(data = {}) {
  const doc = new jsPDF();
  const tournamentName = data.tournamentName || 'Torneo Oficial FIDE';
  const round = data.round || '1';
  const board = data.board || 'Mesa 1';
  const incidentTitle = data.title || 'Acta Arbitral de Incidencia y Resolución Técnica';
  const whitePlayer = data.whitePlayer || 'Blancas';
  const blackPlayer = data.blackPlayer || 'Negras';
  const decision = data.decision || 'Resolución del Árbitro Principal conforme al reglamento FIDE.';
  const articlesCited = data.articlesCited || 'Art. 7.5 (Jugadas Ilegales) / Art. 11.3 (Conducta y Dispositivos)';

  // Encabezado
  doc.setFillColor(15, 23, 42); // Dark slate
  doc.rect(0, 0, 210, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('ACTA ARBITRAL OFICIAL FIDE', 15, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('COMITÉ TÉCNICO DE ÁRBITROS — CHESS KINGS AUDIT', 15, 26);

  // Metadatos
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Evento: ${tournamentName}`, 15, 44);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Ronda: ${round}  |  Mesa: ${board}  |  Fecha: ${new Date().toLocaleDateString()}`, 15, 52);
  doc.text(`Partida: ${whitePlayer} (Blancas) vs ${blackPlayer} (Negras)`, 15, 58);

  // Tabla del Incidente
  autoTable(doc, {
    startY: 66,
    head: [['Campo', 'Detalle Técnico / Dictamen']],
    body: [
      ['Motivo de la Incidencia', incidentTitle],
      ['Artículos FIDE Aplicados', articlesCited],
      ['Resolución y Sanción', decision],
      ['Estado de la Partida', data.matchStatus || 'Reanudada con penalización de tiempo / Adjudicada'],
    ],
    headStyles: { fillColor: [220, 38, 38] }, // Red accent
    theme: 'striped'
  });

  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : 160;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Comité de Apelación:', 15, finalY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('El jugador disconforme puede recurrir ante el Comité de Apelación en un plazo máximo de 15 minutos tras finalizar la ronda, adjuntando la fianza reglamentaria.', 15, finalY + 6);

  // Firmas
  const signY = finalY + 30;
  doc.line(15, signY, 75, signY);
  doc.text('Firma Árbitro de Mesa', 15, signY + 6);

  doc.line(80, signY, 135, signY);
  doc.text('Firma Árbitro Principal FIDE', 80, signY + 6);

  doc.line(140, signY, 195, signY);
  doc.text('Firma Director del Torneo', 140, signY + 6);

  doc.save(`Acta_Arbitral_R${round}_${board.replace(/\s+/g, '_')}.pdf`);
}
