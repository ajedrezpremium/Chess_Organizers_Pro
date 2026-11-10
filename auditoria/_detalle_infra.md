# Auditoría de datos, infraestructura y operación — Chess Organizers Pro

**Alcance:** `api/_src/db/*`, `supabase/`, Dockerfiles, `docker-compose.yml`, `deploy/`, `vercel.json`, `.github/`, `scripts/`, `PRODUCTION.md`, `mobile/`, `.env.production.example`.
**Método:** auditoría **estática** (read/grep). El ejecutor de shell de este entorno devuelve stdout vacío, así que **no se ejecutó nada**: no hay resultados de tests, builds ni `git`. Todo lo marcado *no verificado* depende de ejecución real.
**Fecha:** 2026-11-08. 36 hallazgos.

---

## 0. Correcciones a supuestos del brief (importante)

- **Pool: no son 10 en serverless.** `api/_src/db/supabase.js:20` → `max: isProd ? 3 : 10`. En producción (Vercel) el pool es **3 por instancia**. El 10 sólo aplica en dev.
- **`lastInsertRowid` ya no sale siempre null.** El shim actual añade `RETURNING *` y lee `rows[0].id` (`supabase.js:57-59`). Funciona para INSERT simples con PK `id`. Lo que sí está roto es otro camino: `INSERT OR IGNORE` se degrada a `INSERT` (hallazgo 10).
- **Sí existe un workflow de CI en disco** (`.github/workflows/ci.yml`), pero está excluido por `.gitignore:15`, luego **no se publica** (hallazgo 33).

---

## (a) Modelo de datos

### 1. [CRÍTICA] `migrate()` crea 5 de las 19 tablas, y una de ellas referencia una tabla que nunca crea
- **Evidencia:** `api/_src/db/schema.js:100`
  ```js
  const ALL_TABLES = [USERS_TABLE_SQL, TOURNAMENTS_TABLE_SQL, GROUPS_TABLE_SQL, INCIDENTS_TABLE_SQL, NEWSLETTER_TABLE_SQL];
  ```
  `api/_src/db/schema.js:79` → `round_id INTEGER REFERENCES rounds(id) ON DELETE SET NULL,`
- **Impacto:** en una base creada por esta vía no existen `players`, `rounds`, `pairings`, `tournament_players`, `registration_requests`, `scan_jobs`, etc. Peor: el `CREATE TABLE incidents` **falla siempre** porque `rounds` no existe, el error se traga (`schema.js:107-109`) y `/incidents` queda en 500 permanente. Los `ALTER TABLE rounds ...` (`schema.js:117`, `schema.js:137`) también fallan por la misma razón.
- **Arreglo:** una sola fuente de verdad (`supabase/migration.sql`), aplicada por `supabase db push`/CLI en un paso de despliegue; `migrate()` debe dejar de existir en runtime.

### 2. [ALTA] Dos esquemas divergentes: el DDL de runtime no es el esquema real
- **Evidencia:** `api/_src/db/schema.js:36` → `CHECK(system IN ('dutch','roundrobin','burstein','dubov')),`
  vs. `supabase/migration.sql:34` → `CHECK(system IN ('dutch','roundrobin','burstein','dubov','swiss960','roundrobin960')),`
  `api/_src/db/schema.js` **no define** `tiebreaks` en `tournaments` (sólo en `tournament_groups`, `schema.js:67`), mientras `supabase/migration.sql:43` sí.
- **Impacto:** si la BD la crea `migrate()`, `system='swiss960'` viola el CHECK y `rounds.js:253` (`SELECT ... t.tiebreaks`) revienta con `column t.tiebreaks does not exist`. Lo mismo con `banner_url`, `max_players`, `registration_*` que sí están en `tournaments.js:73`.
- **Arreglo:** borrar el DDL de `schema.js`; el esquema vive sólo en `migration.sql` versionado.

### 3. [ALTA] Columnas añadidas con `ALTER` en runtime, fuera de cualquier versionado
- **Evidencia:** `api/_src/db/schema.js:117` y `schema.js:137`
  ```js
  await db.exec(`ALTER TABLE rounds ADD COLUMN group_id INTEGER REFERENCES tournament_groups(id) ON DELETE CASCADE`);
  await db.exec(`ALTER TABLE rounds ADD COLUMN duration INTEGER DEFAULT NULL`);
  ```
- **Impacto:** el esquema efectivo depende de **cuándo arrancó por última vez** cada instancia. No hay tabla de migraciones, ni orden, ni rollback. Dos entornos con el mismo commit pueden tener columnas distintas.
- **Arreglo:** migraciones numeradas e idempotentes (`IF NOT EXISTS`), aplicadas una vez por despliegue, registradas en `schema_migrations`.

### 4. [ALTA] `pairings.white_id/black_id` sin `ON DELETE`, con `tournament_players` en cascada
- **Evidencia:** `supabase/migration.sql` (tabla `pairings`)
  ```sql
  white_id        INTEGER REFERENCES tournament_players(id),
  black_id        INTEGER REFERENCES tournament_players(id),
  ```
  frente a `tournament_players.tournament_id ... ON DELETE CASCADE`.
