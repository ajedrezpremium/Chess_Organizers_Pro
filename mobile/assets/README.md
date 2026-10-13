# Assets para PWA / App Stores

## Requeridos (generar desde una imagen base 1024x1024)

Ejecuta: `npx expo install expo-asset && npx expo generate:assets`

O manualmente desde https://github.com/expo/expo-cli/tree/main/packages/generate-assets

## Lista de archivos necesarios

| Archivo | Tamaño | Uso |
|---------|--------|-----|
| `icon.png` | 1024x1024 | Base para todo |
| `icon-192.png` | 192x192 | PWA manifest |
| `icon-512.png` | 512x512 | PWA manifest + splash |
| `adaptive-icon.png` | 1024x1024 | Android adaptive icon (foreground) |
| `splash.png` | 2732x2732 | iOS/Android splash screen |
| `favicon.png` | 48x48 | Web favicon |

## Generación rápida (una vez tengas icon.png 1024x1024)

```bash
cd mobile
npx expo install expo-asset
npx expo generate:assets
```

Esto crea automáticamente todos los tamaños en `assets/`.

## Placeholder temporal

Mientras no tengas el diseño final, usa cualquier imagen 1024x1024 como `icon.png` y ejecuta el comando arriba.