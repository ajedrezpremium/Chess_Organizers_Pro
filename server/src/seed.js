import bcrypt from 'bcryptjs';
import { getDb } from './db/index.js';

async function seed() {
  const db = getDb();

  console.log('🌱 Sembrando base de datos...');

  // Admin por defecto
  const adminHash = await bcrypt.hash('admin123', 12);
  const admin = db.prepare(`
    INSERT OR IGNORE INTO users (email, password_hash, name, role, federation)
    VALUES (?, ?, ?, ?, ?)
  `).run('admin@chessorganizerspro.com', adminHash, 'Admin', 'admin', 'FIDE');

  if (admin.changes > 0) {
    console.log('  ✓ Admin creado: admin@chessorganizerspro.com / admin123');
  } else {
    console.log('  ~ Admin ya existente');
  }

  // Admin demo
  const demoHash = await bcrypt.hash('demo123', 12);
  db.prepare(`
    INSERT OR IGNORE INTO users (email, password_hash, name, role, federation)
    VALUES (?, ?, ?, ?, ?)
  `).run('demo@chessorganizers.com', demoHash, 'Organizador Demo', 'organizer', 'ESP');

  console.log('  ✓ Demo: demo@chessorganizers.com / demo123');

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
    INSERT OR IGNORE INTO players (fide_id, name, last_name, title, federation, fide_rating)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (const p of demoPlayers) {
    const r = insertPlayer.run(p.fide_id, p.name, p.last_name, p.title, p.federation, p.fide_rating);
    if (r.changes > 0) count++;
  }
  console.log(`  ✓ ${count} jugadores de muestra insertados`);

  // Torneo de muestra
  const existingT = db.prepare('SELECT id FROM tournaments WHERE name = ?').get('Candidates Warm-up 2026');
  if (!existingT) {
    const tResult = db.prepare(`
      INSERT INTO tournaments (name, system, n_rounds, start_date, end_date, city, federation, time_control, rated, chief_arbiter, description, status, primary_color, secondary_color, logo_url, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('Candidates Warm-up 2026', 'dutch', 9, '2026-06-01', '2026-06-10', 'Madrid', 'ESP', '90+30', 1, 'IA Fernando García', 'Torneo de preparación para el Candidates 2026', 'active', '#f59e0b', '#1f2937', '', 1);

    const demoUserId = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@chessorganizers.com')?.id;
    if (demoUserId) {
      db.prepare(`
        UPDATE tournaments SET created_by = ? WHERE id = ?
      `).run(demoUserId, tResult.lastInsertRowid);
    }

    // Inscribir jugadores al torneo
    const insertTP = db.prepare(`
      INSERT INTO tournament_players (tournament_id, player_id, seed_rank)
      VALUES (?, (SELECT id FROM players WHERE fide_id = ?), ?)
    `);

    demoPlayers.forEach((p, i) => {
      insertTP.run(tResult.lastInsertRowid, p.fide_id, i + 1);
    });

    console.log(`  ✓ Torneo "Candidates Warm-up 2026" creado con ${demoPlayers.length} jugadores`);
  } else {
    console.log('  ~ Torneo de muestra ya existente');
  }

  console.log('✅ Seed completado.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed falló:', err);
  process.exit(1);
});