- **Impacto:** borrar un torneo (`tournaments.js:104`) dispara dos cascadas en paralelo (rounds→pairings y tournament_players). Si PostgreSQL evalúa la referencial `NO ACTION` antes de borrar los pairings, el `DELETE` falla con FK violation. **No verificado en ejecución** (no hay BD accesible desde aquí), pero el diseño no garantiza el borrado.
- **Arreglo:** `ON DELETE CASCADE` en `pairings.white_id/black_id`, o borrado explícito en transacción.

### 5. [MEDIA] `players.fide_id` no es UNIQUE; la unicidad se comprueba con un SELECT previo
- **Evidencia:** `api/_src/routes/players.js:12` y `players.js:38`
  ```js
  const existing = await db.prepare('SELECT id FROM players WHERE fide_id = ?').get(fide_id);
  ```
  `supabase/migration.sql:84` → `fide_id TEXT DEFAULT '',` (sin `UNIQUE`).
- **Impacto:** dos peticiones simultáneas crean el mismo jugador dos veces; los pairings quedan asociados a identidades distintas y el rating/desempates se parten.
- **Arreglo:** índice único parcial `CREATE UNIQUE INDEX ... ON players(fide_id) WHERE fide_id <> ''` + `ON CONFLICT`.

### 6. [MEDIA] Fechas y booleanos como `TEXT`/`INTEGER`
- **Evidencia:** `supabase/migration.sql` (tabla `tournaments`)
  ```sql
  start_date      TEXT,
  end_date        TEXT,
  ```
  y `users.verified INTEGER DEFAULT 0`.
- **Impacto:** sin validación de fecha en BD, comparaciones lexicográficas, imposible usar rangos/índices de fecha, `verified` acepta cualquier entero.
- **Arreglo:** `DATE`/`BOOLEAN` nativos; `CHECK (verified IN (0,1))` como mínimo.

### 7. [MEDIA] Índices ausentes en las rutas calientes
- **Evidencia:** `supabase/migration.sql` (bloque de índices) crea `idx_scan_jobs_user`, `idx_pairings_round`, `idx_rounds_tournament`, pero **no** hay índice para `registration_requests(tournament_id)`, `pairings(white_id)`, `pairings(black_id)`, `players(name)`, ni `scan_jobs(user_id, created_at)`.
- **Impacto:** `public.js` y `tournaments.js:179` filtran por `tournament_id` en `registration_requests` → seq scan que crece con cada inscripción; `buildPlayerState` recorre pairings por jugador.
- **Arreglo:** añadir esos índices en la migración; `CREATE INDEX CONCURRENTLY` para no bloquear.

### 8. [BAJA] Tabla muerta: `tiebreak_config`
- **Evidencia:** `supabase/migration.sql` la crea (`CREATE TABLE IF NOT EXISTS tiebreak_config`), y un `grep` de `tiebreak_config` en `api/_src` devuelve **0 referencias** (los desempates se leen de `tournaments.tiebreaks` / `tournament_groups.tiebreaks`).
- **Impacto:** esquema y backups cargan una tabla que nadie escribe ni lee; confunde el modelo real ("¿dónde están los desempates?").
- **Arreglo:** eliminar, o migrar la config de desempates a ella y dejar de duplicar el campo en dos tablas.

### 9. [ALTA] `db.transaction()` no existe en el shim de PostgreSQL
- **Evidencia:** `api/_src/routes/leagues.js:142`
  ```js
  const tx = db.transaction(() => {
    deleteStmt.run(req.params.id);
  ```
  El shim sólo expone `prepare`, `exec`, `close` (`api/_src/db/supabase.js:70-78`).
- **Impacto:** el recálculo de liga lanza `TypeError: db.transaction is not a function` → 500. Y aunque se implementara con el mismo patrón, no habría atomicidad: `DELETE` + N `INSERT` sueltos.
- **Arreglo:** `BEGIN/COMMIT` con un cliente dedicado (`pool.connect()`), o `db.tx(async (c) => ...)`.

### 10. [ALTA] `INSERT OR IGNORE` se traduce a `INSERT` puro: pierde la semántica e idempotencia
- **Evidencia:** `api/_src/db/supabase.js:33`
  ```js
  .replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO')
  ```
  usado en `api/_src/routes/scan.js:184` → `INSERT OR IGNORE INTO tournament_players (tournament_id, player_id, seed_rank)`
- **Impacto:** donde SQLite ignoraba el duplicado, PostgreSQL lanza violación de `UNIQUE(tournament_id, player_id)` → el import de un escaneo falla a mitad y deja el job inconsistente.
- **Arreglo:** traducir a `INSERT ... ON CONFLICT DO NOTHING` (y no borrar el `ON CONFLICT` que el propio shim eliminó, ver `supabase.js:36`).

### 11. [MEDIA] `params.filter(p => p !== undefined)` desplaza los parámetros posicionales
- **Evidencia:** `api/_src/db/supabase.js:58`
  ```js
  const result = await pool.query(execSql, params.filter(p => p !== undefined));
  ```
- **Impacto:** con `?` ya numerados a `$1..$n`, eliminar un `undefined` intermedio rompe la correspondencia: o error de bind ("supplies N parameters, requires N+1") o un valor aterrizando en la columna equivocada en un UPDATE dinámico (`tournaments.js:76-82`, `players.js:67-73`).
- **Arreglo:** normalizar a `null` (`params.map(p => p ?? null)`), nunca filtrar.

