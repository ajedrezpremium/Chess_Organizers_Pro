import { getDb } from '../db/index.js';
import { sendMail } from './email.js';
import { sendTelegramMessage } from './telegram.js';
import { sendTwilioMessage } from './twilio.js';
import config from '../config.js';

function getPlayersByTournament(db, tid) {
  return db.prepare(`
    SELECT p.name, p.last_name, p.email
    FROM tournament_players tp
    JOIN players p ON tp.player_id = p.id
    WHERE tp.tournament_id = ? AND p.email != ''
  `).all(tid);
}

function getTournament(db, tid) {
  return db.prepare('SELECT name, status FROM tournaments WHERE id = ?').get(tid);
}

function getRound(db, rid) {
  return db.prepare('SELECT round_number, tournament_id FROM rounds WHERE id = ?').get(rid);
}

function getTournamentOwner(db, tid) {
  return db.prepare(`SELECT u.id, u.email FROM users u JOIN tournaments t ON t.user_id = u.id WHERE t.id = ?`).get(tid);
}

function getUserNotifySettings(db, userId) {
  return db.prepare(`SELECT * FROM user_notification_settings WHERE user_id = ?`).get(userId);
}

async function sendTelegramToOwner(db, tid, message) {
  const owner = getTournamentOwner(db, tid);
  if (!owner) return;
  const ns = getUserNotifySettings(db, owner.id);
  if (!ns || !ns.telegram_token || !ns.telegram_chat_id) return;
  await sendTelegramMessage(ns.telegram_token, ns.telegram_chat_id, message);
}

async function sendWhatsAppToPlayers(db, tid) {
  const owner = getTournamentOwner(db, tid);
  if (!owner) return;
  const ns = getUserNotifySettings(db, owner.id);
  if (!ns || !ns.twilio_phone) return;
  const players = getPlayersByTournament(db, tid);
  const t = getTournament(db, tid);
  for (const p of players) {
    if (p.phone) {
      await sendTwilioMessage(p.phone, `[${t.name}] Notificación del torneo. Más info: ${config.publicUrl}/public/tournament/${tid}`, 'whatsapp');
    }
  }
}

function createInAppNotification(db, userId, tournamentId, type, title, body = '') {
  db.prepare(`INSERT INTO notifications (user_id, tournament_id, type, title, body) VALUES (?, ?, ?, ?, ?)`)
    .run(userId, tournamentId, type, title, body);
}

// Notificar a jugadores que una nueva ronda está disponible
export async function notifyRoundGenerated(roundId) {
  const db = getDb();
  const round = getRound(db, roundId);
  if (!round) return;
  const t = getTournament(db, round.tournament_id);
  if (!t) return;

  const owner = getTournamentOwner(db, round.tournament_id);
  if (owner) {
    createInAppNotification(db, owner.id, round.tournament_id, 'round_generated',
      `Ronda ${round.round_number} generada`, `La ronda ${round.round_number} de ${t.name} ya está lista`);
  }

  const link = `${config.publicUrl}/public/tournament/${round.tournament_id}`;
  const subject = `[Chess Organizers] Ronda ${round.round_number} — ${t.name}`;
  const html = `<h2>${t.name}</h2><p>La ronda ${round.round_number} ya está disponible.</p><p><a href="${link}">Ver emparejamientos</a></p>`;

  const players = getPlayersByTournament(db, round.tournament_id);
  for (const p of players) {
    await sendMail({ to: p.email, subject, html });
  }

  await sendTelegramToOwner(db, round.tournament_id,
    `<b>${t.name}</b>\nRonda ${round.round_number} generada.\n<a href="${link}">Ver emparejamientos</a>`);
}

// Notificar cambio de resultado
export async function notifyResultUpdated(tournamentId) {
  const db = getDb();
  const t = getTournament(db, tournamentId);
  if (!t) return;

  const owner = getTournamentOwner(db, tournamentId);
  if (owner) {
    createInAppNotification(db, owner.id, tournamentId, 'result_updated',
      `Resultado actualizado`, `Se actualizó un resultado en ${t.name}`);
  }

  const link = `${config.publicUrl}/public/tournament/${tournamentId}`;
  const subject = `[Chess Organizers] Resultado actualizado — ${t.name}`;
  const html = `<h2>${t.name}</h2><p>Se ha actualizado un resultado.</p><p><a href="${link}">Ver clasificación</a></p>`;

  const players = getPlayersByTournament(db, tournamentId);
  for (const p of players) {
    await sendMail({ to: p.email, subject, html });
  }

  await sendTelegramToOwner(db, tournamentId,
    `<b>${t.name}</b>\nResultado actualizado.\n<a href="${link}">Ver clasificación</a>`);
}

// Notificar inscripción aprobada
export async function notifyRegistrationApproved(tournamentId, playerEmail, playerName) {
  if (!playerEmail) return;
  const db = getDb();
  const t = getTournament(db, tournamentId);
  if (!t) return;

  const owner = getTournamentOwner(db, tournamentId);
  if (owner) {
    createInAppNotification(db, owner.id, tournamentId, 'registration_approved',
      `Inscripción aprobada`, `${playerName} se inscribió a ${t.name}`);
  }

  const link = `${config.publicUrl}/public/tournament/${tournamentId}`;
  const subject = `[Chess Organizers] Inscripción aprobada — ${t.name}`;
  const html = `<h2>${t.name}</h2><p>Hola ${playerName}, tu inscripción ha sido aprobada.</p><p><a href="${link}">Ver torneo</a></p>`;

  await sendMail({ to: playerEmail, subject, html });
}
