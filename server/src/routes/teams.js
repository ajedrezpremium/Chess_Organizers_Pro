import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// POST /tournaments/:tid/teams — crear equipo
router.post('/tournaments/:tid/teams', (req, res) => {
  const db = getDb();
  const t = db.prepare('SELECT * FROM tournaments WHERE id = ? AND created_by = ?').get(req.params.tid, req.user.id);
  if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });

  const { name, short_name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre del equipo requerido' });

  const result = db.prepare('INSERT INTO teams (tournament_id, name, short_name) VALUES (?, ?, ?)').run(req.params.tid, name.trim(), (short_name || name.trim().slice(0, 3).toUpperCase()));
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(team);
});

// GET /tournaments/:tid/teams — listar equipos con miembros
router.get('/tournaments/:tid/teams', (req, res) => {
  const db = getDb();
  const teams = db.prepare('SELECT * FROM teams WHERE tournament_id = ? ORDER BY name ASC').all(req.params.tid);
  for (const team of teams) {
    team.members = db.prepare(`
      SELECT tm.*, tp.seed_rank, p.name, p.last_name, p.fide_rating, p.title, p.federation
      FROM team_members tm
      JOIN tournament_players tp ON tm.tournament_player_id = tp.id
      JOIN players p ON tp.player_id = p.id
      WHERE tm.team_id = ?
      ORDER BY tm.board_number ASC
    `).all(team.id);
  }
  res.json(teams);
});

// DELETE /teams/:id
router.delete('/teams/:id', (req, res) => {
  const db = getDb();
  const team = db.prepare(`
    SELECT t.* FROM teams t JOIN tournaments tn ON t.tournament_id = tn.id
    WHERE t.id = ? AND tn.created_by = ?
  `).get(req.params.id, req.user.id);
  if (!team) return res.status(404).json({ error: 'Equipo no encontrado' });
  db.prepare('DELETE FROM teams WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /teams/:id/members — añadir jugador a equipo
router.post('/teams/:id/members', (req, res) => {
  const db = getDb();
  const team = db.prepare(`
    SELECT t.* FROM teams t JOIN tournaments tn ON t.tournament_id = tn.id
    WHERE t.id = ? AND tn.created_by = ?
  `).get(req.params.id, req.user.id);
  if (!team) return res.status(404).json({ error: 'Equipo no encontrado' });

  const { tournament_player_id, board_number } = req.body;
  if (!tournament_player_id) return res.status(400).json({ error: 'Jugador requerido' });

  // Verificar que el jugador pertenece al torneo
  const tp = db.prepare('SELECT id FROM tournament_players WHERE id = ? AND tournament_id = ?').get(tournament_player_id, team.tournament_id);
  if (!tp) return res.status(400).json({ error: 'Jugador no pertenece al torneo' });

  try {
    const result = db.prepare('INSERT INTO team_members (team_id, tournament_player_id, board_number) VALUES (?, ?, ?)').run(req.params.id, tournament_player_id, board_number ?? 1);
    const member = db.prepare(`
      SELECT tm.*, p.name, p.last_name, p.fide_rating, p.title, p.federation
      FROM team_members tm
      JOIN tournament_players tp ON tm.tournament_player_id = tp.id
      JOIN players p ON tp.player_id = p.id
      WHERE tm.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json(member);
  } catch {
    res.status(409).json({ error: 'El jugador ya está en el equipo o el tablero está ocupado' });
  }
});

// DELETE /team_members/:id
router.delete('/team_members/:id', (req, res) => {
  const db = getDb();
  const member = db.prepare(`
    SELECT tm.* FROM team_members tm
    JOIN teams t ON tm.team_id = t.id
    JOIN tournaments tn ON t.tournament_id = tn.id
    WHERE tm.id = ? AND tn.created_by = ?
  `).get(req.params.id, req.user.id);
  if (!member) return res.status(404).json({ error: 'Miembro no encontrado' });
  db.prepare('DELETE FROM team_members WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// GET /tournaments/:tid/team-standings — clasificación por equipos
router.get('/tournaments/:tid/team-standings', (req, res) => {
  const db = getDb();
  const teams = db.prepare('SELECT * FROM teams WHERE tournament_id = ? ORDER BY name ASC').all(req.params.tid);

  const result = teams.map((team) => {
    const members = db.prepare(`
      SELECT tm.board_number, tp.id, tp.current_points, p.name, p.last_name, p.fide_rating, p.title
      FROM team_members tm
      JOIN tournament_players tp ON tm.tournament_player_id = tp.id
      JOIN players p ON tp.player_id = p.id
      WHERE tm.team_id = ?
      ORDER BY tm.board_number ASC
    `).all(team.id);

    const totalPoints = members.reduce((sum, m) => sum + (m.current_points || 0), 0);
    const avgRating = members.length > 0 ? Math.round(members.reduce((s, m) => s + (m.fide_rating || 0), 0) / members.length) : 0;

    return {
      id: team.id,
      name: team.name,
      short_name: team.short_name,
      members,
      totalPoints,
      avgRating,
      playerCount: members.length,
    };
  });

  result.sort((a, b) => b.totalPoints - a.totalPoints || b.avgRating - a.avgRating);
  const ranked = result.map((r, i) => ({ ...r, position: i + 1 }));

  res.json(ranked);
});

export default router;