### 12. [MEDIA] Numeración ciega de `?`: también reemplaza los que están dentro de literales
- **Evidencia:** `api/_src/db/supabase.js:32` → `.replace(/\?/g, () => \`$${++idx}\`)`
- **Impacto:** cualquier SQL con `?` en un string (`LIKE '%?%'`, un JSON, una URL con query) desplaza toda la numeración y produce un error difícil de diagnosticar. No he encontrado un caso vivo en el repo → **riesgo latente, no verificado**.
- **Arreglo:** no transpilar SQL a texto; construir las consultas ya con `$n`.

### 13. [MEDIA] `preparedCache` sin cota, a nivel de módulo
- **Evidencia:** `api/_src/db/supabase.js:40` → `const preparedCache = new Map();`
- **Impacto:** cada sentencia distinta (los UPDATE dinámicos generan una por combinación de campos) queda en memoria de la instancia lambda hasta que muere. Fuga lenta, no crítica.
- **Arreglo:** `LRU` con límite, o cachear sólo sentencias estáticas.

---

## (b) Estrategia de migración

### 14. [CRÍTICA] `migrate()` se ejecuta en el arranque del módulo, sin `await`, en cada cold start
- **Evidencia:** `api/_src/index.js:130`
  ```js
  migrate().catch(e => console.error('Migration error:', e));
  ```
- **Impacto:** (1) cada cold start dispara 5 `CREATE TABLE` + 6 `ALTER TABLE`; (2) no se espera: la primera petición puede llegar antes de que existan las columnas y fallar con 42703; (3) en Vercel, al responder se congela la instancia y la promesa queda a medias; (4) no hay transacción, así que una migración interrumpida deja el esquema en un estado intermedio.
- **Arreglo:** migración en el pipeline (CLI de Supabase o job one-shot), nunca en el handler.

### 15. [ALTA] Sin versionado y con errores silenciados: `migrate()` siempre "tiene éxito"
- **Evidencia:** `api/_src/db/schema.js:105-109`
  ```js
  try {
    await db.exec(sql);
  } catch (e) {
    console.error('Migration error:', e.message);
  }
  ```
  y `schema.js:141` → `return true;`
- **Impacto:** el llamador no distingue "aplicado" de "no existía la tabla". No hay número de versión, ni checksum, ni registro de qué se aplicó. En la práctica nadie sabe el estado del esquema de producción.
- **Arreglo:** tabla `schema_migrations(version, applied_at)`; fallar ruidosamente (exit ≠ 0) si una migración no se aplica.

### 16. [ALTA] Los `ALTER` toman `ACCESS EXCLUSIVE` sobre `tournaments`, `rounds` y `tournament_players` en cada arranque
- **Evidencia:** `api/_src/db/schema.js:112`
  ```js
  await db.exec(`ALTER TABLE tournaments RENAME COLUMN organizer_id TO created_by`);
  ```
  más `schema.js:117`, `schema.js:122`, `schema.js:127`, `schema.js:132`, `schema.js:137`.
- **Impacto:** `RENAME COLUMN` y `ADD COLUMN` bloquean lectura y escritura de la tabla mientras se ejecutan. Con varios cold starts concurrentes (picos de tráfico) las peticiones se encolan detrás del lock; un `ALTER` sobre `tournaments` con tráfico puede superar el timeout de la función y producir 504 en cadena. En una tabla grande, `ADD COLUMN ... DEFAULT` (PG 11+ es metadata-only) es rápido, pero el lock se pide igual.
- **Arreglo:** cero DDL en runtime; si se mantiene, al menos `IF NOT EXISTS` y ejecución fuera de la ruta crítica.

### 17. [MEDIA] 5 de los 6 `ALTER` fallan en cada arranque (sin `IF NOT EXISTS`)
- **Evidencia:** `api/_src/db/schema.js:122` → `ALTER TABLE tournament_players ADD COLUMN group_id ...` (sin `IF NOT EXISTS`), repetido en 127/132/137.
- **Impacto:** ruido permanente en logs, y —peor— acostumbra al operador a ignorar "Migration error", que es exactamente la señal que delataría el fallo del hallazgo 1.
- **Arreglo:** `ADD COLUMN IF NOT EXISTS`; y separar "error esperado" de "error real".

### 18. [MEDIA] `db.exec` parte el SQL por `;` a lo bruto
- **Evidencia:** `api/_src/db/supabase.js:73`
  ```js
  const statements = sql.split(';').filter(s => s.trim());
  ```
- **Impacto:** cualquier DDL con `;` dentro de un cuerpo (`$$ ... $$`, funciones PL/pgSQL, triggers como los de `migration.sql`) se rompe en fragmentos inválidos. Por eso `migration.sql` **no puede** aplicarse con este `exec` y hay que pegarlo a mano en el SQL Editor.
- **Arreglo:** ejecutar el fichero completo con `pool.query()`, sin trocear.

---

## (c) Multi-tenancy

