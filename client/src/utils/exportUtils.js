import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const SYS_LABELS = { dutch: 'Suizo Holandés', roundrobin: 'Round Robin', burstein: 'Burstein', dubov: 'Dubov' };

// ── Download helper ─────────────────────────────────────────────────

function download(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click(); URL.revokeObjectURL(url);
}

// ── CSV ─────────────────────────────────────────────────────────────

export function exportPlayersCSV(tournament, players) {
  const headers = ['#', 'Nombre', 'Apellido', 'Título', 'Rating FIDE', 'Federación', 'FIDE ID', 'Puntos'];
  const rows = players.map((p) => [p.seed_rank, p.name, p.last_name || '', p.title || '', p.fide_rating || '', p.federation || '', p.fide_id || '', p.current_points ?? 0]);
  const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
  download(`${tournament.name.replace(/\s+/g, '_')}_jugadores.csv`, csv, 'text/csv;charset=utf-8');
}

export function exportStandingsCSV(tournament, standings) {
  if (!standings) return;
  const headers = ['#', 'Nombre', 'Apellido', 'Título', 'Rating', 'Puntos', ...(standings.tiebreaks || [])];
  const rows = standings.standings.map((s) => [s.position, s.name, s.lastName || '', s.title || '', s.fideRating || '', s.points, ...(s.tiebreakValues || [])]);
  const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
  download(`${tournament.name.replace(/\s+/g, '_')}_clasificacion.csv`, csv, 'text/csv;charset=utf-8');
}

export function exportPairingsCSV(tournament, rounds) {
  if (!rounds || rounds.length === 0) return;
  const headers = ['Ronda', 'Mesa', 'Blancas', 'Rating B', 'Resultado', 'Negras', 'Rating N'];
  const rows = [];
  for (const r of rounds) {
    if (!r.pairings) continue;
    for (const p of r.pairings) {
      rows.push([r.round_number, p.board,
        `${p.white_name || ''} ${p.white_last || ''}`.trim(), p.white_rating || '',
        p.result,
        p.is_bye ? 'BYE' : `${p.black_name || ''} ${p.black_last || ''}`.trim(), p.is_bye ? '' : p.black_rating || '',
      ]);
    }
  }
  const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
  download(`${tournament.name.replace(/\s+/g, '_')}_pairings.csv`, csv, 'text/csv;charset=utf-8');
}

// ── PGN ─────────────────────────────────────────────────────────────

export function exportPGN(tournament, rounds) {
  if (!rounds || rounds.length === 0) return;
  const lines = [];
  const event = tournament.name;
  const site = tournament.city || '?';
  const date = (tournament.start_date || '').slice(0, 10).replace(/-/g, '.') || '????.??.??';
  const timeControl = tournament.time_control || '?';

  let gameNum = 0;
  for (const r of rounds) {
    if (!r.pairings) continue;
    for (const p of r.pairings) {
      if (p.is_bye) continue;
      gameNum++;
      const white = `${p.white_name || '?'} ${p.white_last || ''}`.trim();
      const black = `${p.black_name || '?'} ${p.black_last || ''}`.trim();
      const result = p.result === '1' ? '1-0' : p.result === '0' ? '0-1' : p.result === '=' ? '1/2-1/2' : '*';
      const round = r.round_number;

      lines.push(`[Event "${event}"]`);
      lines.push(`[Site "${site}"]`);
      lines.push(`[Date "${date}"]`);
      lines.push(`[Round "${round}"]`);
      lines.push(`[White "${white}"]`);
      lines.push(`[Black "${black}"]`);
      lines.push(`[Result "${result}"]`);
      lines.push(`[WhiteElo "${p.white_rating || '?'}"]`);
      lines.push(`[BlackElo "${p.black_rating || '?'}"]`);
      lines.push(`[TimeControl "${timeControl}"]`);
      lines.push(`[GameNumber "${gameNum}"]`);
      lines.push('');
      lines.push(result);
      lines.push('');
    }
  }

  download(`${tournament.name.replace(/\s+/g, '_')}.pgn`, lines.join('\n'), 'text/plain;charset=utf-8');
}

// ── PDF ─────────────────────────────────────────────────────────────

