# Auditoría de la capa de rutas — backend desplegado (`api/_src/routes`, `api/_src/middleware`)

**Fecha:** 2026-11-08 · **Método:** auditoría estática (read/grep) sobre el código desplegado en `api/`. El shell de este entorno no funciona: **no se ha ejecutado nada**, ni tests ni peticiones.
**Alcance:** `api/_src/routes/*.js` (26 archivos) y `api/_src/middleware/*.js`. Se leen `api/_src/index.js`, `api/_src/db/supabase.js` y algunos servicios **solo como evidencia de soporte** de lo que hacen las rutas. `server/` queda fuera (fork obsoleto).
**Total:** 58 hallazgos (9 CRÍTICO · 21 ALTO · 19 MEDIO · 9 BAJO).

---

## 0. Correcciones a las premisas de partida (importante)

Dos supuestos del encargo **no se sostienen** contra el código; afectan a cómo se leen los hallazgos de integridad:

- **El shim NO añade `ON CONFLICT DO NOTHING` a los `INSERT`.** El comentario y el código lo desmienten en `api/_src/db/supabase.js:36`:
  ```js
  // ON CONFLICT DO NOTHING removed — interferes with RETURNING *
  ```
  Además `run()` añade `RETURNING *` y calcula el id (`supabase.js:57-59`):
  ```js
  if (isInsert && !/\bRETURNING\b/i.test(execSql)) execSql += ' RETURNING *';
  const lastInsertRowid = isInsert ? (result.rows?.[0]?.id ?? null) : null;
  ```
  Conclusión: `lastInsertRowid` **sí funciona** en Postgres para tablas con columna `id`. Los fallos de "insert sin id" que se atribuían a esto tienen otra causa (ver F-24, F-40).
- **El shim sí hace algo peligroso, pero distinto:** degrada `INSERT OR IGNORE` a `INSERT` (`supabase.js:33`) y **descarta silenciosamente los parámetros `undefined`** (`supabase.js:58`, `params.filter(p => p !== undefined)`), lo que rompe el conteo de `$n` y produce errores 500 opacos.

---

## 1. Resumen

| Severidad | Nº | Patrón dominante |
|---|---|---|
| CRÍTICO | 9 | Escrituras sin comprobación de propiedad sobre recursos ajenos (resultados, actas, puntos, ligas, matches) |
| ALTO | 21 | Lecturas cruzadas entre inquilinos, datos privados en `/public`, endpoints caros sin límite, respuestas que mienten sobre el resultado |
| MEDIO | 19 | Operaciones multi-tabla sin transacción, `err.message` al cliente, códigos de estado incorrectos |
| BAJO | 9 | Robustez, fugas menores, código muerto |

La causa raíz es única y repetida: **`authenticate` se aplica casi siempre, la comprobación de propiedad se aplica a veces**. No existe un helper único de autorización por recurso; conviven cuatro estilos (`created_by = ?`, `isArbiterOf()`, `JOIN ... t.created_by = ?`, y ninguno).

---

## 2. CRÍTICO

### F-01 · CRÍTICO · `PATCH /rounds/:rid/result` — cualquier usuario cambia cualquier resultado
- **Evidencia** `api/_src/routes/rounds.js:224,232,235`
  ```js
  const pairing = await db.prepare('SELECT * FROM pairings WHERE id = ?').get(pairing_id);
  await db.prepare('UPDATE pairings SET result = ? WHERE id = ?').run(result, pairing_id);
  ```
- **Hecho:** la ruta solo valida que `result` esté en `['1','0','=','U','F','H','Z','-']` (`rounds.js:227`). No comprueba propiedad del torneo, ni que `pairing_id` pertenezca a `:rid`. `:rid` no se usa para nada.
- **Impacto:** un usuario autenticado cualquiera reescribe la clasificación de cualquier torneo del mundo pasando `pairing_id`. Es la integridad competitiva del producto.
- **Arreglo:** `SELECT p.* FROM pairings p JOIN rounds r ON r.id=p.round_id JOIN tournaments t ON t.id=r.tournament_id WHERE p.id=? AND r.id=? AND t.created_by=?` antes del `UPDATE`.

### F-02 · CRÍTICO · `DELETE /incidents/:id` — borrado de actas de arbitraje sin propiedad
- **Evidencia** `api/_src/routes/incidents.js:51,54`
  ```js
  router.delete('/:id', authenticate, async (req, res) => {
    await db.prepare('DELETE FROM incidents WHERE id = ?').run(req.params.id);
  ```
- **Impacto:** cualquier autenticado borra incidencias (conducta, reloj, reclamaciones) de torneos ajenos. Dato con valor probatorio; borrado irreversible y sin traza.
- **Arreglo:** `DELETE ... WHERE id=? AND tournament_id IN (SELECT id FROM tournaments WHERE created_by=?)`.