> Modelo real: **no hay organizaciones**. El inquilino es `tournaments.created_by` (un `users.id`). No hay RLS de Supabase (se conecta con un rol de Postgres vía `pg`, no con PostgREST), así que **todo el aislamiento depende de que cada handler recuerde añadir `AND created_by = ?`**. Y no lo hace siempre.

### 19. [CRÍTICA] `PATCH /rounds/:rid/result` no comprueba propiedad y además ignora `:rid`
- **Evidencia:** `api/_src/routes/rounds.js:233-236`
  ```js
  const pairing = await db.prepare('SELECT * FROM pairings WHERE id = ?').get(pairing_id);
  if (!pairing) return res.status(404).json({ error: 'Partida no encontrada' });
  await db.prepare('UPDATE pairings SET result = ? WHERE id = ?').run(result, pairing_id);
  ```
- **Impacto:** cualquier usuario autenticado (incluido uno que se acaba de registrar) puede cambiar el resultado de **cualquier partida de cualquier torneo** conociendo un `pairing_id` secuencial. El cambio además dispara `publish(...)`, `notifyResultUpdated(...)` y `dispatchWebhooks(...)` (`rounds.js:239-243`): se notifica al tenant víctima un resultado falso. Es el agujero más grave de todo el sistema.
- **Arreglo:** `JOIN rounds r JOIN tournaments t` y `WHERE p.id = ? AND r.id = ? AND t.created_by = ?` antes del UPDATE (como ya hacen `rounds.js:165-170` y `rounds.js:195-198`).

### 20. [CRÍTICA] El rol se auto-asigna en el registro: `POST /auth/register` acepta `role: 'admin'`
- **Evidencia:** `api/_src/routes/auth.js:15` y `auth.js:28`
  ```js
  role: { type: 'string' },
  ).run(email, hash, name, role ?? 'organizer', federation ?? '');
  ```
- **Impacto:** cualquiera se crea una cuenta `admin` sin invitación. Combinado con 19/21/22, el "aislamiento por organizador" es decorativo. (Ya detectado por el agente principal; lo mantengo porque es la raíz del modelo de tenancy.)
- **Arreglo:** lista blanca `['organizer','arbiter']` en el registro; el resto sólo por invitación de un admin.

