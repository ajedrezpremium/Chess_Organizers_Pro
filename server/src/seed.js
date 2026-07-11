import bcrypt from 'bcryptjs';
import { getDb } from './db/supabase.js';

async function seed() {
  const db = getDb();

  console.log('🌱 Sembrando base de datos...');

  // Admin por defecto
  const adminHash = await bcrypt.hash('admin123', 12);
  const admin = await db.prepare(`
    INSERT INTO users (email, password_hash, name, role, federation)
    VALUES (?, ?, ?, ?, ?)
  `).run('admin@chessorganizerspro.com', adminHash, 'Admin', 'admin', 'FIDE');

  const existingAdmin = await db.prepare('SELECT id FROM users WHERE email = ?').get('admin@chessorganizerspro.com');
  if (existingAdmin) {
    console.log('  ✓ Admin: admin@chessorganizerspro.com / admin123');
  }

  // Demo user
  const demoHash = await bcrypt.hash('demo123', 12);
  await db.prepare(`
    INSERT INTO users (email, password_hash, name, role, federation)
    VALUES (?, ?, ?, ?, ?)
  `).run('demo@chessorganizers.com', demoHash, 'Organizador Demo', 'organizer', 'ESP');

  const existingDemo = await db.prepare('SELECT id FROM users WHERE email = ?').get('demo@chessorganizers.com');
  if (existingDemo) {
    console.log('  ✓ Demo: demo@chessorganizers.com / demo123');
  }

  // Jugadores de muestra
  const demoPlayers = [
    { fide_id: '2200010', name: 'Magnus', last_name: 'Carlsen', title: 'GM', federation: 'NOR', fide_rating: 2831 },
    { fide_id: '1503014', name: 'Fabiano', last_name: 'Caruana', title: 'GM', federation: 'USA', fide_rating: 2796 },
    { fide_id: '4100018', name: 'Hikaru', last_name: 'Nakamura', title: 'GM', federation: 'USA', fide_rating: 2780 },
    { fide_id: '24116055', name: 'Alireza', last_name: 'Firouzja', title: 'GM', federation: 'FRA', fide_rating: 2773 },
    { fide_id: '14109603', name: 'Ian', last_name: 'Nepomniachtchi', title: 'GM', federation: 'RUS', fide_rating: 2758 },
    { fide_id: '3400042', name: 'Wesley', last_name: 'So', title: 'GM', federation: 'USA', fide_rating: 2752 },
    { fide_id: '12200190', name: 'Jan-Krzysztof', last_name: 'Duda', title: 'GM', federation: 'POL', fide_rating: 2748 },
    { fide_id: '8608280', name: 'Wei Yi', last_name: 'Wei', title: 'GM', federation: 'CHN', fide_rating: 2743 },
    { fide_id: '10600280', name: 'Bogdan-Daniel', last_name: 'Deac', title: 'GM', federation: 'ROU', fide_rating: 2718 },
    { fide_id: '14118040', name: 'Daniil', last_name: 'Dubov', title: 'GM', federation: 'RUS', fide_rating: 2716 },
    { fide_id: '13401319', name: 'Nodirbek', last_name: 'Abdusattorov', title: 'GM', federation: 'UZB', fide_rating: 2712 },
    { fide_id: '16204265', name: 'Vincent', last_name: 'Keymer', title: 'GM', federation: 'GER', fide_rating: 2706 },
    { fide_id: '5024592', name: 'Hans', last_name: 'Niemann', title: 'GM', federation: 'USA', fide_rating: 2698 },
    { fide_id: '14201886', name: 'Javokhir', last_name: 'Sindarov', title: 'GM', federation: 'UZB', fide_rating: 2694 },
    { fide_id: '24651554', name: 'Gukesh', last_name: 'Dommaraju', title: 'GM', federation: 'IND', fide_rating: 2690 },
    { fide_id: '46649425', name: 'Rameshbabu', last_name: 'Vaishali', title: 'IM', federation: 'IND', fide_rating: 2486 },
  ];

  const insertPlayer = db.prepare(`
    INSERT INTO players (fide_id, name, last_name, title, federation, fide_rating)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (const p of demoPlayers) {
    const r = await insertPlayer.run(p.fide_id, p.name, p.last_name, p.title, p.federation, p.fide_rating);
    if (r.changes > 0) count++;
  }
  console.log(`  ✓ ${count} jugadores de muestra insertados`);

  // Torneo de muestra
  const existingT = await db.prepare('SELECT id FROM tournaments WHERE name = ?').get('Candidates Warm-up 2026');
  if (!existingT) {
    const tResult = await db.prepare(`
      INSERT INTO tournaments (name, system, n_rounds, start_date, end_date, city, federation, time_control, rated, chief_arbiter, description, status, primary_color, secondary_color, logo_url, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('Candidates Warm-up 2026', 'dutch', 9, '2026-06-01', '2026-06-10', 'Madrid', 'ESP', '90+30', 1, 'IA Fernando García', 'Torneo de preparación para el Candidates 2026', 'active', '#f59e0b', '#1f2937', '', 1);

    const demoUserId = (await db.prepare('SELECT id FROM users WHERE email = ?').get('demo@chessorganizers.com'))?.id;
    if (demoUserId) {
      await db.prepare(`
        UPDATE tournaments SET created_by = ? WHERE id = ?
      `).run(demoUserId, tResult.lastInsertRowid);
    }

    // Inscribir jugadores al torneo
    const insertTP = db.prepare(`
      INSERT INTO tournament_players (tournament_id, player_id, seed_rank)
      VALUES (?, (SELECT id FROM players WHERE fide_id = ?), ?)
    `);

    for (let i = 0; i < demoPlayers.length; i++) {
      await insertTP.run(tResult.lastInsertRowid, demoPlayers[i].fide_id, i + 1);
    }

    console.log(`  ✓ Torneo "Candidates Warm-up 2026" creado con ${demoPlayers.length} jugadores`);
  } else {
    console.log('  ~ Torneo de muestra ya existente');
  }

  // ============================================================
  // TORNEOS DEMO PRECONFIGURADOS (para el panel del árbitro)
  // ============================================================
  const demoTournaments = [
    {
      name: '🏆 Liga Demo - División de Honor',
      system: 'roundrobin',
      n_rounds: 14,
      start_date: '2026-01-15',
      end_date: '2026-05-30',
      city: 'Madrid',
      federation: 'FEDA',
      time_control: '90+30',
      rated: 1,
      chief_arbiter: 'IA Demo Árbitro',
      description: 'Liga por equipos preconfigurada - Sistema Round Robin (Berger). 8 equipos, todos contra todos a doble vuelta. Ideal para aprender a gestionar ligas.',
      status: 'active',
      primary_color: '#8b5cf6',
      secondary_color: '#1f2937',
      logo_url: '',
      is_demo: true,
      teams: [
        { name: 'C.A. Madrid Chess', short_name: 'MAD', players: ['GM Magnus Carlsen', 'GM Fabiano Caruana', 'GM Hikaru Nakamura', 'GM Ian Nepomniachtchi'] },
        { name: 'C.A. Barcelona Ajedrez', short_name: 'BCN', players: ['GM Alireza Firouzja', 'GM Jan-Krzysztof Duda', 'GM Wei Yi', 'GM Vincent Keymer'] },
        { name: 'C.A. Valencia Masters', short_name: 'VAL', players: ['GM Bogdan-Daniel Deac', 'GM Daniil Dubov', 'GM Nodirbek Abdusattorov', 'GM Gukesh Dommaraju'] },
        { name: 'C.A. Sevilla Ajedrez', short_name: 'SEV', players: ['GM Rameshbabu Vaishali', 'IM Anna Muzychuk', 'IM Kateryna Lagno', 'IM Alexandra Kosteniuk'] },
      ],
    },
    {
      name: '🌐 Torneo Online Demo - Arena Rápida',
      system: 'dutch',
      n_rounds: 9,
      start_date: '2026-07-01',
      end_date: '2026-07-01',
      city: 'Online (Chess.com/Lichess)',
      federation: 'FIDE',
      time_control: '15+10',
      rated: 0,
      chief_arbiter: 'IA Online Demo',
      description: 'Torneo online preconfigurado - Sistema Suizo 9 rondas. Integración lista para Chess.com/Lichess. Perfecto para torneos semanales de club.',
      status: 'pending',
      primary_color: '#06b6d4',
      secondary_color: '#1f2937',
      logo_url: '',
      is_demo: true,
      players_count: 50,
    },
    {
      name: '🏟️ Torneo Presencial Demo - Open Ciudad',
      system: 'dutch',
      n_rounds: 7,
      start_date: '2026-08-15',
      end_date: '2026-08-17',
      city: 'Madrid',
      federation: 'FIDE',
      time_control: '60+30',
      rated: 1,
      chief_arbiter: 'IA Presencial Demo',
      description: 'Open presencial preconfigurado - Sistema Suizo 7 rondas. Incluye check-in por QR, emparejamientos automáticos, wallboard TV y homologación FIDE.',
      status: 'pending',
      primary_color: '#f97316',
      secondary_color: '#1f2937',
      logo_url: '',
      is_demo: true,
      players_count: 120,
    },
  ];

  const demoUserId = (await db.prepare('SELECT id FROM users WHERE email = ?').get('demo@chessorganizers.com'))?.id;

  for (const dt of demoTournaments) {
    const existing = await db.prepare('SELECT id FROM tournaments WHERE name = ?').get(dt.name);
    if (!existing) {
      const result = await db.prepare(`
        INSERT INTO tournaments (name, system, n_rounds, start_date, end_date, city, federation, time_control, rated, chief_arbiter, description, status, primary_color, secondary_color, logo_url, created_by, is_demo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        dt.name, dt.system, dt.n_rounds, dt.start_date, dt.end_date, dt.city,
        dt.federation, dt.time_control, dt.rated, dt.chief_arbiter, dt.description,
        dt.status, dt.primary_color, dt.secondary_color, dt.logo_url, demoUserId || 1, 1
      );

      const tid = result.lastInsertRowid;

      // Para liga: crear equipos y miembros
      if (dt.system === 'roundrobin' && dt.teams) {
        for (const team of dt.teams) {
          const teamRes = await db.prepare(`
            INSERT INTO teams (tournament_id, name, short_name) VALUES (?, ?, ?)
          `).run(tid, team.name, team.short_name);

          // Crear jugadores ficticios para el equipo si no existen
          for (let i = 0; i < team.players.length; i++) {
            const pname = team.players[i].split(' ');
            const fname = pname[0];
            const lname = pname.slice(1).join(' ');
            let player = await db.prepare('SELECT id FROM players WHERE name = ? AND last_name = ?').get(fname, lname);
            if (!player) {
              const pr = await db.prepare(`
                INSERT INTO players (name, last_name, title, federation, fide_rating)
                VALUES (?, ?, 'GM', 'ESP', 2500)
              `).run(fname, lname);
              player = { id: pr.lastInsertRowid };
            }
            await db.prepare(`
              INSERT INTO tournament_players (tournament_id, player_id, seed_rank)
              VALUES (?, ?, ?)
            `).run(tid, player.id, i * 4 + team.players.indexOf(team.players[i]) + 1);

            await db.prepare(`
              INSERT INTO team_members (team_id, tournament_player_id, board_number)
              VALUES (?, (SELECT id FROM tournament_players WHERE tournament_id = ? AND player_id = ?), ?)
            `).run(teamRes.lastInsertRowid, tid, player.id, i + 1);
          }
        }
      }

      // Para torneos suizos: crear jugadores ficticios si no hay suficientes
      if (dt.system === 'dutch' && dt.players_count) {
        const needed = dt.players_count;
        const existingPlayers = await db.prepare('SELECT id, fide_rating FROM players ORDER BY fide_rating DESC').all();
        for (let i = 0; i < Math.min(needed, existingPlayers.length); i++) {
          await db.prepare(`
            INSERT INTO tournament_players (tournament_id, player_id, seed_rank)
            VALUES (?, ?, ?)
          `).run(tid, existingPlayers[i].id, i + 1);
        }
      }

      console.log(`  ✓ Torneo Demo: "${dt.name}" (${dt.system})`);
    }
  }

  // ============================================================
  // TORNEOS PENDIENTES (10) - Próximos eventos (feed derecha)
  // ============================================================
  const pendingTournaments = [
    { name: 'Open Internacional Madrid 2026', system: 'dutch', n_rounds: 9, city: 'Madrid', federation: 'FIDE', start_date: '2026-09-01', end_date: '2026-09-07', time_control: '90+30', status: 'pending', player_count: 312, primary_color: '#f59e0b' },
    { name: 'Barcelona Chess Festival 2026', system: 'dutch', n_rounds: 10, city: 'Barcelona', federation: 'FIDE', start_date: '2026-09-15', end_date: '2026-09-22', time_control: '90+30', status: 'pending', player_count: 450, primary_color: '#3b82f6' },
    { name: 'Campeonato de España Absoluto 2026', system: 'dutch', n_rounds: 11, city: 'Linares', federation: 'FEDA', start_date: '2026-10-01', end_date: '2026-10-12', time_control: '90+30', status: 'pending', player_count: 128, primary_color: '#ec4899' },
    { name: 'Fischer Random World Championship', system: 'dutch', n_rounds: 9, city: 'Reykjavik', federation: 'FIDE', start_date: '2026-10-15', end_date: '2026-10-22', time_control: '45+15', status: 'pending', player_count: 64, primary_color: '#8b5cf6' },
    { name: 'Open de La Roda 2026', system: 'dutch', n_rounds: 9, city: 'La Roda', federation: 'FIDE', start_date: '2026-11-01', end_date: '2026-11-08', time_control: '90+30', status: 'pending', player_count: 200, primary_color: '#06b6d4' },
    { name: 'Liga Madrileña División de Honor 2026-27', system: 'roundrobin', n_rounds: 14, city: 'Madrid', federation: 'FEDA', start_date: '2026-10-15', end_date: '2027-03-30', time_control: '90+30', status: 'pending', player_count: 80, primary_color: '#6366f1' },
    { name: 'Torneo Internacional de Ajedrez Activo', system: 'dutch', n_rounds: 7, city: 'Valencia', federation: 'FIDE', start_date: '2026-09-20', end_date: '2026-09-22', time_control: '15+10', status: 'pending', player_count: 160, primary_color: '#ef4444' },
    { name: 'Campeonato Mundial de Blitz 2026', system: 'dutch', n_rounds: 21, city: 'Nueva York', federation: 'FIDE', start_date: '2026-12-15', end_date: '2026-12-20', time_control: '3+2', status: 'pending', player_count: 200, primary_color: '#84cc16' },
    { name: 'Abierto de Navidad Madrid 2026', system: 'dutch', n_rounds: 7, city: 'Madrid', federation: 'FEDA', start_date: '2026-12-26', end_date: '2026-12-30', time_control: '60+30', status: 'pending', player_count: 120, primary_color: '#14b8a6' },
    { name: 'Torneo Online COP Arena Navideña', system: 'dutch', n_rounds: 9, city: 'Online', federation: 'FIDE', start_date: '2026-12-20', end_date: '2026-12-20', time_control: '5+3', status: 'pending', player_count: 300, primary_color: '#f97316' },
  ];

  for (const t of pendingTournaments) {
    const existing = await db.prepare('SELECT id FROM tournaments WHERE name = ?').get(t.name);
    if (!existing) {
      await db.prepare(`
        INSERT INTO tournaments (name, system, n_rounds, start_date, end_date, city, federation, time_control, status, primary_color, secondary_color, description, is_demo, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      `).run(
        t.name, t.system, t.n_rounds, t.start_date, t.end_date, t.city,
        t.federation, t.time_control, t.status, t.primary_color, '#1f2937',
        `Torneo próximo — ${t.player_count} jugadores — Inscripciones abiertas`, 2
      );
    }
  }
  console.log(`✓ ${pendingTournaments.length} torneos pendientes insertados`);

  // ============================================================
  // TORNEOS ACTIVOS (10) - Para feed efecto llamada
  // ============================================================
  const pneidnetesTournaments = [
    { name: 'Open Internacional Madrid 2026', system: 'dutch', n_rounds: 9, city: 'Madrid', federation: 'FIDE', start_date: '2026-07-15', end_date: '2026-07-20', time_control: '90+30', status: 'active', player_count: 287, primary_color: '#f59e0b' },
    { name: 'Festival Ajedrez Barcelona 2026', system: 'dutch', n_rounds: 10, city: 'Barcelona', federation: 'FIDE', start_date: '2026-08-01', end_date: '2026-08-10', time_control: '90+30', status: 'active', player_count: 412, primary_color: '#3b82f6' },
    { name: 'Copa España Equipos 2026', system: 'dutch', n_rounds: 7, city: 'Valencia', federation: 'FEDA', start_date: '2026-06-01', end_date: '2026-06-04', time_control: '45+15', status: 'active', player_count: 128, primary_color: '#ef4444' },
    { name: 'Open Andorra 2026', system: 'dutch', n_rounds: 9, city: 'Andorra la Vella', federation: 'FIDE', start_date: '2026-07-25', end_date: '2026-08-02', time_control: '90+30', status: 'active', player_count: 156, primary_color: '#8b5cf6' },
    { name: 'Campeonato España Absoluto 2026', system: 'dutch', n_rounds: 11, city: 'Linares', federation: 'FEDA', start_date: '2026-07-10', end_date: '2026-07-20', time_control: '90+30', status: 'active', player_count: 120, primary_color: '#ec4899' },
    { name: 'Open La Roda 2026', system: 'dutch', n_rounds: 9, city: 'La Roda', federation: 'FIDE', start_date: '2026-08-15', end_date: '2026-08-22', time_control: '90+30', status: 'active', player_count: 200, primary_color: '#06b6d4' },
    { name: 'Open Benasque 2026', system: 'dutch', n_rounds: 10, city: 'Benasque', federation: 'FIDE', start_date: '2026-07-01', end_date: '2026-07-10', time_control: '90+30', status: 'active', player_count: 350, primary_color: '#f97316' },
    { name: 'Villa de Madrid 2026', system: 'dutch', n_rounds: 9, city: 'Madrid', federation: 'FIDE', start_date: '2026-07-01', end_date: '2026-07-07', time_control: '90+30', status: 'active', player_count: 250, primary_color: '#84cc16' },
    { name: 'Liga Madrileña Div. Honor 2026', system: 'roundrobin', n_rounds: 14, city: 'Madrid', federation: 'FEDA', start_date: '2026-01-15', end_date: '2026-05-30', time_control: '90+30', status: 'active', player_count: 80, primary_color: '#6366f1' },
    { name: 'Open Alcalá de Henares 2026', system: 'dutch', n_rounds: 9, city: 'Alcalá de Henares', federation: 'FIDE', start_date: '2026-08-20', end_date: '2026-08-26', time_control: '90+30', status: 'active', player_count: 160, primary_color: '#14b8a6' },
  ];

  for (const t of pneidnetesTournaments) {
    const existing = await db.prepare('SELECT id FROM tournaments WHERE name = ?').get(t.name);
    if (!existing) {
      await db.prepare(`
        INSERT INTO tournaments (name, system, n_rounds, start_date, end_date, city, federation, time_control, status, primary_color, secondary_color, description, is_demo, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      `).run(
        t.name, t.system, t.n_rounds, t.start_date, t.end_date, t.city,
        t.federation, t.time_control, t.status, t.primary_color, '#1f2937',
        `Torneo activo con ${t.player_count} jugadores - Efecto llamada`, 2
      );
    }
  }
  console.log(`  ✓ ${pneidnetesTournaments.length} torneos "PNEIDNETES" activos insertados`);

  // ============================================================
  // TORNEOS PASADOS (10) - Para feed histórico
  // ============================================================
  const pastTournaments = [
    { name: 'Open Internacional Madrid 2025', system: 'dutch', n_rounds: 9, city: 'Madrid', federation: 'FIDE', start_date: '2025-07-15', end_date: '2025-07-20', time_control: '90+30', status: 'finished', player_count: 265, primary_color: '#f59e0b' },
    { name: 'Festival Ajedrez Barcelona 2025', system: 'dutch', n_rounds: 10, city: 'Barcelona', federation: 'FIDE', start_date: '2025-08-01', end_date: '2025-08-10', time_control: '90+30', status: 'finished', player_count: 389, primary_color: '#3b82f6' },
    { name: 'Copa España Equipos 2025', system: 'dutch', n_rounds: 7, city: 'Sevilla', federation: 'FEDA', start_date: '2025-06-01', end_date: '2025-06-04', time_control: '45+15', status: 'finished', player_count: 120, primary_color: '#ef4444' },
    { name: 'Open Andorra 2025', system: 'dutch', n_rounds: 9, city: 'Andorra la Vella', federation: 'FIDE', start_date: '2025-07-25', end_date: '2025-08-02', time_control: '90+30', status: 'finished', player_count: 142, primary_color: '#8b5cf6' },
    { name: 'Campeonato España Absoluto 2025', system: 'dutch', n_rounds: 11, city: 'Linares', federation: 'FEDA', start_date: '2025-07-10', end_date: '2025-07-20', time_control: '90+30', status: 'finished', player_count: 115, primary_color: '#ec4899' },
    { name: 'Open La Roda 2025', system: 'dutch', n_rounds: 9, city: 'La Roda', federation: 'FIDE', start_date: '2025-08-15', end_date: '2025-08-22', time_control: '90+30', status: 'finished', player_count: 187, primary_color: '#06b6d4' },
    { name: 'Open Benasque 2025', system: 'dutch', n_rounds: 10, city: 'Benasque', federation: 'FIDE', start_date: '2025-07-01', end_date: '2025-07-10', time_control: '90+30', status: 'finished', player_count: 320, primary_color: '#f97316' },
    { name: 'Villa de Madrid 2025', system: 'dutch', n_rounds: 9, city: 'Madrid', federation: 'FIDE', start_date: '2025-07-01', end_date: '2025-07-07', time_control: '90+30', status: 'finished', player_count: 234, primary_color: '#84cc16' },
    { name: 'Liga Madrileña Div. Honor 2025', system: 'roundrobin', n_rounds: 14, city: 'Madrid', federation: 'FEDA', start_date: '2025-01-15', end_date: '2025-05-30', time_control: '90+30', status: 'finished', player_count: 80, primary_color: '#6366f1' },
    { name: 'Open Alcalá de Henares 2025', system: 'dutch', n_rounds: 9, city: 'Alcalá de Henares', federation: 'FIDE', start_date: '2025-08-20', end_date: '2025-08-26', time_control: '90+30', status: 'finished', player_count: 145, primary_color: '#14b8a6' },
  ];

  for (const t of pastTournaments) {
    const existing = await db.prepare('SELECT id FROM tournaments WHERE name = ?').get(t.name);
    if (!existing) {
      await db.prepare(`
        INSERT INTO tournaments (name, system, n_rounds, start_date, end_date, city, federation, time_control, status, primary_color, secondary_color, description, is_demo, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      `).run(
        t.name, t.system, t.n_rounds, t.start_date, t.end_date, t.city,
        t.federation, t.time_control, t.status, t.primary_color, '#1f2937',
        `Torneo finalizado - ${t.player_count} jugadores - Resultados disponibles`, 2
      );
    }
  }
  console.log(`  ✓ ${pastTournaments.length} torneos pasados insertados`);

  console.log('✅ Seed completado.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed falló:', err);
  process.exit(1);
});
