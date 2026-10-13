# PWA Deployment - Guía rápida

## Opción 1: EAS Build Cloud (Recomendado - evita problemas Node 22 local)

```bash
cd mobile
eas login
eas build:configure          # Si no lo has hecho
eas build --platform web --profile production
# Espera a que termine en la nube
eas build:download --platform web --output-dir ./dist
# Sube la carpeta dist/ a Vercel/Netlify
```

## Opción 2: Deploy manual a Vercel (si EAS build falla)

Los assets ya están generados en `mobile/assets/`. Crea esta estructura manualmente:

```
dist/
├── index.html          # HTML principal
├── manifest.json       # PWA manifest
├── sw.js              # Service Worker
├── assets/
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── favicon.png
│   └── splash.png
└── [bundle JS/CSS]
```

### Generar con npx (si arreglas Node):

```bash
# Opción A: Usar nvm para Node 20
nvm install 20
nvm use 20
npx expo export -p web --output-dir dist

# Opción B: Docker
docker run --rm -v ${PWD}:/app -w /app node:20-alpine sh -c "npm install && npx expo export -p web"
```

## Vercel Config (vercel.json ya actualizado)

```json
{
  "rewrites": [
    { "source": "/app/(.*)", "destination": "/mobile-web/$1" }
  ]
}
```

Tu PWA estará en: `https://tudominio.vercel.app/app/`

## Verificar PWA

1. Abre en Chrome → DevTools → Application → Manifest
2. Debe mostrar: name, icons, start_url, display: standalone
3. Lighthouse → PWA audit → 100%

## Iconos generados ✅

```
mobile/assets/
├── icon.png (1024x1024)
├── icon-192.png (192x192) ✅ PWA
├── icon-512.png (512x512) ✅ PWA
├── adaptive-icon.png (1024x1024) ✅ Android
├── splash.png (2732x2732) ✅ Splash
└── favicon.png (48x48) ✅ Web
```