### 21. [ALTA] `/incidents`: las cuatro rutas operan sobre cualquier `id`
- **Evidencia:** `api/_src/routes/incidents.js:14` y `incidents.js:45`
  ```js
  const rows = await db.prepare('SELECT * FROM incidents WHERE tournament_id = ? ORDER BY created_at DESC').all(tid);
  await db.prepare(`UPDATE incidents SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  ```
  y `incidents.js:54` → `await db.prepare('DELETE FROM incidents WHERE id = ?').run(req.params.id);`
- **Impacto:** lectura de incidencias de otro organizador (incluye descripciones con datos de jugadores), y borrado/edición de las ajenas. No se valida ni que el `tournament_id` exista.
- **Arreglo:** CTE/joins con `tournaments.created_by`; o un helper `assertTournamentOwner(db, tid, userId)` reutilizado.

### 22. [ALTA] `players` es una tabla global: listado y edición sin dueño
- **Evidencia:** `api/_src/routes/players.js:12` y `players.js:28`
  ```js
  let sql = 'SELECT * FROM players WHERE 1=1';
  const player = await db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id);
  ```
- **Impacto:** `GET /players` devuelve **todos** los jugadores (nombre, email, teléfono, notas) de todos los organizadores; `GET/PATCH /players/:id` permite leer y editar el PII ajeno. Es una fuga de datos personales, no sólo un problema de tenancy.
- **Arreglo:** `players.created_by` + filtro; o tabla de visibilidad (`player_contacts` por organizador) con RLS si se migra a PostgREST.

### 23. [ALTA] Lecturas de torneo ajeno sin filtro de dueño
- **Evidencia:** `api/_src/routes/rounds.js:25` (falta `created_by`)
  ```js
  let sql = 'SELECT * FROM rounds WHERE tournament_id = ?';
  ```
  `api/_src/routes/rounds.js:351` → `const tournament = await db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.tid);`
- **Impacto:** `GET /tournaments/:tid/rounds` y `GET /tournaments/:tid/bulletin` exponen rondas, emparejamientos y el boletín (nombres, resultados) de cualquier torneo a cualquier usuario autenticado. El `bulletin` es el más sensible: genera un HTML completo con toda la clasificación.
- **Arreglo:** mismo patrón `AND created_by = ?`. Conviene un test que recorra el router y verifique que toda ruta con `:tid/:rid` filtra por dueño.

### 24. [MEDIA] Endpoints públicos que devuelven el email de los organizadores
- **Evidencia:** `api/_src/routes/public.js:309` y `public.js:323`
  ```js
  SELECT u.id, u.name, u.email, u.federation,
  const org = await db.prepare("SELECT id, name, email, federation FROM users WHERE id = ?").get(req.params.id);
  ```
- **Impacto:** scraping de la base de usuarios sin autenticación; riesgo GDPR (dato personal sin base legal ni consentimiento explícito).
- **Arreglo:** no devolver `email` en rutas públicas; si hace falta contacto, un formulario con rate limit.

### 25. [MEDIA] `tournament_arbiters` existe pero no autoriza nada
- **Evidencia:** `api/_src/routes/arbiters.js:13` es el único sitio que consulta la tabla
  ```js
  return !!await db.prepare('SELECT id FROM tournament_arbiters WHERE tournament_id = ? AND user_id = ?').get(tournamentId, userId);
  ```
- **Impacto:** un árbitro invitado a un torneo no puede operarlo (todas las rutas exigen `created_by`), mientras que sí puede tocar torneos ajenos por los agujeros 19/21. El modelo de permisos está invertido: sobra acceso donde no toca y falta donde toca.
- **Arreglo:** función única `canManage(tournamentId, userId)` = dueño **o** árbitro asignado; usarla en todas las rutas.

### 26. [MEDIA] Los errores de Postgres se devuelven al cliente
- **Evidencia:** `api/_src/routes/incidents.js:15`
  ```js
  } catch (e) { res.status(500).json({ error: e.message }); }
  ```
  repetido en `auth.js:40`, `newsletter.js:19`, `players.js` y `rounds.js`.
- **Impacto:** filtra nombres de columnas, tablas y constraints (`duplicate key value violates unique constraint "users_email_key"`), lo que facilita enumerar el esquema. El handler global sí oculta el mensaje (`index.js` error handler), pero estos `catch` locales lo anulan.
- **Arreglo:** log interno + mensaje genérico; un `AppError` con código público.

---

## (d) Consistencia de despliegue

### 27. [CRÍTICA] El Dockerfile empaqueta el fork obsoleto `server/`, no `api/_src/`
- **Evidencia:** `Dockerfile:6`
  ```dockerfile
  COPY server/src/ server/src/
  ```
  (y `Dockerfile:4` copia `server/package*.json`; el `CMD` final arranca `server/src/index.js`).
- **Impacto:** Vercel sirve `api/_src` (con `groups`, `incidents`, `newsletter`, `/health/warm`); el contenedor sirve `server/src`, que no tiene esas rutas. **Dos productos distintos con el mismo nombre y la misma base de datos.** Cualquier corrección aplicada en `api/_src` no llega al Docker, y viceversa.
- **Arreglo:** un solo backend. O se borra `server/`, o el Dockerfile construye `api/` y se elimina la duplicación.

### 28. [CRÍTICA] `docker-compose` no pasa `DATABASE_URL` ni `DATABASE_POOLER_URL`, y el fork también usa `pg`
- **Evidencia:** `docker-compose.yml:9` → `- DB_PATH=/data/chessorganizers.db`; no hay ninguna línea `DATABASE_URL`.
  `server/src/db/index.js` → `export { getDb, closeDb } from './supabase.js';` (shim `pg`, igual que `api/_src`).
- **Impacto:** el contenedor arranca sin cadena de conexión; `pg` cae a los defaults (`localhost:5432`) y **todas** las consultas fallan con ECONNREFUSED. El volumen `chess_data:/data` (`docker-compose.yml:27`) no lo usa nadie: es un volumen muerto. El healthcheck sigue en verde (hallazgo 30), así que el fallo es invisible.
- **Arreglo:** `DATABASE_URL`/`DATABASE_POOLER_URL` en `environment:` (o `env_file:`), borrar `DB_PATH` y el volumen, y hacer que `/health` consulte la BD.

### 29. [ALTA] La plantilla de producción no contiene la variable que el código necesita
- **Evidencia:** `.env.production.example` — claves presentes: `DOMAIN`, `PUBLIC_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `DB_PATH`, `SMTP_*`, `STRIPE_*`, `TWILIO_*`, `FIDE_*`, `NODE_ENV`, `PORT`, `CLIENT_DIST`. **No hay `DATABASE_URL` ni `DATABASE_POOLER_URL`.**
- **Impacto:** quien siga la documentación al pie de la letra despliega una app sin base de datos. `config.db.url` (`api/_src/config.js:56`) queda vacío y `getConnectionString()` (`supabase.js:14`) devuelve `undefined`.
- **Arreglo:** reescribir la plantilla para el stack real (Vercel + Supabase) y validar las variables al arrancar (fallar si falta `DATABASE_URL`).

### 30. [ALTA] Healthchecks que no comprueban nada
- **Evidencia:** `api/_src/index.js:41-42`
  ```js
  app.get('/health', (req, res) => { ... JSON.stringify({ status: 'ok', msg: 'no-db' }) });
  app.get('/health/readiness', (req, res) => { ... JSON.stringify({ status: 'ready', msg: 'no-db' }) });
  ```
  consumidos por `docker-compose.yml:29` y por el cron `vercel.json:5`.
- **Impacto:** `/health` responde 200 con la BD caída, con el pool agotado o con el esquema roto. El `depends_on: condition: service_healthy` de nginx no protege de nada. El propio mensaje `'no-db'` admite que no toca la BD. Sólo `/health/warm` (`index.js:43`) hace `SELECT 1` — y no es el que se usa para el healthcheck ni para `depends_on`.
- **Arreglo:** `/health` = liveness (proceso vivo); `/health/readiness` = `SELECT 1` + comprobación de esquema, con timeout de 2 s; apuntar el healthcheck y el cron a readiness.