### F-03 · CRÍTICO · `PATCH /incidents/:id` — se pueden cerrar/editar incidencias ajenas
- **Evidencia** `api/_src/routes/incidents.js:33,45`
  ```js
  await db.prepare(`UPDATE incidents SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  ```
- **Impacto:** se altera `status`, `priority` y `description` de cualquier incidencia sin comprobar torneo ni árbitro asignado. Combinado con F-02 permite reescribir el relato de una reclamación antes de borrarla.
- **Arreglo:** añadir `AND tournament_id IN (SELECT id FROM tournaments WHERE created_by=?)` o `isArbiterOf()`.

### F-04 · CRÍTICO · `PATCH /tournaments/:id/players/:pid/penalty` — se restan puntos en torneos ajenos
- **Evidencia** `api/_src/routes/tournaments.js:164,170`
  ```js
  const tp = await db.prepare('SELECT id, current_points, penalty_points FROM tournament_players WHERE id = ? AND tournament_id = ?').get(req.params.pid, req.params.id);
  await db.prepare('UPDATE tournament_players SET current_points = current_points - ?, penalty_points = penalty_points + ? WHERE id = ?').run(penalty, penalty, req.params.pid);
  ```
- **Hecho:** se verifica que el jugador pertenece al torneo, **nunca que el torneo pertenezca al usuario**. Comparar con `POST /:id/players` (`tournaments.js:116`), que sí hace `AND created_by = ?`.
- **Impacto:** manipulación directa de la clasificación (restar puntos a un rival) desde cualquier cuenta.
- **Arreglo:** reutilizar la comprobación de `tournaments.js:116` antes del `UPDATE`.

### F-05 · CRÍTICO · `POST /auth/register` acepta `role` del cliente (escalada a `admin`)
- **Evidencia** `api/_src/routes/auth.js:15,28,32`
  ```js
  role: { type: 'string' },
  ).run(email, hash, name, role ?? 'organizer', federation ?? '');
  id, email, name, role: role ?? 'organizer',
  ```
- **Hecho:** la tabla admite `admin` (`api/_src/db/schema.js:15-16`, `CHECK(role IN ('admin','arbiter','organizer','federation'))`) y el rol se firma en el JWT sin volver a consultarse.
- **Matiz honesto:** hoy **ningún endpoint llama a `authorize()`** (solo se define en `middleware/auth.js:26`), por lo que el impacto inmediato es nulo y el riesgo es latente: en cuanto se proteja una ruta con `authorize('admin')`, la escalada es inmediata y persistente (el rol va en el token, no en la BD al verificar).
- **Arreglo:** eliminar `role` del registro (forzar `'organizer'`) y leer el rol de la BD en `authenticate`.

### F-06 · CRÍTICO · Webhook de Stripe roto por orden de middlewares: los pagos no activan membresías
- **Evidencia** `api/_src/index.js:75` y `api/_src/routes/stripe.js:58,61`
  ```js
  app.use(express.json({ limit: '5mb' }));
  router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const result = await handleWebhook(req.body, sig);
  ```
- **Hecho:** `express.json()` global consume el body antes de que `express.raw()` pueda leerlo; `req.body` llega como objeto y `stripe.webhooks.constructEvent()` (que exige `Buffer|string`) lanza → `400` en `stripe.js:64`.
- **Impacto:** `checkout.session.completed` nunca se procesa → el cliente paga y **no** se crea la membresía ni se marca `paid`/`approved` la inscripción (`services/stripe.js:150-190`). Es un fallo de integridad económica silencioso: el frontend ve 201 y el pago se completa en Stripe.
- **Arreglo:** montar `app.post('/stripe/webhook', express.raw(...))` **antes** de `express.json()` en `index.js`.

### F-07 · CRÍTICO · `POST /leagues/:id/calculate-standings` — sin propiedad y con API inexistente (`db.transaction`)
- **Evidencia** `api/_src/routes/leagues.js:106,121,142`
  ```js
  const league = await db.prepare('SELECT * FROM leagues WHERE id = ?').get(req.params.id);
  const standings = calculateTiebreak(players, null, tOrder);
  const tx = db.transaction(() => {
  ```
- **Hecho (dos fallos):** (1) no hay `created_by` → cualquiera recalcula cualquier liga; (2) `getDb()` solo expone `prepare/exec/close` (`api/_src/db/supabase.js:64-77`), **no** `transaction` → `TypeError` → la ruta devuelve 500 siempre. (3) `calculateTiebreak` tiene firma `(tiebreak, player, playersById, totalRounds, ...)` (`src/engine/tiebreaks.js:384`); aquí se le pasa un array de jugadores como `tiebreak`.
- **Impacto:** funcionalidad muerta (clasificación de liga nunca se guarda) + superficie de escritura sin autorización el día que se arregle.
- **Arreglo:** `await db.exec('BEGIN')/('COMMIT')` con try/catch + `AND created_by = ?` + iterar `calculateTiebreak(tb, player, playersById, totalRounds)` por jugador.

### F-08 · CRÍTICO · `PUT /matches/:mid/pairings/:pid` — reescribe el resultado de un match ajeno y recalcula el marcador de otro
- **Evidencia** `api/_src/routes/matches.js:131,141`
  ```js
  await db.prepare('UPDATE match_pairings SET result = ? WHERE id = ?').run(result, req.params.pid);
  await db.prepare('UPDATE team_matches SET home_score = ?, away_score = ? WHERE id = ?').run(homeScore, awayScore, req.params.mid);
  ```
- **Hecho:** ni propiedad del match ni coherencia `pid ∈ mid`. Se actualiza el pairing indicado y se recalcula el marcador del `mid` indicado, que puede ser de otro club.
- **Impacto:** corrupción cruzada de dos competiciones con una sola petición; no hay validación de `result` (acepta cualquier string).
- **Arreglo:** verificar `pid` pertenece a `mid`, `mid` pertenece a un torneo del usuario, y validar `result ∈ ['1','0','=']`.

---

## 3. ALTO

### F-09 · ALTO · `GET /tournaments/:tid/rounds` — lectura de emparejamientos de cualquier torneo
- **Evidencia** `api/_src/routes/rounds.js:22,24,26`
  ```js
  router.get('/tournaments/:tid/rounds', authenticate, async (req, res) => {
  let sql = 'SELECT * FROM rounds WHERE tournament_id = ?';
  ```
- **Impacto:** cualquier cuenta enumera rondas, mesas y nombres de jugadores de torneos privados o en preparación. `GET /tournaments/:tid/standings` (`rounds.js:303`) sí comprueba propiedad: misma familia, criterio distinto.
- **Arreglo:** `AND created_by = ?` en el `SELECT` del torneo, igual que `rounds.js:303`.

### F-10 · ALTO · `GET /tournaments/:id/players` — IDOR de inscritos
- **Evidencia** `api/_src/routes/tournaments.js:138-145`
  ```js
  router.get('/:id/players', authenticate, async (req, res) => {
    WHERE tp.tournament_id = ?
  ```
- **Impacto:** fuga de la lista de inscritos (nombre, ELO, FIDE ID, federación) de cualquier torneo, incluidos borradores.
- **Arreglo:** cargar el torneo con `AND created_by = ?` (o `isArbiterOf`) antes de listar.

### F-11 · ALTO · `PATCH /tournaments/:id/players/:pid/category` — escritura sin propiedad
- **Evidencia** `api/_src/routes/tournaments.js:153,156`
  ```js
  const tp = await db.prepare('SELECT id FROM tournament_players WHERE id = ? AND tournament_id = ?').get(req.params.pid, req.params.id);
  await db.prepare('UPDATE tournament_players SET category = ? WHERE id = ?').run(category || '', req.params.pid);
  ```
- **Impacto:** se cambia la categoría (premios, sub-18, sub-2000) de jugadores de torneos ajenos. Mismo patrón que F-04.
- **Arreglo:** añadir la comprobación de propiedad del torneo.

### F-12 · ALTO · `PUT /matches/:id` — se modifican marcadores y estado de matches ajenos
- **Evidencia** `api/_src/routes/matches.js:75,84`
  ```js
  const allowed = ['match_date','location','round','status','home_score','away_score'];
  await db.prepare(`UPDATE team_matches SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...params);
  ```
- **Impacto:** cualquier autenticado fija `home_score`/`away_score`/`status` de cualquier encuentro por equipos. `DELETE /matches/:id` (`matches.js:89-91`) sí filtra por `created_by`: incoherencia dentro del mismo recurso.
- **Arreglo:** `AND created_by = ?` en el `UPDATE` (o `SELECT` previo con esa condición).

### F-13 · ALTO · `POST /matches` — se crean encuentros entre equipos de terceros
- **Evidencia** `api/_src/routes/matches.js:63,68`
  ```js
  const home = await db.prepare('SELECT id, tournament_id FROM teams WHERE id = ?').get(home_team_id);
  'INSERT INTO team_matches (tournament_id, home_team_id, away_team_id, match_date, location, round, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ```
- **Impacto:** no se comprueba que los equipos ni el `tournament_id` pertenezcan al usuario; se inyectan partidos en calendarios ajenos.
- **Arreglo:** `JOIN tournaments t ON t.id = teams.tournament_id WHERE t.created_by = ?` para ambos equipos.

### F-14 · ALTO · `POST /matches/:id/pairings` — la comprobación de propiedad es una tautología
- **Evidencia** `api/_src/routes/matches.js:101`
  ```js
  WHERE tm.id = ? AND t.tournament_id = (SELECT tournament_id FROM teams WHERE id = tm.home_team_id)
  ```
- **Hecho:** `t` ya está unido por `t.id = tm.home_team_id`, así que la subconsulta devuelve el mismo valor que se compara: la condición es siempre cierta. No hay ninguna referencia a `req.user`.
- **Impacto:** se añaden tableros (con ELO resuelto por subconsulta) a matches de otros organizadores.
- **Arreglo:** `JOIN tournaments tn ON tn.id = t.tournament_id WHERE ... AND tn.created_by = ?`.

### F-15 · ALTO · `DELETE /leagues/:lid/tournaments/:tid` — se desasocian torneos de ligas ajenas
- **Evidencia** `api/_src/routes/leagues.js:97,99`
  ```js
  router.delete('/:lid/tournaments/:tid', async (req, res) => {
    await db.prepare('DELETE FROM league_tournaments WHERE league_id = ? AND tournament_id = ?').run(req.params.lid, req.params.tid);
  ```
- **Impacto:** cualquier autenticado rompe la composición de cualquier liga. Nota: la ruta hermana `POST /:id/tournaments` (`leagues.js:83`) sí comprueba `created_by`.
- **Arreglo:** `AND league_id IN (SELECT id FROM leagues WHERE created_by = ?)`.

### F-16 · ALTO · `GET /leagues` y `GET /leagues/:id` — todas las ligas de todos los usuarios
- **Evidencia** `api/_src/routes/leagues.js:30,38`
  ```js
  FROM leagues l ORDER BY l.created_at DESC
  const league = await db.prepare('SELECT * FROM leagues WHERE id = ?').get(req.params.id);
  ```
- **Impacto:** se listan ligas ajenas y se leen sus participantes (nombre, ELO, FIDE ID) sin filtro de propietario; `GET /leagues` no tiene ni paginación.
- **Arreglo:** `WHERE l.created_by = ?` en ambas.

### F-17 · ALTO · `/public/organizers` publica el email de todos los organizadores
- **Evidencia** `api/_src/routes/public.js:309,323`
  ```js
  SELECT u.id, u.name, u.email, u.federation,
  const org = await db.prepare("SELECT id, name, email, federation FROM users WHERE id = ?").get(req.params.id);
  ```
- **Impacto:** scraping de correos profesionales sin autenticación; encadenable con `GET /public/tournaments/:id`, que devuelve `created_by` vía `SELECT *` (`public.js:42`), para atribuir cada email a un torneo.
- **Arreglo:** eliminar `email` de ambas respuestas (o exponer solo si el organizador lo activa).

### F-18 · ALTO · El filtro público `status != 'pending'` no excluye nada: los borradores son públicos
- **Evidencia** `api/_src/db/schema.js:43` + `api/_src/routes/public.js:17,44`
  ```sql
  status          TEXT    DEFAULT 'draft',
  let sql = "SELECT ... FROM tournaments WHERE status != 'pending'";
  if (t.status === 'pending') return res.status(404).json({ error: 'Torneo no encontrado' });
  ```
- **Hecho:** `POST /tournaments` no envía `status` (`tournaments.js:46-49`), luego todo torneo nace `'draft'`; **ningún endpoint escribe `'pending'`** (grep: solo aparece como filtro y en `rounds.js:107`, que promueve a `'active'` **solo si** ya era `'pending'`, condición que nunca se cumple).
- **Impacto:** torneos en preparación, con nombre, ciudad, fechas, aforo y campos personalizados, aparecen en `GET /public/tournaments`, `GET /public/tournaments/:id`, `/players`, `/rounds`, `/standings` sin autenticación. Es una fuga de negocio (clientes, sedes) y explica por qué `rounds.js:107` deja el torneo en `'draft'` tras generar la primera ronda.
- **Arreglo:** unificar el estado inicial (`'pending'` al crear) y filtrar explícitamente por lista blanca `IN ('active','finished')`.

### F-19 · ALTO · `GET /external/tournaments?status=pending` expone borradores sin autenticación
- **Evidencia** `api/_src/routes/external.js:179-180`
  ```js
  else if (status === 'pending') { sql += " AND t.status = 'pending'"; }
  else if (status === 'upcoming') { sql += " AND t.status = 'pending' AND t.start_date > NOW()"; }
  ```
- **Impacto:** segunda puerta al mismo dato que F-18 protege (o cree proteger), con `description`, `city` y `created_at`. Además el endpoint es público y dispara scrapers de 5 fuentes en cada llamada (`external.js:155`).
- **Arreglo:** mismo filtro por lista blanca que `/public`; no permitir `status=pending` en la rama interna.

### F-20 · ALTO · `apiV1`: una API key cualquiera lee todos los torneos, incluidos borradores
- **Evidencia** `api/_src/routes/apiV1.js:12,19,37`
  ```js
  router.use(apiAuthenticate);
  let sql = 'SELECT id, name, ... FROM tournaments WHERE 1=1';
  const t = await db.prepare('SELECT id, name, ... FROM tournaments WHERE id = ?').get(req.params.id);
  ```
- **Hecho:** `apiAuthenticate` identifica al usuario (`req.apiUser.userId`) pero **ninguna ruta lo usa**; no hay scopes ni filtro por propietario, y no se excluye `draft`.
- **Impacto:** cualquier usuario crea una key en `POST /api-keys` (`apiKeys.js:17`) y obtiene un feed completo de torneos de la competencia, con emparejamientos y clasificaciones.
- **Arreglo:** filtrar por `created_by = req.apiUser.userId` o por estado público, y añadir scopes a la clave.

### F-21 · ALTO · SSRF en webhooks: URL arbitraria desde el servidor
- **Evidencia** `api/_src/routes/webhooks.js:31` + `api/_src/services/webhooks.js:42`
  ```js
  try { new URL(url); } catch { return res.status(400).json({ error: 'URL inválida' }); }
  const response = await fetch(hook.url, { method: 'POST', headers, body, signal: controller.signal });
  ```
- **Hecho:** solo se valida la sintaxis. No se bloquean IPs privadas, `localhost`, `169.254.169.254` ni se restringe el esquema.
- **Impacto:** un usuario autenticado hace que el servidor (con salida a la red interna de Vercel/Supabase) emita POST a cualquier destino interno; se dispara con `dispatchWebhooks()` en rutas normales (`tournaments.js:58`, `rounds.js:124`).
- **Arreglo:** resolver DNS y rechazar rangos privados/loopback/link-local, permitir solo `https`, y validar en cada dispatch (no solo al crear).

### F-22 · ALTO · `GET /incidents?tournament_id=` — notas internas de arbitraje de cualquier torneo
- **Evidencia** `api/_src/routes/incidents.js:8,12`
  ```js
  const rows = await db.prepare('SELECT * FROM incidents WHERE tournament_id = ? ORDER BY created_at DESC').all(tid);
  ```
- **Impacto:** `description` de incidencias (conducta de menores, reclamaciones, sanciones) accesible a cualquier cuenta. `SELECT *` incluye `arbiter_id`.
- **Arreglo:** `AND tournament_id IN (SELECT id FROM tournaments WHERE created_by=?)` o `isArbiterOf()`.

### F-23 · ALTO · `import.js`: se responde `{}` antes de importar (y la importación puede perderse)
- **Evidencia** `api/_src/routes/import.js:39,56`
  ```js
  const results = importPlayers(db, req.params.tid, req.user.id, rows, column_map);
  const results = importPlayersFromTRF(db, req.params.tid, trf);
  ```
- **Hecho:** ambas funciones son `async` (`services/importer.js:126`, `:230`) y **no se esperan**. `res.json(Promise)` serializa a `{}`; el trabajo sigue en segundo plano y, en Vercel, la instancia se congela al responder.
- **Impacto:** el organizador ve 200 sin resumen y el torneo queda a medio importar, sin error visible. La ruta hermana `swiss-txt` sí usa `await` (`import.js:73`): mismo recurso, tres comportamientos.
- **Arreglo:** `await` en ambas líneas y `try/catch` para devolver 500 real.

### F-24 · ALTO · `POST /ai/fide` — IA sin autenticación ni límite
- **Evidencia** `api/_src/routes/ai.js:33`
  ```js
  router.post('/fide', async (req, res) => {
  ```
- **Hecho:** sin `authenticate`, sin `limiter` (el único rate limit se monta en `/auth`, `index.js:76`), sin tope de longitud de `question` ni de `history`.
- **Impacto:** cualquiera en Internet consume saldo del proveedor de IA; `history` permite inflar el prompt hasta el límite de 5 MB de `express.json` por petición.
- **Arreglo:** `authenticate` + limiter por usuario + `max` de caracteres en pregunta e historial.

### F-25 · ALTO · `POST /public/tournaments/:id/register` — registro público sin límite y con envío de email a dirección arbitraria
- **Evidencia** `api/_src/routes/public.js:590,677,700`
  ```js
  router.post('/tournaments/:id/register', async (req, res) => {
  await db.prepare('UPDATE tournaments SET registered_count = registered_count + 1 WHERE id = ?').run(req.params.id);
  notifyRegistrationReceived(req.params.id, email, name);
  ```
- **Hecho:** sin autenticación, sin rate limit, `email` y `name` vienen del body y `notifyRegistrationReceived` envía correo real al destinatario indicado (`services/notifications.js:112-126`). Si hay tarifa, crea una sesión de Stripe por petición (`public.js:690`).
- **Impacto:** email bombing usando el dominio de la plataforma, inflado de `registered_count`, y consumo de Stripe. `registered_count` además solo suma: nunca se decrementa al rechazar.
- **Arreglo:** limiter por IP + verificación de email (token) antes de notificar + `registered_count` derivado por `COUNT(*)`.

### F-26 · ALTO · `POST /scan/upload` — el archivo de 50 MB se escribe en disco antes de comprobar la cuota
- **Evidencia** `api/_src/routes/scan.js:26,35,49`
  ```js
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  if (!membership) {
  ```
- **Hecho:** `multer` persiste el archivo (`diskStorage`, `scan.js:14-23`) antes de que el handler evalúe membresía y cuota. Al devolver 403/429 **no se borra** el archivo.
- **Impacto:** un usuario sin plan llena el disco del contenedor a 50 MB por petición; sin rate limit global, el coste es trivial.
- **Arreglo:** mover la comprobación de membresía/cuota a un middleware **antes** de `upload.single`, o `fs.unlink` en todas las salidas de error.

### F-27 · ALTO · `INSERT OR IGNORE` degradado a `INSERT`: jugadores duplicados en el torneo
- **Evidencia** `api/_src/routes/scan.js:184` + `api/_src/db/supabase.js:33`
  ```js
  INSERT OR IGNORE INTO tournament_players (tournament_id, player_id, seed_rank)
  .replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO')
  ```
- **Impacto:** al reimportar un escaneo, `tournament_players` acumula filas duplicadas del mismo jugador → emparejamientos y clasificación incorrectos; después `SELECT id ... WHERE tournament_id=? AND player_id=?` devuelve una fila arbitraria (`scan.js:196`).
- **Arreglo:** `INSERT ... ON CONFLICT (tournament_id, player_id) DO NOTHING` explícito (el shim ya soporta `ON CONFLICT`).

### F-28 · ALTO · `GET /arbiters/search-users` — enumeración de emails de toda la base
- **Evidencia** `api/_src/routes/arbiters.js:21`
  ```js
  const users = await db.prepare("SELECT id, name, email, role FROM users WHERE email LIKE ? OR name LIKE ? LIMIT 20").all(`%${q}%`, `%${q}%`);
  ```
- **Impacto:** cualquier cuenta autenticada busca por subcadena (`q=a`) y obtiene emails y roles; es un directorio de usuarios exportable por fuerza bruta de letras.
- **Arreglo:** exigir coincidencia exacta de email o mínimo de 3 caracteres, y devolver el email ofuscado.

### F-29 · ALTO · Boletín: sin propiedad y con XSS almacenado en el HTML
- **Evidencia** `api/_src/routes/rounds.js:351,440`
  ```js
  const tournament = await db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.tid);
  <h1>${tournament.name}</h1>
  ```
- **Hecho:** sin `created_by`, se sirve `text/html` con el nombre del torneo sin escapar (también `city`, `chief_arbiter`, `federation`). El nombre lo controla cualquier organizador.
- **Impacto:** lectura del boletín de torneos ajenos + XSS almacenado en el origen de la API (afecta a quien abra el boletín, incluido un administrador).
- **Arreglo:** comprobar propiedad y escapar (`escapeHtml`) todos los campos interpolados.

---

## 4. MEDIO

### F-30 · MEDIO · `POST /tournaments/:tid/rounds/generate` sin transacción
- **Evidencia** `api/_src/routes/rounds.js:92,101,107`
  ```js
  const round = await db.prepare('INSERT INTO rounds (...) VALUES (?, ?, ?, ?)').run(req.params.tid, nextRound, 'generated', groupId);
  insertPairing.run(round.lastInsertRowid, ...)
  await db.prepare("UPDATE tournaments SET status = 'active' ... WHERE id = ? AND status = 'pending'").run(req.params.tid);
  ```
- **Impacto:** si falla un `insertPairing` (o el proceso se corta), queda una ronda sin emparejamientos y el torneo sin cambiar de estado; no hay reintento ni compensación. Además `lastInsertRowid` puede ser `null` si el `INSERT` no devuelve `id` y entonces los pairings se insertan con `round_id = null` (huérfanos).
- **Arreglo:** `BEGIN/COMMIT` alrededor de ronda + pairings + estado, y comprobar `round.lastInsertRowid` antes de usarlo.

### F-31 · MEDIO · Aprobación de inscripción: tres escrituras sin transacción y `player.id` sin comprobar
- **Evidencia** `api/_src/routes/tournaments.js:213,225,235`
  ```js
  await db.prepare("UPDATE registration_requests SET status = ?, updated_at = datetime('now') WHERE id = ?").run(action, req.params.reqId);
  player = await db.prepare('SELECT * FROM players WHERE id = ?').get(result.lastInsertRowid);
  await db.prepare('INSERT INTO tournament_players (tournament_id, player_id, seed_rank) VALUES (?, ?, ?)').run(req.params.id, player.id, nextSeed);
  ```
- **Impacto:** el estado pasa a `approved` antes de crear el jugador; si el `INSERT` falla, la solicitud queda aprobada sin inscrito y no se puede reintentar (el guard de `tournaments.js:208` exige `pending`). Si `player` es `null`, `player.id` lanza `TypeError` (sin try/catch → 500 tras el cambio de estado).
- **Arreglo:** transacción única y `if (!player) throw`.

### F-32 · MEDIO · `DELETE /groups/:id` — tres borrados sin transacción
- **Evidencia** `api/_src/routes/groups.js:89,90,91`
  ```js
  await db.prepare('UPDATE tournament_players SET group_id = NULL WHERE group_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM rounds WHERE group_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM tournament_groups WHERE id = ?').run(req.params.id);
  ```
- **Impacto:** si falla el borrado del grupo, los jugadores ya quedaron desasignados y las rondas del grupo borradas (con sus pairings por cascada): pérdida de resultados irreversible.
- **Arreglo:** envolver en `BEGIN/COMMIT` con rollback.

### F-33 · MEDIO · `POST /external/import-tournament` — torneo + N jugadores sin transacción ni cupo
- **Evidencia** `api/_src/routes/external.js:283,290`
  ```js
  for (const p of tournament.players) {
    let player = await db.prepare('SELECT id FROM players WHERE fide_id = ?').get(p.fide_id);
  ```
- **Impacto:** un fallo a mitad deja un torneo con parte de los jugadores; no hay tope de longitud del array (viene del scraper, pero el `search` es del usuario) ni control de duplicados por nombre.
- **Arreglo:** transacción + límite de jugadores + `ON CONFLICT` en `tournament_players`.

### F-34 · MEDIO · `POST /fide/bulk-import` — sin tope de array, una llamada externa por ID
- **Evidencia** `api/_src/routes/fide.js:86,94`
  ```js
  for (const fid of fide_ids) {
    const data = await fideService.getRating(fid);
  ```
- **Impacto:** con 5 MB de body caben decenas de miles de IDs → decenas de miles de peticiones salientes en una sola invocación (timeout de función y bloqueo del proveedor). Sin límite por usuario.
- **Arreglo:** `fide_ids.slice(0, 50)` + limiter + proceso asíncrono.

### F-35 · MEDIO · `POST /fide/bulk-import-fed` — descarga completa y bucle de inserts sin transacción
- **Evidencia** `api/_src/routes/fide.js:120,127`
  ```js
  const csv = await fideService.downloadRatingList(federation, month || '');
  for (const line of lines) {
  ```
- **Impacto:** operación de minutos dentro de una función serverless (504 a mitad), con miles de inserts sueltos y sin `await` de transacción; deja la tabla a medias.
- **Arreglo:** mover a job por lotes con cursor y transacción por lote.

### F-36 · MEDIO · `GET /fide/report/:tournamentId` — sin propiedad y con función no importada
- **Evidencia** `api/_src/routes/fide.js:198,203`
  ```js
  const tournament = await db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.tournamentId);
  const standings = calculateTiebreak(players, null, tOrder);
  ```
- **Hecho:** `calculateTiebreak` **no está importado** en `fide.js` (grep: solo aparece en la línea 203) → `ReferenceError` en cada llamada; y no hay `created_by`.
- **Impacto:** informe FIDE inutilizable + lectura de datos de cualquier torneo cuando se arregle.
- **Arreglo:** importar la función con la firma correcta y añadir `AND created_by = ?`.

### F-37 · MEDIO · `GET /stats/:tid/overview` — O(jugadores × rondas) consultas por petición
- **Evidencia** `api/_src/routes/stats.js:309,330,332`
  ```js
  for (let rn = 1; rn <= totalRounds; rn++) {
  const colorPerfData = await Promise.all(players.map(async (player) => {
  ```
- **Impacto:** para 200 jugadores y 9 rondas son ~3.600 consultas por request; con el shim sobre Postgres y `max: 3` conexiones (`supabase.js:20`), una petición satura el pool. Sin caché ni límite.
- **Arreglo:** cargar todas las pairings una vez y agregar en memoria; cachear por `tournament_id`.

### F-38 · MEDIO · Chequeo de duplicados con `OR` sin paréntesis (falso 409 + oráculo entre torneos)
- **Evidencia** `api/_src/routes/public.js:630,632`
  ```js
  WHERE tournament_id = ? AND status IN ('pending','pending_payment','approved')
  AND (? != '' AND email = ?) OR (? != '' AND fide_id = ?)
  ```
- **Hecho:** `AND` liga antes que `OR`, así que la segunda rama **ignora** `tournament_id` y el estado.
- **Impacto:** (1) un jugador con `fide_id` ya existente en *cualquier* torneo recibe 409 al inscribirse en otro; (2) permite comprobar si un FIDE ID está en la plataforma observando el código de respuesta.
- **Arreglo:** `AND ((? <> '' AND email = ?) OR (? <> '' AND fide_id = ?))`.

### F-39 · MEDIO · SSE público sin límite de conexiones ni validación de torneo
- **Evidencia** `api/_src/routes/public.js:222,235`
  ```js
  router.get('/tournaments/:id/sse', async (req, res) => {
  subscribe(req.params.id, res);
  ```
- **Impacto:** `setInterval` por conexión + suscripción en memoria (`services/pubsub.js`), sin comprobar que el torneo exista ni límite por IP: agotamiento de conexiones/ memoria de la función con peticiones triviales.
- **Arreglo:** validar el torneo, limitar suscripciones por IP y cerrar por inactividad.

### F-40 · MEDIO · `GET /tournaments/:tid/team-standings` — `await` olvidado, la ruta siempre falla
- **Evidencia** `api/_src/routes/teams.js:104,113`
  ```js
  const members = db.prepare(`...`).all(team.id);
  const totalPoints = members.reduce((sum, m) => sum + (m.current_points || 0), 0);
  ```
- **Hecho:** `all()` devuelve una `Promise`; `members.reduce` no existe → `TypeError` dentro de `teams.map` → sin `try/catch` y con Express 4 (`api/package.json`, `"express": "^4.21.0"`) el rechazo no se captura: la petición queda colgada hasta el timeout.
- **Arreglo:** `await db.prepare(...).all(...)`.

### F-41 · MEDIO · `POST /leagues/:id/tournaments` — se adjunta un torneo ajeno a mi liga
- **Evidencia** `api/_src/routes/leagues.js:85`
  ```js
  const t = await db.prepare('SELECT id FROM tournaments WHERE id = ?').get(tournament_id);
  ```
- **Impacto:** se comprueba que el torneo existe, no que sea del usuario; cualquiera mete torneos de terceros en su liga y altera la clasificación agregada.
- **Arreglo:** `AND created_by = ?` en esa consulta.

### F-42 · MEDIO · `import.js`: `err.message` con 400 y sin tope de filas
- **Evidencia** `api/_src/routes/import.js:42`
  ```js
  res.status(400).json({ error: err.message });
  ```
- **Impacto:** errores de Postgres/parseo expuestos al cliente (nombres de columnas, constraints) y código incorrecto (400 para fallos internos). Sin límite de filas, un CSV de 5 MB bloquea el event loop en `parseCSV` y en `importPlayers`.
- **Arreglo:** 500 genérico + log interno; tope de filas (p. ej. 2.000) antes de importar.

### F-43 · MEDIO · `POST /membership/subscribe` (plan free) — cancelar + insertar sin transacción
- **Evidencia** `api/_src/routes/membership.js:93,94`
  ```js
  await db.prepare("UPDATE user_memberships SET status = 'cancelled' WHERE user_id = ? AND status = 'active'").run(req.user.id);
  await db.prepare('INSERT INTO user_memberships (user_id, plan_id, status) VALUES (?, ?, ?)').run(req.user.id, plan.id, 'active');
  ```
- **Impacto:** si el segundo `INSERT` falla, el usuario queda **sin** ninguna membresía activa (pierde cuota de escaneos y límites) y la API responde 500.
- **Arreglo:** transacción o `UPDATE ... ; INSERT` en una sola sentencia con `CTE`.

### F-44 · MEDIO · `POST /scan/:jobId/import` — `IN (...)` de longitud arbitraria y `game_ids` sin validar
- **Evidencia** `api/_src/routes/scan.js:173,174`
  ```js
  const placeholders = game_ids.map(() => '?').join(',');
  const games = await db.prepare(`SELECT * FROM scan_games WHERE job_id = ? AND id IN (${placeholders})`).all(jobId, ...game_ids);
  ```
- **Hecho:** no hay `Array.isArray` ni tope. `game_ids = ""` → `TypeError`; `game_ids` de 50.000 elementos → sentencia gigante (límite de parámetros de Postgres, 65.535). La interpolación es solo de `?`, **no** hay inyección.
- **Impacto:** 500 opacos y consumo de recursos; el import además recorre N partidas con varias escrituras cada una, sin transacción (F-27).
- **Arreglo:** validar array (1..500) y usar `= ANY($1::int[])`.

### F-45 · MEDIO · `POST /notifications/test-telegram` — el servidor envía mensajes con el token que le des
- **Evidencia** `api/_src/routes/notifications.js:72,76`
  ```js
  router.post('/test-telegram', authenticate, async (req, res) => {
  sendTelegramMessage(token, chatId, '✅ <b>Chess Organizers Pro</b>...')
  ```
- **Impacto:** proxy de envío de Telegram sin límite (spam desde la IP del servicio, posible bloqueo del bot) y `err.message` devuelto al cliente.
- **Arreglo:** limiter por usuario + usar solo el token guardado en `user_notification_settings`, nunca uno del body.

### F-46 · MEDIO · `POST /external/clear-cache` — se anuncia como admin pero no lo es
- **Evidencia** `api/_src/routes/external.js:307,308`
  ```js
  // POST /external/clear-cache — limpiar caché de scrapers (admin)
  router.post('/clear-cache', authenticate, async (req, res) => {
  ```
- **Impacto:** cualquier autenticado vacía la caché global de scrapers → cada visitante posterior dispara scraping contra Chess-Results/Info64/FIDE (coste y riesgo de bloqueo).
- **Arreglo:** `authorize('admin')` (y arreglar antes F-05, que permite autoasignarse admin).

### F-47 · MEDIO · `GET /notifications` — `LIMIT` sin validar (NaN o negativo)
- **Evidencia** `api/_src/routes/notifications.js:16,18`
  ```js
  sql += ` ORDER BY n.created_at DESC LIMIT ?`;
  params.push(parseInt(limit, 10));
  ```
- **Impacto:** `?limit=abc` → `NaN` → error de Postgres → 500; `?limit=1000000` → volcado completo de la bandeja (sin tope).
- **Arreglo:** `Math.min(Math.max(parseInt(limit)||20,1),100)`.

### F-48 · MEDIO · `GET /players/my-tournaments` es inalcanzable (sombreado por `/:id`)
- **Evidencia** `api/_src/routes/players.js:26,81`
  ```js
  router.get('/:id', authenticate, async (req, res) => {
  router.get('/my-tournaments', authenticate, async (req, res) => {
  ```
- **Impacto:** `GET /players/my-tournaments` entra por `/:id` con `id='my-tournaments'` → `SELECT * FROM players WHERE id = 'my-tournaments'` → error/404. El historial del jugador nunca responde; el frontend recibe "Jugador no encontrado".
- **Arreglo:** declarar `/my-tournaments` antes de `/:id`.

---

## 5. BAJO

### F-49 · BAJO · API key aceptada por query string (`?api_key=`)
- **Evidencia** `api/_src/middleware/apiAuth.js:17-19`
  ```js
  if (!rawKey && req.query.api_key) {
    rawKey = req.query.api_key.trim();
  ```
- **Impacto:** las claves quedan en logs de acceso, `Referer` e historiales (morgan registra la URL, `index.js:74`).
- **Arreglo:** aceptar solo cabecera `Authorization`.

### F-50 · BAJO · `last_used_at` se escribe en cada petición autenticada por API key
- **Evidencia** `api/_src/middleware/apiAuth.js:30`
  ```js
  await db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(keyRecord.id);
  ```
- **Impacto:** convierte cada lectura en una escritura (doble latencia y presión sobre el pool de 3 conexiones); un cliente con muchas llamadas genera contención.
- **Arreglo:** actualizar como máximo una vez por minuto (o `fire-and-forget` con umbral).

### F-51 · BAJO · `exists()` en `validate.js` no espera la consulta (siempre "existe")
- **Evidencia** `api/_src/middleware/validate.js:80-81`
  ```js
  const row = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id);
  if (!row) return res.status(404).json({ error: `${table.slice(0,-1)} no encontrado` });
  ```
- **Hecho:** sin `await`, `row` es una `Promise` (siempre truthy). Hoy **no se usa** en ninguna ruta (grep: solo la definición), por eso es BAJO; es una trampa lista para el próximo que la use. El nombre de tabla se interpola en el SQL (hoy constante de código, no de usuario).
- **Arreglo:** `await` + allowlist de tablas.

### F-52 · BAJO · `apiV1` reconstruye el `COUNT` con un regex sobre el SQL
- **Evidencia** `api/_src/routes/apiV1.js:25,146`
  ```js
  const total = (await db.prepare(sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as count FROM')).get(...params)).count;
  ```
- **Impacto:** cualquier columna o comentario que contenga `FROM` rompe el conteo; el total puede no corresponder al listado. No es inyectable (el SQL es constante), pero es frágil.
- **Arreglo:** construir el `COUNT` explícitamente.

### F-53 · BAJO · `/health/warm` devuelve el error de base de datos al cliente
- **Evidencia** `api/_src/index.js:52`
  ```js
  res.end(JSON.stringify({ status: 'warm', db: 'error', error: e.message }));
  ```
- **Impacto:** host, base o usuario de Postgres en un endpoint público (ayuda al reconocimiento).
- **Arreglo:** `error: 'db_unavailable'` y log interno.

### F-54 · BAJO · `POST /newsletter/subscribe` filtra mensajes de la BD y no tiene límite
- **Evidencia** `api/_src/routes/newsletter.js:18,21`
  ```js
  } catch (e) {
    res.status(500).json({ error: e.message });
  ```
- **Impacto:** se expone el texto de la constraint/unique y se permite enumerar suscripciones; sin rate limit se puede inflar la tabla.
- **Arreglo:** 500 genérico + limiter por IP.

### F-55 · BAJO · `Content-Disposition` construido con el nombre del torneo sin sanear
- **Evidencia** `api/_src/routes/rounds.js:521,558`
  ```js
  res.set('Content-Disposition', `inline; filename="${tournament.name.replace(/\s+/g,'_')}_boletin.html"`);
  ```
- **Impacto:** solo se sustituyen espacios; comillas, `\r\n` o `;` en el nombre pueden romper la cabecera (Node lanza `ERR_INVALID_CHAR` → 500) o inyectar parámetros.
- **Arreglo:** sanear a `[A-Za-z0-9._-]` y truncar.

### F-56 · BAJO · `GET /membership/my` convierte cualquier fallo en 200 con `null`
- **Evidencia** `api/_src/routes/membership.js:32-34`
  ```js
  } catch (err) {
    res.json({ membership: null, active_tournaments: 0 });
  ```
- **Impacto:** un error de BD se presenta como "sin membresía": el cliente ofrece comprar un plan a alguien que ya lo tiene y el fallo no se monitoriza.
- **Arreglo:** distinguir "no hay membresía" (200 con null) de error (500).

### F-57 · BAJO · `GET /stats/:tid/head-to-head` compara número con string y siempre devuelve `null`
- **Evidencia** `api/_src/routes/stats.js:250`
  ```js
  const p1Data = players.find((p) => p.id === p1);
  ```
- **Hecho:** `p1` viene de `req.query` (string) y `p.id` es numérico → `false` siempre, aunque las comparaciones de más arriba usan `String(...)`.
- **Impacto:** `player1`/`player2` siempre `null` en la respuesta; el frontend no puede mostrar el duelo.
- **Arreglo:** `String(p.id) === String(p1)`.

---

## 6. Punto (c): inyección SQL — resultado de la búsqueda

**No se ha encontrado ninguna inyección SQL explotable en los archivos auditados.** Todos los valores de usuario viajan como parámetros (`?` → `$n` en `supabase.js:31`) y las únicas interpolaciones son nombres de columna de listas blancas:

- `api/_src/routes/tournaments.js:78-81`, `players.js:68-71`, `groups.js:61-64`, `leagues.js:60-62`, `matches.js:76-78`: `updates.push(\`${field} = ?\`)` con `field` de un array `allowed` constante.
- `api/_src/routes/tournaments.js:188`: `IN (${statuses.map(() => '?').join(',')})` — solo `?`.
- `api/_src/routes/external.js:186-191`: `sort` y `order` pasan por `sortMap`/ternario antes de interpolar.
- `api/_src/routes/scan.js:173-174`: placeholders generados por longitud de array (riesgo de DoS, F-44, no de inyección).

Dos puntos **frágiles pero no explotables hoy**: `middleware/validate.js:80` (tabla interpolada, función sin uso) y `apiV1.js:25` (regex sobre SQL constante). Se registran como F-51 y F-52.

---

## 7. Punto (b): matriz de comprobación de propiedad por endpoint

| Recurso / endpoint | `authenticate` | Comprobación de propiedad | Veredicto |
|---|---|---|---|
| `GET /tournaments`, `/:id`, `PATCH`, `DELETE` | Sí | `created_by = ?` | Correcto |
| `POST /tournaments/:id/players` | Sí | `created_by = ?` | Correcto |
| `GET /tournaments/:id/players` | Sí | Ninguna | **F-10** |
| `PATCH .../players/:pid/category` | Sí | Solo `tournament_id` | **F-11** |
| `PATCH .../players/:pid/penalty` | Sí | Solo `tournament_id` | **F-04** |
| `GET /tournaments/:tid/rounds` | Sí | Ninguna | **F-09** |
| `PATCH /rounds/:rid/result` | Sí | Ninguna | **F-01** |
| `PATCH /rounds/:rid/schedule` | Sí | `round.created_by !== req.user.id` (en JS) | Correcto, pero **estilo distinto** |
| `POST /rounds/:rid/close` | Sí | Ídem, en JS | Correcto, estilo distinto |
| `POST /rounds/:rid/publish` | Sí | `JOIN ... t.created_by = ?` (en SQL) | Correcto, estilo distinto |
| `DELETE /pairings/:id`, `PATCH /pairings/:id/swap` | Sí | `JOIN ... t.created_by = ?` | Correcto |
| `GET /tournaments/:tid/bulletin` | Sí | Ninguna | **F-29** |
| `GET /tournaments/:tid/trf` | Sí | `created_by = ?` | Correcto |
| `PATCH /arbiters/rounds/:rid/result` | Sí | `isArbiterOf()` | Correcto — **misma operación que F-01, protegida** |
| `POST /arbiters/players/:tpId/check-in` | Sí | `isArbiterOf()` | Correcto |
| `PATCH /incidents/:id`, `DELETE /incidents/:id` | Sí | Ninguna | **F-02/F-03** |
| `PUT /matches/:id`, `PUT /matches/:mid/pairings/:pid` | Sí | Ninguna | **F-08/F-12** |
| `DELETE /matches/:id`, `DELETE /matches/:mid/pairings/:pid` | Sí | `created_by = ?` (solo el primero) | Incoherente |
| `DELETE /leagues/:lid/tournaments/:tid` | Sí | Ninguna | **F-15** |
| `GET /leagues`, `GET /leagues/:id` | Sí | Ninguna | **F-16** |
| `POST /leagues/:id/calculate-standings` | Sí | Ninguna | **F-07** |
| `GET /scan/:jobId/*` | Sí | `user_id = ?` | Correcto |
| `GET /stats/*` | Sí | `created_by = ?` en todas | Correcto |

**Conclusión del punto (b):** el mismo recurso se protege de tres formas incompatibles. `PATCH /rounds/:rid/result` (nada) y `PATCH /arbiters/rounds/:rid/result` (`isArbiterOf`) escriben exactamente la misma tabla; `DELETE /matches/:id` filtra por `created_by` y `PUT /matches/:id` no. Un árbitro invitado (`tournament_arbiters`) puede operar en `/arbiters/*` pero **no** en `/tournaments/:id/*`, porque esas rutas solo aceptan `created_by`.

---

## 8. Punto (d): operaciones multi-tabla sin transacción

`getDb()` no expone `transaction` (`supabase.js:64-77`) y solo `leagues.js:142` lo intenta (y falla, F-07). Sin transacciones reales en:

1. `rounds.js:92-107` — ronda + N pairings + estado del torneo (F-30).
2. `tournaments.js:213-235` — estado de solicitud + jugador + inscripción (F-31).
3. `groups.js:89-91` — desasignar + borrar rondas + borrar grupo (F-32).
4. `external.js:267-296` — torneo + jugadores + inscripciones (F-33).
5. `fide.js:127-140`, `fide.js:94-108` — lotes de importación (F-34/F-35).
6. `scan.js:176-207` — jugadores + inscripciones + ronda + pairing + marca de importado (F-27/F-44).
7. `public.js:673-677` — solicitud + `registered_count` (F-25).
8. `membership.js:93-94` — cancelar + crear membresía (F-43).
9. `stripe.js` servicio: cancelar membresías + insertar nueva (`services/stripe.js:196-206`) — dos escrituras sin transacción dentro del webhook.

---

## 9. Punto (e): `err.message` al cliente y códigos incorrectos

Rutas que devuelven el mensaje crudo del motor (nombres de columnas, constraints, texto de Postgres):

- `auth.js:40,68,80,96` · `tournaments.js:63` · `players.js:150` · `rounds.js:127,296` · `public.js:217,511,549` · `external.js:24,64,243,303,314` · `import.js:21,42,59,76,94` · `scan.js:131,148,168,215,232` · `stats.js:115,190,208,265,290,375,398` · `incidents.js:15,29,48,56` · `newsletter.js:18` · `notifications.js:77,86` · `stripe.js:41,54,64`.
- El manejador global sí es correcto (`index.js:100-106` enmascara en producción), pero estas rutas lo **saltan** devolviendo el texto antes de llegar a él.

Códigos de estado incorrectos: `import.js:42` (400 para errores internos), `external.js:24` (400 para fallo de red/upstream), `stripe.js:41` (400 para error de servidor/Stripe), `fide.js:20` (502 para error propio), `membership.js:32` (200 con `null` en error), `scan.js:34` (403 sin membresía es correcto; `409` de duplicado en `arbiters.js:151` se devuelve sin comprobar la causa real).

---

## 10. Punto (g): endpoints caros sin límite

El único rate limit se monta en `/auth` (`index.js:76`); **todo lo demás es ilimitado**. Los más costosos:

| Endpoint | Coste por petición | Límite actual |
|---|---|---|
| `POST /ai/fide` (`ai.js:33`) | llamada a LLM | Ninguno, ni auth |
| `POST /public/tournaments/:id/register` (`public.js:590`) | email + posible sesión Stripe + 2 escrituras | Ninguno |
| `GET /external/tournaments` (`external.js:119`) | 5 scrapers externos | Caché del servicio (no verificada en esta auditoría) |
| `POST /external/lookup` (`external.js:13`) | 1-2 fetch a chess.com/lichess | Ninguno |
| `POST /fide/bulk-import` (`fide.js:86`) | N fetch a FIDE | Ninguno |
| `POST /fide/bulk-import-fed` (`fide.js:120`) | descarga CSV completa + N inserts | Ninguno |
| `POST /scan/upload` (`scan.js:35`) | 50 MB a disco | Solo cuota de plan (después del upload) |
| `POST /import/players/:tid` (`import.js:26`) | parseo CSV 5 MB síncrono | Ninguno |
| `GET /stats/:tid/overview` (`stats.js:301`) | ~jugadores×rondas consultas | Ninguno |
| `GET /public/tournaments/:id/standings` (`public.js:98`) | recalcula tiebreaks en cada request | Ninguno (sin caché) |
| `GET /public/tournaments/:id/sse` (`public.js:222`) | conexión persistente + timer | Ninguno |

---

## 11. No verificado / pendiente

- **`middleware/apiAuth.js:18`** aparece en la lectura como `error: 'API key requerida (Bearer token o ?api_key=[redacted] });`: la cadena parece sin cerrar. Lo más probable es una **redacción automática** de la herramienta de lectura sobre algo con forma de clave; si no lo es, sería un error de sintaxis que impediría arrancar el router `apiV1`. **No verificado** (no se puede ejecutar el parser). Comprobar el byte exacto de esa línea.
- **`GET /external/tournaments`**: no he abierto `services/scrapers.js`, así que **no verificado** si `fetchExternalTournaments` cachea y con qué TTL. Si no cachea, ese endpoint escala a CRÍTICO por coste combinado con la ausencia de rate limit.
- **`POST /scan/upload` en Vercel**: `multer.diskStorage` escribe en `process.cwd()/uploads` (`scan.js:15`); en serverless el FS es efímero y de solo lectura salvo `/tmp`. No verificado en el entorno desplegado; si falla, el 500 con `err.message` (`scan.js:131`) lo revelará.
- **`processScanJob`** se lanza sin `await` (`scan.js:120`); en serverless la ejecución se congela tras la respuesta. **No verificado** en producción, pero es la causa probable de jobs eternamente en `queued`/`processing`.
- **`arbiters.js:12`** compara `t.created_by === userId` en JS estricto; depende de que `pg` devuelva `INTEGER` como `number` (lo hace para `int4`). Si alguna migración convirtió la columna a `bigint`, `pg` devuelve `string` y **todas** las comprobaciones de árbitro fallarían en silencio (403). No verificado contra la BD real.

---

## 12. Siguiente paso recomendado

1. **Arreglar primero F-01 y F-02/F-03** (una línea de SQL cada uno): son escrituras destructivas entre inquilinos, explotables con una cuenta gratuita y sin rastro.
2. **F-06** (webhook de Stripe): si hay clientes de pago, se está cobrando sin dar servicio; es el único hallazgo con impacto económico directo y verificación trivial (un pago de prueba).
3. **F-18** (estado `draft` vs `pending`): decidir el estado inicial en un solo sitio y filtrar por lista blanca; arregla de golpe la fuga de borradores en `/public` y `/external`.
4. Crear un helper `assertTournamentOwned(db, tid, userId)` y sustituir las cuatro variantes actuales; la matriz de la sección 7 es la lista de trabajo.
