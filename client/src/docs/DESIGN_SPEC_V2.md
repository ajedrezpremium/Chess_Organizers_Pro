# DESIGN SPEC V2 — Panel de Control Pro + Descubrimiento + Directorio + Eventos

> Objetivo: portada + panel de control 2 columnas (mando pro | descubrimiento/retención),
> buscador universal, directorio Fed/Clubes/Escuelas, centro de notificaciones y página
> dedicada de evento. Estilo: pro, moderno, digital, elegante.

## 1. Rutas

| Ruta | Componente | Acceso |
|---|---|---|
| `/` | Landing (mejorada) | público |
| `/search` | SearchPage | público |
| `/t/:slug` | EventPage (variante pública) | público |
| `/directory` | DirectoryPage | público |
| `/app/dashboard-pro` | DashboardPro (2 columnas) | protegido |
| `/app/search` | SearchPage (variante app) | protegido |
| `/app/directory` | DirectoryPage (variante app) | protegido |
| `/app/notifications` | NotificationsPage | protegido |
| `/app/events/:id` | EventPage (variante privada, gestión) | protegido |
| `/app/dashboard` | Dashboard legacy (se conserva) | protegido |

## 2. Layout DashboardPro (2 columnas)

- Contenedor: `max-w-[1400px]`, grid `lg:grid-cols-[340px_1fr]`, gap-6.
- Izquierda `sticky top-20 self-start`: ProfileCard → MyTournaments (tabs Activos/Preparación/Finalizados)
  → MetricsStrip → QuickActions.
- Derecha: LiveBar (sticky) → UpcomingPanel (tabs por fuente) → FinishedTable → NewsLinks.
- Mobile: 1 columna, izquierda primero colapsable con `<details>`.

## 3. Design tokens (`design-system/tokens.js`)

- Colores: `navy #0B1D3A`, `navy2 #1A3C6E`, `accent #F59E0B`, superficies light/dark.
- Tipografía: Inter UI + JetBrains Mono para datos.
- `levelStyles`: L1 info gris, L2 azul, L3 ámbar, L4 rojo (avisos + notificaciones).
- `statusStyles`: active/pending/finished/cancelled/demo + live/upcoming.

## 4. Componentes base (`design-system/ui.jsx`)

Button (primary/ghost/danger + sizes), Card (+Header), Badge, Avatar,
Tabs, TextInput/SelectInput, DataTable (sort + paginación simple), EmptyState,
SectionTitle, Stat. Sin dependencias nuevas. Dark-mode con clases `dark:`.

## 5. Datos

- `data/chessSources.js`: 27+ fuentes categorizadas
  (calendarios, pairings/resultados, online, noticias/herramientas) con `{ id, name, url, cat }`.
  + `LIVE_SEED`, `UPCOMING_SEED`, `FINISHED_SEED` (fallback cuando el backend no responde).
- `data/directorySeed.js`: federaciones (FIDE, ECU, FEDA...), clubes y escuelas seed
  `{ id, kind, name, country, city, url, email, verified, events12m }`.
- `hooks/useDiscover.js`: intenta `api.discover()` y cae a seeds; expone
  `{ live, upcoming, finished, news, loading, source }`.

## 6. API (frontend-first, degradación elegante)

- Se reutiliza `api.listTournaments`, `api.public.listTournaments`, `api.getNotifications`.
- Nuevos métodos opcionales en `api/client.js`: `discover()`, `searchTournaments()`,
  `getDirectory()`, `fideLive()` — todos con try/catch y fallback a seeds.
- Backend (fase 2): `GET /api/v1/discover`, `/search`, `/directory`, workers cron
  (2700chess 5min, ECU/ChessBase 6h, FIDE 12h, Chess.com/Lichess 15min).

## 7. Notificaciones

Tipos: `urgent` (técnico evento), `pending` (acción árbitro), `system`, `billing`, `social`.
Severidad visual = levelStyles 1-4. Dropdown existente + página `/app/notifications`
con filtros por tipo, marcar leídas, deep-link a evento.

## 8. Página Evento (`/t/:slug` pública, `/app/events/:id` privada)

Hero (banner, fechas, sede, sistema, ritmo, prize, botones Seguir/Compartir/TRF/TV)
→ LiveBoard (tableros en juego) → tabs Clasificación / Emparejamientos / Partidas / Info
→ (privado) panel gestión: pairings pendientes, alertas, scanner, generar R+, exportar.
Reutiliza `PublicTournament`/`TournamentDetail` como cuerpo central.

## 9. Buscador (`/search`)

Filtros: texto (nombre/ciudad/jugador), país, desde/hasta, sistema, ritmo, online/presencial,
ELO mín. Resultados: cards + tabla; detalle modal con tabs
Clasificación/Emparejamientos/Resultados. Atajo global Cmd+K (`GlobalSearch`).

## 10. PWA (fase 2)

Manifest + SW + push (WebPush) + offline queue (existe `offlineQueue.js`).