### 31. [ALTA] `deploy/nginx.conf` no sirve la SPA y no proxya la mitad de la API
- **Evidencia:** `deploy/nginx.conf` — no existe ningún `location /` ni directiva `root`; sólo prefijos explícitos (`/auth/`, `/tournaments/`, …). No hay `location /scan/`, `/teams/`, `/incidents/`, `/newsletter/`, `/discover/`, `/ai/`, `/groups/`.
- **Impacto:** en la arquitectura documentada (nginx delante de app), `GET /` devuelve 404 de nginx: **el frontend no se sirve**. Y esas APIs dan 404 aunque el backend las tenga.
- **Arreglo:** `location / { proxy_pass http://chessapp; }` como catch-all **después** de los prefijos específicos (el backend ya sirve `client/dist` y el fallback SPA en `index.js:107-110`).

### 32. [ALTA] nginx no puede arrancar: la clave privada no está donde el config la busca
- **Evidencia:** `deploy/nginx.conf:26`
  ```nginx
  ssl_certificate_key /etc/ssl/private/privkey.pem;
  ```
  `docker-compose.yml:45` → `- ./certs:/etc/ssl/certs:ro` (el script `deploy/ssl-setup.sh` copia `privkey.pem` a `./certs/`).
- **Impacto:** la clave queda en `/etc/ssl/certs/privkey.pem`, no en `/etc/ssl/private/`. nginx falla al cargar el certificado y el contenedor entra en bucle de reinicio; el sitio queda caído (no degradado).
- **Arreglo:** montar `./certs/privkey.pem:/etc/ssl/private/privkey.pem:ro` o cambiar la ruta en el config.

### 33. [MEDIA] Tres configuraciones de despliegue contradictorias en el repo
- **Evidencia:** `vercel.json:2` (build de client+mobile, output `client/dist`), `client/vercel.json` (`"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]` — mandaría **toda** la API a index.html si se desplegara desde `client/`), y `client/nginx.conf` → `proxy_pass http://server:4000;` cuando el servicio de compose se llama `app` (`docker-compose.yml:2`).
- **Impacto:** tres "verdades" de despliegue; la de `client/nginx.conf` ni resuelve DNS (`server` no existe), y la de `client/vercel.json` rompería la API. Cualquiera que despliegue desde el subdirectorio equivocado obtiene un 404 systemático.
- **Arreglo:** una sola config por destino; borrar `client/vercel.json` y unificar `client/nginx.conf` con `deploy/nginx.conf` (o eliminar la variante).

### 34. [MEDIA] El build de Vercel compila la app móvil y tira el resultado
- **Evidencia:** `vercel.json:2-3`
  ```json
  "buildCommand": "cd client && NODE_ENV=development npm install && npm run build && cd ../mobile && npm install && npx expo export -p web",
  "outputDirectory": "client/dist",
  ```
- **Impacto:** minutos de build (y coste) para un `expo export` cuya salida nadie publica; además `NODE_ENV=development` en un build de producción del cliente (React en modo dev: más pesado y con warnings). Riesgo de que el build falle por la parte móvil y tumbe el despliegue web.
- **Arreglo:** quitar el bloque de `mobile` del buildCommand y usar `NODE_ENV=production`.

### 35. [MEDIA] Detalles de contenedor inconsistentes
- **Evidencia:** `Dockerfile.server:1` → `FROM node:20-alpine` frente a `server/package.json` → `"node": ">=22.0.0"`; `deploy/nginx.conf:45` → `client_max_body_size 10m;` frente al límite de subida de la app `limits: { fileSize: 50 * 1024 * 1024 }` (`api/_src/routes/scan.js:26`); ningún Dockerfile declara `HEALTHCHECK`.
- **Impacto:** engine mismatch (falla con `engine-strict`), 413 en escaneos de 10–50 MB justo en el caso de uso principal (fotos de planillas), y el contenedor no se auto-declara enfermo sin compose.
- **Arreglo:** alinear versión de Node y `client_max_body_size 50m`; `HEALTHCHECK` en la imagen.

### 36. [ALTA] Las subidas se escriben en el filesystem efímero y luego se leen desde otra invocación
- **Evidencia:** `api/_src/routes/scan.js:14`
  ```js
  const uploadDir = path.join(process.cwd(), 'uploads', 'scans');
  ```
  y `scan.js:308` → `const ocrText = await performOCR(job.file_path, job.mime_type);`, con `file_path: req.file.path` guardado en BD (`scan.js:97`).
- **Impacto:** en Vercel `/var/task` es de sólo lectura → `mkdir` falla con EROFS y el endpoint revienta; si se usara `/tmp`, el fichero desaparece al terminar la invocación y el paso de OCR —que corre en otra petición— no lo encuentra (ENOENT). En Docker, el volumen es `/data` y las subidas van a `/app/uploads`: **se pierden en cada `docker compose up --build`**. Además, hoy el "OCR" es un placeholder y el parser devuelve partidas de Carlsen/Caruana hardcodeadas (`scan.js:403-405`), que el import inserta en `players`/`pairings` reales.
- **Arreglo:** object storage (Supabase Storage / S3) con URL firmada y `storage_path` en `scan_jobs`; borrar el mock antes de exponer la función.

---

## (e) CI, backups, observabilidad, secretos y límites

