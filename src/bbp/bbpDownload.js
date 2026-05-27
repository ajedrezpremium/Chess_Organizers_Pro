#!/usr/bin/env node
/**
 * bbpDownload.js — Descarga el binario bbpPairings correcto para la plataforma actual.
 *
 * Se ejecuta automáticamente como postinstall de npm, o manualmente:
 *   node src/bbp/bbpDownload.js
 *   node src/bbp/bbpDownload.js --version 6.0.0
 *   node src/bbp/bbpDownload.js --check   (solo verifica si el binario existe y funciona)
 *
 * Descarga desde:
 *   https://github.com/BieremaBoyzProgramming/bbpPairings/releases/
 *
 * El binario se guarda en ./bin/ y se marca como ejecutable en Unix.
 */

import { createWriteStream, existsSync, chmodSync, mkdirSync } from 'fs';
import { get  }   from 'https';
import { join, resolve } from 'path';
import { pipeline }     from 'stream/promises';
import { runBBP, BBP_EXIT } from './bbpBridge.js';

// ── Configuración ─────────────────────────────────────────────────────────────

const DEFAULT_VERSION = '6.0.0';
const GITHUB_RELEASES = 'https://github.com/BieremaBoyzProgramming/bbpPairings/releases/download';

/**
 * Mapa plataforma → nombre del asset en la release de GitHub.
 * Actualizar cuando salga v7.x si cambian los nombres de asset.
 */
const PLATFORM_ASSETS = {
  'linux-x64':    { asset: 'bbpPairings',         chmod: true  },
  'linux-arm64':  { asset: 'bbpPairings',         chmod: true  },
  'darwin-x64':   { asset: 'bbpPairings',         chmod: true  },
  'darwin-arm64': { asset: 'bbpPairings',         chmod: true  },
  'win32-x64':    { asset: 'bbpPairings.exe',     chmod: false },
};

const BIN_DIR = resolve(new URL('.', import.meta.url).pathname, '..', '..', 'bin');

// ── Lógica de descarga ────────────────────────────────────────────────────────

function getAssetUrl(version, assetName) {
  return `${GITHUB_RELEASES}/v${version}/${assetName}`;
}

function localBinaryName(platform, arch) {
  const isWin = platform === 'win32';
  return isWin ? `bbpPairings-${platform}-${arch}.exe` : `bbpPairings-${platform}-${arch}`;
}

/**
 * Descarga un archivo via HTTPS siguiendo redirecciones.
 */
function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destPath);

    function request(currentUrl) {
      get(currentUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.destroy();
          request(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          file.destroy();
          reject(new Error(`HTTP ${res.statusCode} descargando ${currentUrl}`));
          return;
        }
        pipeline(res, file).then(resolve).catch(reject);
      }).on('error', reject);
    }

    request(url);
  });
}

/**
 * Verifica que el binario descargado responde correctamente.
 * bbpPairings sin argumentos imprime la versión y sale con código 0.
 */
async function verifyBinary(binaryPath) {
  try {
    const { exitCode, stderr } = await runBBP([], { binaryPath, timeoutMs: 5000 });
    // bbpPairings sin args sale con código 0 e imprime uso
    return exitCode === BBP_EXIT.SUCCESS || stderr.includes('bbpPairings') || exitCode === 3;
  } catch {
    return false;
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main() {
  const args    = process.argv.slice(2);
  const version = args.includes('--version')
    ? args[args.indexOf('--version') + 1]
    : DEFAULT_VERSION;
  const checkOnly = args.includes('--check');

  const platform = process.platform;
  const arch     = process.arch;
  const key      = `${platform}-${arch}`;
  const config   = PLATFORM_ASSETS[key];

  if (!config) {
    console.error(`⚠ Plataforma no soportada: ${key}`);
    console.error('  Descarga bbpPairings manualmente desde:');
    console.error('  https://github.com/BieremaBoyzProgramming/bbpPairings/releases');
    console.error(`  y colócalo en ./bin/ con el nombre: bbpPairings`);
    console.error(`  O define la variable de entorno BBP_BINARY_PATH.`);
    process.exit(1);
  }

  const destName = localBinaryName(platform, arch);
  const destPath = join(BIN_DIR, destName);

  // ── Modo verificación ────────────────────────────────────────────
  if (checkOnly) {
    if (!existsSync(destPath)) {
      console.log(`✗ Binario no encontrado: ${destPath}`);
      console.log('  Ejecuta: npm run download-bbp');
      process.exit(1);
    }
    const ok = await verifyBinary(destPath);
    if (ok) {
      console.log(`✓ bbpPairings operativo: ${destPath}`);
      process.exit(0);
    } else {
      console.log(`✗ bbpPairings encontrado pero no responde: ${destPath}`);
      process.exit(1);
    }
  }

  // ── Descarga ─────────────────────────────────────────────────────
  if (existsSync(destPath)) {
    console.log(`✓ bbpPairings ya descargado: ${destPath}`);
    process.exit(0);
  }

  mkdirSync(BIN_DIR, { recursive: true });

  const url = getAssetUrl(version, config.asset);
  console.log(`Descargando bbpPairings v${version} para ${key}...`);
  console.log(`  Desde: ${url}`);
  console.log(`  Hacia: ${destPath}`);

  try {
    await download(url, destPath);

    if (config.chmod) {
      chmodSync(destPath, 0o755);
    }

    const ok = await verifyBinary(destPath);
    if (ok) {
      console.log(`✓ bbpPairings v${version} instalado correctamente.`);
    } else {
      console.warn(`⚠ Descargado pero la verificación falló. Comprueba el binario manualmente.`);
    }
  } catch (err) {
    console.error(`✗ Error descargando bbpPairings: ${err.message}`);
    console.error('  Descarga manual desde:');
    console.error('  https://github.com/BieremaBoyzProgramming/bbpPairings/releases');
    process.exit(1);
  }
}

main();