export function exportStandingsPDF(tournament, standings) {
  if (!standings || standings.standings.length === 0) return;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('♛ CHESS ORGANIZERS PRO', pageW / 2, 16, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(tournament.name, pageW / 2, 24, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(`${SYS_LABELS[tournament.system] || tournament.system} · ${tournament.n_rounds} rondas${tournament.federation ? ` · ${tournament.federation}` : ''}`, pageW / 2, 30, { align: 'center' });

  // Standings table
  doc.setTextColor(0);
  const header = ['#', 'Jugador', 'Título', 'Elo', 'Pts', ...(standings.tiebreaks || []).map((t) => t.toUpperCase())];
  const body = standings.standings.map((s) => [
    s.position,
    `${s.name} ${s.lastName || ''}`.trim(),
    s.title || '',
    s.fideRating || '-',
    s.points.toFixed(1),
    ...(s.tiebreakValues || []).map((v) => (typeof v === 'number' ? v.toFixed(2) : v)),
  ]);

  doc.autoTable({
    head: [header],
    body,
    startY: 36,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 4: { halign: 'center', fontStyle: 'bold' } },
  });

  // Footer
  const dateStr = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(`Generado el ${dateStr} · Chess Organizers Pro`, pageW / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

  doc.save(`${tournament.name.replace(/\s+/g, '_')}_clasificacion.pdf`);
}

export function exportPairingsPDF(tournament, rounds) {
  if (!rounds || rounds.length === 0) return;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  for (let i = 0; i < rounds.length; i++) {
    const r = rounds[i];
    if (!r.pairings || r.pairings.length === 0) continue;

    if (i > 0) doc.addPage();

    // Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`♛ Ronda ${r.round_number}`, pageW / 2, 16, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(tournament.name, pageW / 2, 23, { align: 'center' });

    const body = r.pairings.map((p) => [
      p.board,
      `${p.white_name || ''} ${p.white_last || ''}`.trim(),
      p.white_rating || '',
      p.is_bye ? 'BYE' : `${p.black_name || ''} ${p.black_last || ''}`.trim(),
      p.is_bye ? '' : p.black_rating || '',
      p.result === '1' ? '1-0' : p.result === '0' ? '0-1' : p.result === '=' ? '½-½' : p.result || '-',
    ]);

    doc.autoTable({
      head: [[{ content: 'Ronda ' + r.round_number, colSpan: 6, styles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: 'bold', fontSize: 10 } }]],
      startY: 30,
      styles: { fontSize: 0 }, // hidden header
    });

    // Remove that fake header row and use real header
    doc.autoTable({
      head: [['Mesa', 'Blancas', 'Elo', 'Negras', 'Elo', 'Resultado']],
      body,
      startY: doc.lastAutoTable.finalY || 30,
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [100, 120, 140], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 14, halign: 'center' },
        5: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
      },
    });

    // Status badge text
    doc.setFontSize(7);
    doc.setTextColor(r.status === 'closed' ? 'green' : '#999');
    doc.text(`Estado: ${r.status === 'closed' ? 'Cerrada' : 'En curso'}`, 14, doc.lastAutoTable.finalY + 8);
  }

  // Footer on last page
  const dateStr = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(`Generado el ${dateStr} · Chess Organizers Pro`, pageW / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

  doc.save(`${tournament.name.replace(/\s+/g, '_')}_pairings.pdf`);
}