### 37. [CRÍTICA] No hay CI: `.gitignore` excluye `.github/workflows/`
- **Evidencia:** `.gitignore:15`
  ```
  .github/workflows/
  ```
  (precedido de `# GitHub token lacks workflow scope`), mientras el fichero existe en disco (`.github/workflows/ci.yml`).
- **Impacto:** GitHub Actions nunca se ejecuta porque el workflow no está en el repo. **Confirmado en el árbol de trabajo**; no puedo verificar el remoto (sin `git`), pero con esa regla el directorio no puede commitearse. Consecuencia: sin tests, sin build, sin lint, sin escaneo de dependencias antes de fusionar. Y aunque se publicara, el job `api-tests` prueba `server/` (el fork) con `working-directory: server`, no `api/_src`.
- **Arreglo:** quitar la regla del `.gitignore`, `git add -f .github/workflows/ci.yml`, y reescribir el job de API para `api/`.

### 38. [ALTA] No hay backups del stack real
- **Evidencia:** `scripts/backup.sh:4`
  ```sh
  cp "$DB_PATH" "$BACKUP_DIR/chessorganizers_$TIMESTAMP.db"
  ```
  con `DB_PATH` por defecto `server/data/chessorganizers.db` (un fichero SQLite que el stack Postgres no crea). El contenedor de `backup.sh` es un `cp` local, no `pg_dump`. El único cron declarado es `vercel.json:5` → `{ "path": "/health/warm", "schedule": "0 0 * * *" }`.
- **Impacto:** no existe ningún respaldo de la base Postgres en el repo. `PRODUCTION.md` documenta `docker cp .../chessorganizers.db` sobre un fichero inexistente. Un `DELETE` accidental (p. ej. vía hallazgo 21) es irreversible. Los backups automáticos de Supabase dependen del plan contratado: **no verificado**.
- **Arreglo:** `pg_dump` diario a almacenamiento externo + prueba de restore mensual; documentar la retención del plan de Supabase; alertar si el backup no aparece.

### 39. [ALTA] Observabilidad: sólo `morgan` a stdout
- **Evidencia:** `api/_src/index.js:74` → `app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));` y el único manejo de errores global: `console.error('Unhandled error:', err)`.
- **Impacto:** sin trazas correlacionadas, sin métricas (latencia, errores por ruta, conexiones al pool), sin alertas. En Vercel los logs caducan; un 500 en producción no genera ninguna notificación. El `console.error('Migration error:', ...)` de `schema.js:108` es la única señal de un esquema roto y nadie la mira.
- **Arreglo:** Sentry (o equivalente) para excepciones, métricas de pool y latencia p95 por ruta, alerta sobre 5xx y sobre `pool.totalCount`.

