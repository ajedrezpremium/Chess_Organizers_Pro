# Plan v1 — Lanzamiento a Producción

## Fase 5: Pre-lanzamiento

### 5.1 Infraestructura
- [ ] Configurar dominio + DNS
- [ ] Reverse proxy con SSL (nginx + Let's Encrypt / Caddy)
- [ ] CI/CD: GitHub Actions → build → deploy
- [ ] Monitoreo: uptime + logs centralizados

### 5.2 Seguridad
- [ ] Generar JWT_SECRET fuerte (`openssl rand -base64 48`)
- [ ] Configurar HTTPS (certbot / Caddy auto SSL)
- [ ] Rate limiting ajustado por IP (`express-rate-limit`)
- [ ] Validación extra en inputs de rutas públicas

### 5.3 Configuración Producción
- [ ] Configurar SMTP real (SendGrid, Mailgun, o SMTP propio)
- [ ] Configurar PUBLIC_URL con dominio real
- [ ] Obtener FIDE_API_KEY (si se usa importación FIDE)

### 5.4 Datos
- [ ] Backup automático diario (cron + script backup.sh)
- [ ] Probar restauración desde backup
- [ ] Limpiar datos demo antes de producción

### 5.5 Testing
- [ ] Correr suite de tests: `npm test`
- [ ] Test de carga (100+ torneos, 1000+ jugadores)
- [ ] Verificar SSE broadcasting con múltiples clientes

---

## Fase 6: Post-lanzamiento

### 6.1 Features Prioritarias
- [ ] PWA (service worker + offline support)
- [ ] Subida de foto de perfil para jugadores
- [ ] Exportación de certificados (PDF por jugador)
- [ ] Panel de estadísticas globales (admin)
- [ ] Historial de cambios (audit log)

### 6.2 UX/UI
- [ ] Modo claro/oscuro persistente
- [ ] Búsqueda con debounce en todos los campos
- [ ] Notificaciones in-app (toast stack)
- [ ] Drag & drop para pairings manuales

### 6.3 Rendimiento
- [ ] Migrar a PostgreSQL si SQLite escala mal
- [ ] Cache en Redis para consultas frecuentes
- [ ] Paginación en todas las listas (ya implementada en algunas)

### 6.4 Internacionalización
- [ ] Más idiomas (pt, it, ru, zh)
- [ ] Traducciones para email notifications
- [ ] RTL support para árabe

---

## Estado Actual

| Aspecto                | Estado              |
|------------------------|---------------------|
| Docker deploy          | ✅ Listo             |
| Health checks          | ✅ /health, /readiness |
| Datos demo             | ✅ Seed ejecutado    |
| .env configuración     | ✅ Template creado   |
| Backup scripts         | ✅ Locales + Docker  |
| Documentación          | ✅ PRODUCTION.md     |
| SSL/Dominio            | ❌ Pendiente         |
| SMTP real              | ❌ Pendiente         |
| CI/CD                  | ❌ Pendiente         |
| Tests automáticos      | ❌ Por verificar     |
