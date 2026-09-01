# ♟️ ARBITER CONTROL CENTER v1.1 — ChessOrganizers Pro
### Centro de Control Profesional para Árbitros · Producto independiente

**Lema:** ARBITRATE SMARTER. *Control every game. Decide with confidence.*
**Filosofía:** CONTROL · ALERT · DECISION · ACTION  |  SEE → DECIDE → ACT → RECORD
**Objetivo:** dirigir un torneo completo desde una única pantalla en 5 segundos.

---

## 1. Arquitectura General (integrada)

```
┌──────────────────────────────────────────────────────────────┐
│ CHESSORGANIZERS · ARBITER CONTROL CENTER  [v1.1]            │
│ TORNEO: XG PREMIUM OPEN 2026  · FIDE Rated · Swiss · 9R  🟢 EN CURSO  R5/9  10:24:31 │
├──────────────┬───────────────────────────────────────────────┤
│  🏠 DASHBOARD│        CONTROL CENTRAL (KPIs + Health + Alertas + Ronda)   │
│  🏆 TOURNAMENT│                                             │
│  👥 PLAYERS  │   Estado 94/100 ██████████████████░░ + Desglose          │
│  🔄 PAIRINGS │   🔴1 · 🟠3 · 🟢1 | Mesa37 pendiente [VER]                │
│  ♟️ ROUNDS   │   R5: 74 activas ·15 fin ·3 pend ·83% ████████░░ 42:18 │
│  🪑 TABLES   │   ┌─ Tabla Mesas ─┬─ Quick Actions ─┐                   │
│  📝 RESULTS  │   │ #1 García-López 38:21 🟢 │ + Incidencia │                   │
│  📊 STANDINGS│   │ #18 Sánchez 00:00 🔴     │ Generar      │                   │
│  🚨 INCIDENTS│   └───────────────┴──────────────┘                   │
│  ⚖️ APPEALS  │   [Ficha Jugador: historial + arbitral]               │
│  📖 RULEBOOK │   [AI Copilot: regla + acción + certeza]              │
│  📢 COMM     │                                               │
│  📄 REPORTS  │                                               │
│  ⚙️ SETTINGS │                                               │
├──────────────┴───────────────────────────────────────────────┤
│ 🟢 Sistema OK | 🔄 10:24:31 | Usuario · Offline First PWA     │
└──────────────────────────────────────────────────────────────┘
```

**Integración estratégica:** Producto independiente pero conectado a ChessOrganizers Pro vía sync `chessorganizers.com/api/sync` (upload técnico) y dataset compartido (players, rounds, pairings via Supabase). Header global ya con iconos Calendario/Enlaces TOP100/Newsletter.

---

## 2. Dashboard — 5 segundos, 7 preguntas

1. ¿Ronda? → `R5/9`  2. ¿Activas? → `74`  3. ¿Terminadas? → `15`  4. ¿Problemas? → `🚨2`  5. ¿Dónde? → `Mesa37, 52, 18`  6. ¿Qué hacer? → `Ver mesa / Verificar / Publicar`  7. ¿Bajo control? → `Health 94`

KPIs clicables: cada KPI abre su detalle (ej: Incidencias → INC-024).

---

## 3. KPI Bar (8) — Implementado en Center v1.1

| KPI | Valor | Click → |
|-----|-------|---------|
| Jugadores | 184 | Players |
| Mesas | 92 | Tables |
| Activas | 74 | Ronda filtrada Activas |
| Finalizadas | 15 | Ronda filtrada Fin |
| Pendientes | 3 | Validación |
| Incidencias | 2 | Incident Center |
| Alertas | 4 | Alert Center |
| Líder | GM García 4.5 | Standings |

Tech: `ArbiterControlCenter.jsx` KPIs con color zinc/emerald/amber/sky/red.

---

## 4. Tournament Health Score 94/100

Barra + desglose: Emparejamientos 100% · Resultados 97% · Mesas 98% · Relojes 95% · Incidencias 90% · Retrasos 92%. Cálculo: `100 - critical*15 - attention*5 - pending*1`. Interpretación: >85 BAJO CONTROL, >60 ATENCIÓN, ≤60 CRÍTICO. Color dinámico.

---

## 5. Alert Center — Prioridades

🔴 CRÍTICO: resultado imposible, mesa sin reloj, ausente jugando, doble asignación, conflicto emparejamiento, pendiente bloquea ronda. 🟠 ATENCIÓN: tarde, sin resultado, reloj detenido, reclamo, disciplinaria. 🟢 INFORMATIVO: ronda terminada, emparejamientos generados, sync ok. Filtros all/critical/attention/info.

---

## 6. Round Control — Núcleo operativo

Tabla: Mesa | Blancas | Negras | Reloj | Resultado | Estado (🟢🔵🔴⚠️) | Acciones (✏️ 🚫 📢). Funciones: buscar jugador/mesa, control relojes, modificar resultado, registrar incidencia, anuncio, actualizar, imprimir, móvil/tablet. Filtros: Todas/Activas/Finalizadas/Problemas/Retrasadas. Tiempo ronda + progreso 83%.

---

## 7. Flujo de Ronda — Con validaciones que impiden errores