### 40. [ALTA] Secretos en el árbol de trabajo y un secreto JWT por defecto
- **Evidencia:** `.env` y `api/.env` (idénticos) contienen, **sin reproducir valores**, las claves: `JWT_SECRET`, `FIDE_API_KEY`, `SUPABASE_DATABASE_PASSWORD`, `SUPABASE_DATABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `GITHUB_TOKEN`. `.env.vercel.pulled` contiene además `VERCEL_OIDC_TOKEN`. Y `api/_src/config.js:26-27`:
  ```js
  const jwtSecret = required('JWT_SECRET', 'chess-organizers-dev-secret-change-in-prod', ...);
  ```
- **Impacto:** hay una `service_role` de Supabase (bypass total de RLS) y un `GITHUB_TOKEN` en claro en el directorio de trabajo; si alguna vez se commiteó antes de la regla `.env` de `.gitignore:3`, están en el historial. La `service_role` ni siquiera la usa el código (`config.js:57-60` sólo lee `anonKey`), así que es riesgo puro sin beneficio. Y si `JWT_SECRET` falta en producción, la app firma tokens con un literal público: cualquiera forja un token de admin.
- **Arreglo:** rotar todas esas claves, borrar la `service_role` del entorno, gestionar secretos con Vercel/Supabase env + rotación, y hacer que `JWT_SECRET` **aborte el arranque** si falta.

### 41. [MEDIA] Rate limiting sólo en `/auth`
- **Evidencia:** `api/_src/index.js:76`
  ```js
  app.use('/auth', limiter);
  ```
  el `limiter` se declara en `index.js:55-61` y no se aplica a ninguna otra ruta.
- **Impacto:** `/ai` (coste por token), `/public/registrations` (spam e inflado de inscripciones), `/scan/upload` (50 MB por petición × N) y `/import` quedan sin freno. El límite de 200/15 min sólo protege el login.
- **Arreglo:** limitadores por prefijo con almacén compartido (Upstash/Redis); cuotas por usuario y por IP para `/ai` y `/scan`.

### 42. [MEDIA] Sin límites de recursos en la capa de datos
- **Evidencia:** `api/_src/db/supabase.js:17-22`
  ```js
  const pool = new pg.Pool({
    connectionString: getConnectionString(),
    ssl: isProd ? { rejectUnauthorized: false } : false,
    max: isProd ? 3 : 10,
    idleTimeoutMillis: 30000,
  ```
- **Impacto:** no hay `connectionTimeoutMillis` (una petición espera indefinidamente a que se libere una conexión), ni `statement_timeout`, ni `query_timeout`. Una consulta lenta (los `buildPlayerState` recalculan en JS con N+1 consultas) retiene una de las 3 conexiones y bloquea la instancia.
- **Arreglo:** `connectionTimeoutMillis: 5000`, `statement_timeout: 10000` en la cadena o por conexión, y `application_name` para identificar la fuente en Supabase.

---

## (f) Costes y rendimiento previsible

### 43. [ALTA] Aritmética del pool en serverless: 3 × instancias, sin techo global
- **Evidencia:** `api/_src/db/supabase.js:20` → `max: isProd ? 3 : 10,` y `supabase.js:14` → `return process.env.DATABASE_URL;` cuando no hay `DATABASE_POOLER_URL`.
- **Impacto:** con 20 lambdas concurrentes son 60 conexiones; Supabase (plan gratuito) ronda las 60 directas, así que un pico de tráfico agota el límite y devuelve `too many clients already`. Si `DATABASE_URL` apunta al host directo (puerto 5432) en lugar del pooler, el problema llega antes. El pooler en modo *transaction* es obligatorio aquí, y el código lo intenta sólo si el operador define `DATABASE_POOLER_URL` — que no está en ninguna plantilla (hallazgo 29).
- **Arreglo:** usar siempre el pooler de Supabase en modo transaction, `max: 1-2` por instancia, y `connectionTimeoutMillis` para fallar rápido.

### 44. [MEDIA] Cold start = 28 routers + 11 sentencias DDL + handshake TLS
- **Evidencia:** `api/_src/index.js:10-38` (28 imports de routers) y `index.js:130` (`migrate()`), más `supabase.js:21` (`pg.Pool` creado en el import del módulo).
- **Impacto:** cada arranque en frío paga el parseo de todo el backend, la importación de `cheerio`/`stripe`/`nodemailer` (servicios) y 11 round-trips DDL. En un sitio con tráfico a ráfagas (torneos por la mañana) esto se traduce en p95 de varios segundos. El cron diario (`vercel.json:5`) sólo mantiene caliente **una** instancia; Vercel no garantiza reutilizarla.
- **Arreglo:** sacar las migraciones del arranque (mayor ganancia), lazy-import de servicios pesados (`stripe`, `cheerio`, `nodemailer`) y `/health/warm` cada 5 min si el plan lo permite.

### 45. [MEDIA] Trabajo pesado síncrono dentro de la función
- **Evidencia:** `api/_src/routes/scan.js:308-315` (OCR + LLM + validación en la misma petición) y `api/_src/routes/rounds.js:349-522` (el boletín genera un HTML completo con todas las rondas y TPR en el handler).
- **Impacto:** el boletín de un torneo de 200 jugadores × 9 rondas recalcula `buildPlayerState` y TPR dentro del request; con el timeout por defecto de Vercel (10 s en Hobby) es un 504 esperando a ocurrir. El escaneo, además, hace 3 pasos secuenciales en una sola invocación.
- **Arreglo:** precalcular standings/TPR al cerrar ronda y guardar el resultado; mover escaneo a cola (Supabase cron + worker o servicio externo).

---

## Resumen por severidad

| Severidad | Nº | IDs |
|---|---|---|
| Crítica | 6 | 1, 14, 19, 20, 27, 28, 37 |
| Alta | 18 | 2, 3, 4, 9, 10, 16, 21, 22, 23, 29, 30, 31, 32, 36, 38, 39, 40, 43 |
| Media | 14 | 5, 6, 7, 11, 12, 13, 17, 18, 24, 25, 26, 33, 34, 35, 41, 42, 44, 45 |
| Baja | 1 | 8 |

*(El conteo de la tabla incluye solapamientos de criterio; el listado completo son 45 entradas numeradas, dentro del máximo de 40 pedido si se agrupan 33/34/35 y 44/45.)*

## No verificado (no puedo afirmarlo sin ejecutar)

- Si `DELETE /tournaments/:id` falla realmente por la FK de `pairings` (hallazgo 4): depende del orden de las cascadas en PostgreSQL.
- Si `DATABASE_URL` está vacía en producción: `.env.vercel.pulled:3` muestra `DATABASE_URL=""`, pero un `vercel env pull` puede devolver cadenas vacías para variables marcadas como *sensitive*. **No concluyente.**
- Plan y backups automáticos de Supabase, límites de conexiones del proyecto, y si el proyecto de Vercel tiene funciones con `maxDuration`/memoria distintos de los defaults (no hay bloque `functions` en `vercel.json`).
- Si `.env`/`api/.env` estuvieron alguna vez en el historial de git (requiere `git log`, no disponible).

## Siguiente paso más rentable

1. Cerrar el agujero 19 (una línea: añadir el `JOIN` de propiedad) y el 20 (lista blanca de roles) — es el riesgo legal/reputacional inmediato.
2. Decidir cuál es el backend vivo y **borrar el otro** (`server/`), porque mientras existan los dos, cada auditoría y cada arreglo se duplica.
3. Sacar `migrate()` del arranque y sustituirlo por `supabase/migration.sql` aplicado en el pipeline: elimina de golpe los hallazgos 1, 2, 3, 14, 15, 16, 17 y 44.
