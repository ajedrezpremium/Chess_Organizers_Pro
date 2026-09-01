# P1 — Integración Organizador /tournament ← Chess Organizers Pro

**Objetivo:** el organizador en `chessorganizers.com/tournament` gestiona evento sin salir de su plataforma, pero usa 3 herramientas Pro en **1 clic**.

## Arquitectura

```
chessorganizers.com/tournament/:id  (Organizador: venue, tickets, sponsors)
        │
        ├──→ SSO JWT (user.email → api/_src/middleware/auth.js) 
        ├──→ POST /tournaments (crea espejo en Supabase tournaments)
        └──→ Embeds:
             ├─ <iframe src="https://chess-organizers-pro.vercel.app/embed/tournament/:id/live">  (Standings)
             ├─ <iframe src=".../embed/tournament/:id/pairings"> (Generar + Validar)
             └─ <iframe src=".../embed/tournament/:id/checkin"> (QR Check-in)
        ←── webhooks tournament.created / round.closed / pairing.result → Organizador
```

## P1 — 3 herramientas

### 1. Live Standings Widget
- **API Pro:** `GET /public/tournaments/:id/standings`, `GET /public/tournaments/:id/rounds`, `GET /public/tournaments/:id/players`
- **Embed:** `client/src/pages/EmbedTournament.jsx` — tabla live con tiebreaks `BH/SB/DE/PR` `tiebreaks.js:14`, auto-refresh 10s, TV View link
- **Uso Organizador:** `<iframe src="https://chess-organizers-pro.vercel.app/embed/tournament/123/live" height="400">`

### 2. Pairings + Validación FIDE
- **API Pro:** `POST /tournaments/:id/rounds/generate` → `dutch.js:12`, `GET /validation/:id` → C8-C17 (colores, reencuentros, byes)
- **Embed:** botón “Generar Ronda” + checklist 9 checks (`ArbiterControlCenter.jsx:86`) → preview → “Publicar”
- **Flujo Organizador:** click “Generar” en /tournament → fetch Pro → muestra “PAIRING VALID 92 mesas” → Publica → webhook `round.published` actualiza Organizador

### 3. Check-in QR
- **API Pro:** `POST /arbiters/players/:tpId/check-in` `ArbiterPanel.jsx:29`, `GET /tournaments/:id/players` con `checked_in`
- **Embed:** grid de 184 avatares `checked_in 42/184` + QR scanner `QRCode.jsx:14` + búsqueda mesa/jugador
- **Uso Organizador:** en recepción, tablet con iframe check-in, offline-first `offlineQueue.js:14`

## SSO

`chessorganizers.com` genera JWT `generateToken({id,email,name,role})` `api/_src/middleware/auth.js:14` y lo pasa como `?token=` al iframe. Pro valida y crea `tournament_arbiters` si no existe.

## Webhooks

Organizador registra `POST /webhooks {url, event_type: 'round.closed'}` → Pro notifica al cerrar ronda para actualizar calendario Organizador.

## Demo local

`https://chess-organizers-pro.vercel.app/embed/tournament/:id/live|pairings|checkin` — 3 iframes listos, PWA offline, 3s cold start via PgBouncer `supabase.js:20`.

---
*P1 listo en 2 semanas — 3 iframes + SSO + webhooks. P2 Health/Incident en 1 mes.*
