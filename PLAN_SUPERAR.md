# Plan para superar Chess Manager + Chess Results

## Diagnóstico

| Aspecto                | Chess Manager | Chess Results | Nosotros        |
|------------------------|---------------|---------------|-----------------|
| Web nativo             | ❌ Desktop    | ✅ Web         | ✅ Web + Docker |
| Tiempo real (SSE)      | ❌            | ❌             | ✅              |
| Pairings automáticos   | ✅ Swiss/RR   | ❌ Solo publi  | ✅ Swiss        |
| Round Robin            | ✅            | ❌             | ❌              |
| Publicación resultados | ❌ Manual     | ✅             | ✅              |
| Buscador jugadores     | ✅ Local      | ✅ Global      | ✅ Global       |
| Importación FIDE       | ✅            | ✅             | ✅              |
| Equipos                | ✅            | ❌             | ✅              |
| Modern UI / Dark mode  | ❌ Clásico    | ❌ Clásico     | ✅              |
| Mobile responsive      | ❌            | ❌             | ✅              |
| Open source            | ❌            | ❌             | ✅              |
| Email notifs           | ❌            | ❌             | ✅              |
| Exportación PDF/TRF    | ✅            | ✅             | ✅              |
| Offline / PWA          | ✅ Nativo     | ❌             | ❌              |

## Fase 5 — Pre-lanzamiento (igualar + superar)

### 5.1 Round Robin (Carencia crítica)
- Implementar pairings Round Robin (sistema Berger / tabla circular)
- Soporte para doble round robin

### 5.2 Rating Change Calculator (Killer Feature vs Chess Results)
- Mostrar variación de rating FIDE esperada en vivo
- Basado en fórmula FIDE estándar (K-factor, diferencia de rating)
- Tabla de progresión de rating por ronda

### 5.3 Mejoras Publicación
- Páginas públicas personalizables (logo, colores, nombre del torneo)
- Tabla cruzada en página pública
- Historial de enfrentamientos directos entre jugadores

### 5.4 Live Broadcasting mejorado
- Tablero de pared con búsqueda/filtros
- Cuadro por mesa individual con resultado en vivo
- Integración con DGT board (opcional)

## Fase 6 — Paridad total

### 6.1 PWA / Offline
- Service Worker para caché de torneos
- Pairings offline con sincronización posterior
- Instalable como app en móvil

### 6.2 Herramientas de Árbitro
- App móvil PWA para árbitros (ingresar resultados desde el teléfono)
- Módulo de múltiples árbitros con permisos
- Check-in de jugadores por QR

### 6.3 Automatización
- Subida automática de resultados a FIDE (TRF)
- Generación automática de boletines PDF
- Schedule manager (horarios por ronda)

### 6.4 Catálogo de Torneos Global
- Ranking de torneos por fed/type
- Historial de torneos por organizador
- Widgets embeddables para federaciones

## Fase 7 — Superar

### 7.1 Inteligencia de Pairings
- Motor de pairings con aprendizaje (recomendaciones)
- Detección de errores de pairings (conflictos, violaciones FIDE)
- Sugerencia de aceleración / floor management

### 7.2 Pagos y Comunicación
- Pasarela de pagos (Stripe) para inscripciones
- SMS notifications (Twilio)
- Recordatorios automáticos a jugadores

### 7.3 Ecosistema
- API pública REST para terceros
- Webhooks (slack, discord) para novedades
- Integración con plataformas de ajedrez online (chess.com, lichess)
- Plugins / extensiones

### 7.4 Análisis y Datos
- Estadísticas avanzadas del torneo (performance ratings, colores)
- Dashboard global del organizador (multi-torneo)
- Heat maps de resultados por mesas

---

## Próximo Paso Inmediato (¿por dónde empezamos?)

1. **[#16] Round Robin** — Implementar pairings Round Robin (carencia vs Chess Manager)
2. **[#17] Rating Change Calculator** — Variación de rating FIDE en vivo (killer feature vs Chess Results)
3. **[#18] PWA** — Service Worker + offline mode
4. **[#19] Página pública personalizable** — Logo + colores por torneo
