# Chess Organizers Pro — Deployment

## Requisitos

- [Docker](https://docs.docker.com/engine/install/) + Docker Compose v2
- Dominio con DNS apuntando al servidor
- (Opcional) Cuenta SMTP para emails reales

## Quick Start (Desarrollo / Pruebas)

```bash
# 1. Clonar y entrar
git clone <repo> && cd chess-organizers-pro

# 2. Configurar variables de entorno
cp .env.example .env
# Edita JWT_SECRET (obligatorio) y PUBLIC_URL

# 3. Build & run
docker compose up -d --build

# 4. Migrar BD (solo primera vez)
docker compose exec app node server/src/db/schema.js

# 5. Sembrar datos demo (opcional)
docker compose exec app node server/src/seed.js

# 6. Verificar
curl http://localhost:4000/health
```

## Producción (con SSL + Reverse Proxy)

### 1. Preparar el servidor

```bash
# En el servidor:
git clone <repo> && cd chess-organizers-pro
cp .env.example .env
```

### 2. Configurar SSL

```bash
# Opción A: Auto con Let's Encrypt
DOMAIN=chessorganizers.tudominio.com EMAIL=admin@tudominio.com MODE=production ./deploy/ssl-setup.sh

# Opción B: Manual — colocar certificados en ./certs/
mkdir -p certs
# Copia fullchain.pem y privkey.pem a ./certs/
```

### 3. Variables de entorno

| Variable            | Obligatorio | Default                          | Descripción                              |
|---------------------|-------------|----------------------------------|------------------------------------------|
| `JWT_SECRET`        | ✅           | —                                | Clave JWT (generar con `openssl rand -base64 48`) |
| `DOMAIN`            | ✅           | `chessorganizers.example.com`    | Tu dominio para nginx + SSL              |
| `PUBLIC_URL`        | ✅           | —                                | URL pública (`https://tudominio.com`)    |
| `SMTP_HOST`         | ❌           | Ethereal (dev)                   | Servidor SMTP                            |
| `SMTP_PORT`         | ❌           | `587`                            | Puerto SMTP                              |
| `SMTP_USER`         | ❌           | —                                | Usuario SMTP                             |
| `SMTP_PASS`         | ❌           | —                                | Contraseña SMTP                          |
| `FIDE_API_KEY`      | ❌           | —                                | API key FIDE (para submit)               |
| `FIDE_SUBMIT_URL`   | ❌           | —                                | URL de envío FIDE TRF                    |
| `CORS_ORIGIN`       | ❌           | `https://tudominio.com`          | Origen CORS permitido                    |
| `STRIPE_SECRET_KEY` | ❌           | —                                | Stripe Secret Key                       |
| `STRIPE_WEBHOOK_SECRET` | ❌        | —                                | Stripe Webhook Secret                   |
| `STRIPE_PRICE_BASIC`| ❌           | —                                | Stripe Price ID para plan Básico        |
| `STRIPE_PRICE_PRO`  | ❌           | —                                | Stripe Price ID para plan Pro           |
| `TWILIO_ACCOUNT_SID`| ❌           | —                                | Twilio Account SID (WhatsApp/SMS)       |
| `TWILIO_AUTH_TOKEN` | ❌           | —                                | Twilio Auth Token                       |
| `TWILIO_FROM_NUMBER`| ❌           | —                                | Número Twilio (+14155238886)            |

### Nuevas rutas en nginx

Las siguientes rutas API fueron añadidas al proxy inverso:

| Ruta | Propósito |
|------|-----------|
| `/membership/` | Planes y suscripciones |
| `/validation/` | Inteligencia de pairings (violaciones FIDE) |
| `/stripe/` | Pagos Stripe (checkout, portal, webhook) |
| `/api-keys/` | Gestión de API Keys |
| `/webhooks/` | Gestión de webhooks |
| `/api/v1/` | API REST pública |
| `/external/` | Integración chess.com / lichess |
| `/import/` | Importación CSV/TRF |
| `/notifications/` | Centro de notificaciones + Telegram/Twilio |
| `/pairings/` | Pairings individuales (swap, delete) |

### 4. Iniciar

```bash
# Build & start con reverse proxy
docker compose up -d --build

# Verificar
curl https://tudominio.com/health
```

### 5. Migración + Seed

```bash
docker compose exec app node server/src/db/schema.js
docker compose exec app node server/src/seed.js  # opcional
```

## CI/CD (GitHub Actions)

El pipeline `.github/workflows/ci.yml` tiene 5 jobs:

1. **Engine Tests** — Unit tests de pairings (matriz Node 18/20/22)
2. **API Tests** — Tests de endpoints REST
3. **Client Build** — Build de Vite React
4. **Docker Build** — Build de imágenes Docker
5. **Deploy** — Despliegue automático a producción vía SSH (solo en main/master)

### Configurar deploy automático

Se requieren **GitHub Actions secrets y variables**:

| Nombre          | Tipo      | Descripción                          |
|-----------------|-----------|--------------------------------------|
| `DEPLOY_HOST`   | variable  | IP o dominio del servidor            |
| `DEPLOY_USER`   | variable  | Usuario SSH                          |
| `DEPLOY_KEY`    | secret    | Clave privada SSH                    |
| `DOMAIN`        | variable  | Tu dominio                           |
| `PUBLIC_URL`    | variable  | `https://tudominio.com`              |
| `JWT_SECRET`    | secret    | Secreto JWT                          |
| `SMTP_HOST`     | variable  | Servidor SMTP                        |
| `SMTP_USER`     | variable  | Usuario SMTP                         |
| `SMTP_PASS`     | secret    | Contraseña SMTP                      |

> Usa **variables** para valores no sensibles y **secrets** para contraseñas/llaves.

## Acceso

| Rol         | Email                        | Password  |
|-------------|------------------------------|-----------|
| Admin       | admin@chessorganizerspro.com | admin123  |
| Organizador | demo@chessorganizers.com     | demo123   |

## Arquitectura

```
                    ┌──────────────┐
                    │   Dominio    │
                    │  :80 / :443  │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   nginx      │ ← SSL termination + reverse proxy
                    │  (deploy/    │
                    │  nginx.conf) │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   app:4000   │ ← Express API + Static SPA
                    │  (Node.js)   │
                    └──────────────┘
```

## Backup

```bash
# Manual
docker exec chessorganizers-pro-app-1 cat /data/chessorganizers.db > backup-$(date +%Y%m%d).db

# Scripts
.\scripts\backup.ps1           # Windows
./scripts/backup.sh            # Linux

# Docker cp
docker cp chessorganizers-pro-app-1:/data/chessorganizers.db ./backup.db
```

### Backup automático diario (Linux)

```bash
# Añadir a crontab
0 2 * * * cd /opt/chessorganizers && ./scripts/backup.sh
```

## Restore

```bash
docker compose down
docker cp ./backup.db chessorganizers-pro-app-1:/data/chessorganizers.db
docker compose up -d
```

## Monitoreo

```bash
# Logs
docker compose logs -f
docker compose logs -f nginx

# Health check
curl https://tudominio.com/health
watch -n 10 curl -s https://tudominio.com/health

# Estado
docker compose ps
docker compose stats
```

## Tests

```bash
# Todos los tests
npm test

# Solo engine
npm run test:unit

# Solo API
cd server && npm test

# Solo integración (JS backend)
npm run test:js
```

## Comandos Útiles

```bash
# Rebuild sin caché
docker compose build --no-cache

# Shell en contenedor
docker compose exec app sh

# Ver BD
docker compose exec app node -e "const D=require('better-sqlite3')('/data/chessorganizers.db'); console.log(D.pragma('database_list'))"

# Renovar SSL manual
sudo certbot renew
docker compose restart nginx

# Logs nginx
docker compose logs -f nginx
```