`PREPARAR → VALIDAR → GENERAR → REVISAR → PUBLICAR → INICIAR → MONITORIZAR → RECIBIR → VALIDAR → CERRAR → SIGUIENTE`  — Si `pending>0`, bloquear cierre con `[VER RESULTADOS]`.

---

## 8. Pairing Control — Validación automática antes de publicar

Checklist: nº jugadores, grupos puntuación, rivales repetidos, colores, byes, exentos, ausentes, restricciones, excepciones → 🟢 PAIRING VALID 92 mesas · 0 errores · 2 advertencias — Botones Generar/Validar/Publicar.

---

## 9. Player Profile — Ficha + Historial Arbitral

FIDE ID, Elo, título, fed, club, puntos, ranking ini/actual, performance | Historial rondas (rival, color, resultado) | Arbitral: ausencias, byes, penals, incidencias, reclamaciones. Especial: historial arbitral R2 tarde, R4 reclamación.

---

## 10. Incident Center (CRM arbitral) + Appeals separados

Incident: ID INC-024, Ronda, Mesa, Jugador, Tipo (Reloj/Resultado/Conducta/Tiempo/Emparejamiento/Reclamación/Otro), Prioridad Alta, Estado ABIERTA→ASIGNADA→EN INVESTIGACIÓN→RESUELTA→CERRADA, qué ocurrió + decisión + cuándo + quién. Appeals: tabla ID/Mesa/Jugador/Motivo/Estado con expediente.

---

## 11. Rulebook + AI Copilot — Diferencial

Caja "¿Qué problema tienes?" → Respuesta con Situación, Regla aplicable (FIDE Laws 2023 + bases torneo), Acción recomendada, Certeza, ⚠️ Decisión final: Árbitro — Botones VER REGLA / REGISTRAR INCIDENCIA / APLICAR DECISIÓN. Fix TEST01: "conoces las leyes?" → Sí, experto + artículos 1-12.

---

## 12. Table Control, Results (Auto Validation), Live Standings, Communications, Reports

- Table visual grid 01🟢 02🟢 06🔴 con detalle mesa/reloj/estado.
- Results: 🟢 Confirmado / 🟠 Pendiente / 🔴 Inconsistente + auto-detect duplicado/imposible/sin resultado/modificado/fuera secuencia.
- Standings LIVE con filtros grupo/categoría/fed/club/sexo/edad/título/Elo y provisionals.
- Communications: Publicar Emparejamientos/Resultados/Clasif/Próxima/Avisos en Web/App/Pantallas/QR/Telegram/WhatsApp/Redes.
- Reports: GENERATE FINAL REPORT con participantes, rondas, desempates, incidencias, penalizaciones, manuales, arbitrajes, exports FIDE.

---

## 13. Menú definitivo (12 módulos)

```
🏠 DASHBOARD
🏆 TOURNAMENT · 👥 PLAYERS · 🔄 PAIRINGS · ♟️ ROUNDS · 🪑 TABLES · 📝 RESULTS · 📊 STANDINGS
🚨 INCIDENTS · ⚖️ APPEALS · 📖 RULEBOOK+AI
📢 COMMUNICATIONS · 📄 REPORTS · ⚙️ SETTINGS
```

---

## 14. MVP Demo V1 (7 funcionalidades) — Estado actual

1. Dashboard KPIs+Health+Alertas ✅ (ArbiterControlCenter)
2. Ronda Mesas+estados ✅ (ArbiterPanel grid + ControlCenter table)
3. Jugadores búsqueda+ficha ✅ (PlayersTab + ControlCenter)
4. Emparejamientos generar+validar+publicar ✅ (PairingIntelligence + validation)
5. Resultados introducción+validación ✅ (Quick-Result teclado + auto-validation)
6. Incidencias crear+resolver+historial ✅ (Bitácora + Center)
7. AI Arbiter consulta+recomendación ✅ (ArbiterAssistant + ChatBot fix TEST01)

P2: Health Score, Validación auto, Historial arbitral, partidas retrasadas, checklist ronda — parcial. P3: IA copilot, anomalías, predicción retrasos — siguiente.

---

## 15. Implementación técnica v1.1

- Header: `Layout.jsx` — Calendario (📅→/catalog?year=2026), Enlaces (🔗 dropdown TOP100: FIDE, 2700chess, chessmetrics, chessgames, chess.com, lichess, chess24, ChessBase, USCF, FEDA, 2700women, etc), Newsletter (✉️→chessorganizers.com/newsletter)
- Central: `ArbiterControlCenter.jsx` (KPIs clicables, Health 94/100, Alertas, Round table filtros, Health breakdown, Comunicaciones)
- Arbiter: `ArbiterPanel.jsx` (Grid colores, Quick-Result 1/2/5/0 auto-avance, Incident modal, Alto Contraste/Outdoor, Sync)
- AI: `ChatBot.jsx` + `ArbiterAssistant.jsx` con `chat.fideLawsYes` i18n + fallback sin backend
- Producto independiente: sync `chessorganizers.com/api/sync`, PWA offline-first, mobile-first tablet.

**Próximo paso v1.1:** cerrar P2 (Tournament Health breakdown completo, VALIDAR emparejamientos pre-publicar con 9 checks, ficha jugador arbitral, control retrasadas, checklist ronda) y P3 IA predicción.

---
*Actualizado 2026-08-27 — ChessOrganizers Pro v1.1 / Arbiter Control Center*