export function exportCrosstablePDF(tournament, crosstabData) {
  if (!crosstabData || !crosstabData.players || crosstabData.players.length === 0) return;
  const { players, nRounds } = crosstabData;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('♛ CHESS ORGANIZERS PRO', pageW / 2, 16, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(tournament.name, pageW / 2, 24, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(`${SYS_LABELS[tournament.system] || tournament.system} · ${nRounds} rondas${tournament.federation ? ` · ${tournament.federation}` : ''}`, pageW / 2, 30, { align: 'center' });

  doc.setTextColor(0);

  const header = ['#', 'Jugador', 'Elo', 'Pts', ...Array.from({ length: nRounds }, (_, i) => `R${i + 1}`)];
  const body = players.map((p, i) => [
    i + 1,
    `${p.name} ${p.lastName || ''}`.trim(),
    p.rating || '-',
    p.points.toFixed(1),
    ...p.rounds.map((r) => {
      if (r.isBye) return 'B';
      if (!r.opponent) return '-';
      const result = r.result === '=' ? '½' : r.result;
      return `${result}${r.color === 'W' ? 'w' : 'b'}`;
    }),
  ]);

  doc.autoTable({
    head: [header],
    body,
    startY: 36,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      2: { halign: 'center', cellWidth: 12 },
      3: { halign: 'center', cellWidth: 10, fontStyle: 'bold' },
    },
  });

  const dateStr = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(`Generado el ${dateStr} · Chess Organizers Pro`, pageW / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

  doc.save(`${tournament.name.replace(/\s+/g, '_')}_crosstable.pdf`);
}

export function exportTournamentReportPDF(tournament, standings, rounds, players, crosstabData) {
  if (!tournament) return;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // ── Page 1: Tournament info + Standings ──
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('♛ CHESS ORGANIZERS PRO', pageW / 2, 16, { align: 'center' });
  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text(tournament.name, pageW / 2, 25, { align: 'center' });

  const infoLines = [
    `Sistema: ${SYS_LABELS[tournament.system] || tournament.system}`,
    `Rondas: ${tournament.n_rounds}`,
    `Inicio: ${tournament.start_date || '-'}`,
    `Ritmo: ${tournament.time_control || '-'}`,
    tournament.federation ? `Federación: ${tournament.federation}` : null,
    tournament.city ? `Sede: ${tournament.city}` : null,
    `Estado: ${tournament.status === 'active' ? 'En curso' : tournament.status === 'finished' ? 'Finalizado' : 'Programado'}`,
  ].filter(Boolean);

  doc.setFontSize(9);
  doc.setTextColor(80);
  let yOff = 34;
  for (const line of infoLines) {
    doc.text(line, 14, yOff);
    yOff += 5.5;
  }

  // Standings section
  if (standings && standings.standings && standings.standings.length > 0) {
    yOff += 4;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Clasificación', 14, yOff);
    yOff += 6;

    const stHeader = ['#', 'Jugador', 'Título', 'Elo', 'Pts', ...(standings.tiebreaks || []).map((t) => t.toUpperCase())];
    const stBody = standings.standings.slice(0, 40).map((s) => [
      s.position,
      `${s.name} ${s.lastName || ''}`.trim(),
      s.title || '',
      s.fideRating || '-',
      s.points.toFixed(1),
      ...(s.tiebreakValues || []).map((v) => (typeof v === 'number' ? v.toFixed(2) : v)),
    ]);

    doc.autoTable({
      head: [stHeader],
      body: stBody,
      startY: yOff,
      styles: { fontSize: 7.5, cellPadding: 1.5 },
      headStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 4: { halign: 'center', fontStyle: 'bold' } },
    });
    yOff = doc.lastAutoTable.finalY + 6;
  } else {
    yOff += 6;
  }

  // ── Page 2+: Pairings ──
  if (rounds && rounds.length > 0) {
    doc.addPage();
    yOff = 16;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Emparejamientos', pageW / 2, yOff, { align: 'center' });
    yOff += 8;

    for (const r of rounds) {
      if (!r.pairings || r.pairings.length === 0) continue;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Ronda ${r.round_number}`, 14, yOff);
      yOff += 5;

      const pairingBody = r.pairings.map((p) => [
        p.board,
        `${p.white_name || ''} ${p.white_last || ''}`.trim(),
        p.white_rating || '',
        p.is_bye ? 'BYE' : `${p.black_name || ''} ${p.black_last || ''}`.trim(),
        p.is_bye ? '' : p.black_rating || '',
        p.result === '1' ? '1-0' : p.result === '0' ? '0-1' : p.result === '=' ? '½-½' : p.result || '-',
      ]);

      const startY = yOff;
      doc.autoTable({
        head: [['Mesa', 'Blancas', 'Elo', 'Negras', 'Elo', 'Resultado']],
        body: pairingBody,
        startY,
        styles: { fontSize: 7.5, cellPadding: 1.5 },
        headStyles: { fillColor: [100, 120, 140], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 5: { halign: 'center', fontStyle: 'bold' } },
      });

      yOff = doc.lastAutoTable.finalY + 6;
      if (yOff > pageH - 20) {
        doc.addPage();
        yOff = 16;
      }
    }
  }

  // ── Page: Crosstable ──
  if (crosstabData && crosstabData.players && crosstabData.players.length > 0) {
    doc.addPage();
    const { players: cp, nRounds: nr } = crosstabData;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Tabla Cruzada', pageW / 2, 16, { align: 'center' });

    const ctHeader = ['#', 'Jugador', 'Elo', 'Pts', ...Array.from({ length: nr }, (_, i) => `R${i + 1}`)];
    const ctBody = cp.map((p, i) => [
      i + 1,
      `${p.name} ${p.lastName || ''}`.trim(),
      p.rating || '-',
      p.points.toFixed(1),
      ...p.rounds.map((r) => {
        if (r.isBye) return 'B';
        if (!r.opponent) return '-';
        const result = r.result === '=' ? '½' : r.result;
        return `${result}${r.color === 'W' ? 'w' : 'b'}`;
      }),
    ]);

    doc.autoTable({
      head: [ctHeader],
      body: ctBody,
      startY: 22,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 7, halign: 'center' },
        2: { halign: 'center', cellWidth: 10 },
        3: { halign: 'center', cellWidth: 9, fontStyle: 'bold' },
      },
    });
  }

  // Footer on last page
  const dateStr = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(`Generado el ${dateStr} · Chess Organizers Pro`, pageW / 2, pageH - 10, { align: 'center' });

  doc.save(`${tournament.name.replace(/\s+/g, '_')}_reporte_completo.pdf`);
}
