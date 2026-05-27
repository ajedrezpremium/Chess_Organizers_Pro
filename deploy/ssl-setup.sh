#!/bin/bash
# Chess Organizers Pro — SSL Certificate Setup
# Usage: DOMAIN=chessorganizers.example.com EMAIL=admin@example.com ./deploy/ssl-setup.sh
# Options:
#   DOMAIN  — Required. Your domain name.
#   EMAIL   — Required. For Let's Encrypt notifications.
#   MODE    — "staging" (default, test) or "production" (rate-limited)
#
# This script:
#   1. Installs certbot if missing
#   2. Obtains SSL certs via Let's Encrypt (standalone mode)
#   3. Copies certs to ./certs/ for nginx
#   4. Sets up auto-renewal cron

set -euo pipefail

DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"
MODE="${MODE:-staging}"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "❌ Uso: DOMAIN=tudominio.com EMAIL=admin@ejemplo.com $0"
  echo "   MODE=production para certificados reales (rate-limited)"
  exit 1
fi

CERT_DIR="$(dirname "$0")/../certs"
mkdir -p "$CERT_DIR"

# Check existing cert
if [ -f "$CERT_DIR/fullchain.pem" ] && [ -f "$CERT_DIR/privkey.pem" ]; then
  echo "✅ Certificados ya existen en $CERT_DIR"
  echo "   Para renovar: borra los archivos y ejecuta este script de nuevo"
  exit 0
fi

# Install certbot if needed
if ! command -v certbot &>/dev/null; then
  echo "📦 Instalando certbot..."
  if command -v apt-get &>/dev/null; then
    sudo apt-get update && sudo apt-get install -y certbot
  elif command -v apk &>/dev/null; then
    apk add certbot
  else
    echo "❌ No se pudo instalar certbot. Instálalo manualmente."
    exit 1
  fi
fi

# Stop any service on port 80 (e.g., existing nginx)
echo "🔄 Deteniendo servicios en puerto 80..."
sudo systemctl stop nginx 2>/dev/null || true
sudo systemctl stop caddy 2>/dev/null || true

# Obtain certificate
SERVER_FLAG=""
if [ "$MODE" = "production" ]; then
  echo "🔒 Obteniendo certificado PRODUCCIÓN para $DOMAIN..."
else
  echo "🔒 Obteniendo certificado STAGING para $DOMAIN (--staging)..."
  SERVER_FLAG="--staging"
fi

sudo certbot certonly --standalone \
  $SERVER_FLAG \
  --non-interactive --agree-tos \
  --email "$EMAIL" \
  --domains "$DOMAIN"

CERT_SRC="/etc/letsencrypt/live/$DOMAIN"
if [ -f "$CERT_SRC/fullchain.pem" ]; then
  echo "📁 Copiando certificados a $CERT_DIR..."
  sudo cp "$CERT_SRC/fullchain.pem" "$CERT_DIR/"
  sudo cp "$CERT_SRC/privkey.pem" "$CERT_DIR/"
  sudo chmod 644 "$CERT_DIR/fullchain.pem"
  sudo chmod 600 "$CERT_DIR/privkey.pem"
  echo "✅ Certificados copiados"
else
  echo "❌ No se encontraron certificados en $CERT_SRC"
  exit 1
fi

# Setup auto-renewal cron
RENEW_SCRIPT="0 3 * * * sudo certbot renew --quiet && sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $CERT_DIR/ && sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $CERT_DIR/ && docker compose restart nginx"
(crontab -l 2>/dev/null | grep -v certbot; echo "$RENEW_SCRIPT") | crontab -
echo "✅ Auto-renewal configurado en crontab"

# Restart services
sudo systemctl start nginx 2>/dev/null || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ SSL configurado para $DOMAIN"
echo "   Certs: $CERT_DIR/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
