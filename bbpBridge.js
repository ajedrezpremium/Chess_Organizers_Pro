/**
 * bbpBridge.js
 *
 * Puente entre el motor JavaScript y el binario bbpPairings (C++).
 *
 * bbpPairings es el único engine con endorsement FIDE para el
 * sistema Dutch. Este módulo lo invoca como child process, pasándole
 * el torneo en formato TRF y recogiendo los emparejamientos generados.
 *
 * Interfaz CLI de bbpPairings (idéntica a JaVaFo 1.4):
 *
 *   Emparejar una ronda:
 *     bbpPairings --dutch input.trf -p [output.trf]
 *
 *   Verificar emparejamientos:
 *     bbpPairings --dutch input.trf -c
 *
 *   Generar torneo aleatorio:
 *     bbpPairings --dutch model.trf -g -o output.trf [-s seed]
 *
 * Códigos de salida:
 *   0  — éxito
 *   1  — no existe emparejamiento válido para esta ronda
 *   2  — error inesperado
 *   3  — entrada inválida (TRF mal formado)
 *   4  — torneo demasiado grande (memoria / límite de compilación)
 *   5  — error de acceso a fichero
 *
 * Sin dependencias de React ni Firestore.
 * Usable tanto desde el CLI del checker/RTG como desde usePairings.js.
 */

import { spawn }        from 'child_process';
import { writeFile, readFile, unlink, mkdtemp } from 'fs/promises';
import { join, resolve } from 'path';
import { tmpdir }       from 'os';

// ── Constantes ────────────────────────────────────────────────────────────────

/** Códigos de salida documentados por bbpPairings */
export const BBP_EXIT = {
  SUCCESS:         0,
  NO_VALID_PAIRING: 1,
  UNEXPECTED_ERROR: 2,
  INVALID_INPUT:   3,
  TOO_LARGE:       4,
  FILE_ERROR:      5,
};

const BBP_EXIT_MESSAGES = {
  [BBP_EXIT.NO_VALID_PAIRING]:  'No existe emparejamiento válido para esta ronda.',
  [BBP_EXIT.UNEXPECTED_ERROR]:  'Error inesperado en bbpPairings.',
  [BBP_EXIT.INVALID_INPUT]:     'Archivo TRF inválido o mal formado.',
  [BBP_EXIT.TOO_LARGE]:         'El torneo es demasiado grande para ser procesado.',
  [BBP_EXIT.FILE_ERROR]:        'Error de acceso a fichero en bbpPairings.',
};

/** Timeout máximo en ms para una operación de emparejamiento */
const DEFAULT_TIMEOUT_MS = 30_000;

// ── Resolución del binario ────────────────────────────────────────────────────

/**
 * Devuelve la ruta al binario bbpPairings según el entorno.
 *
 * Orden de búsqueda:
 *   1. Variable de entorno BBP_BINARY_PATH
 *   2. Binario descargado en ./bin/ (incluido en el repo vía postinstall)
 *   3. bbpPairings en el PATH del sistema
 */
export function resolveBinaryPath() {
  if (process.env.BBP_BINARY_PATH) {
    return resolve(process.env.BBP_BINARY_PATH);
  }

  const platform = process.platform;
  const arch     = process.arch;

  // Nombres de binario por plataforma (releases de GitHub)
  const binaryNames = {
    'linux-x64':   'bbpPairings-linux-x64',
    'linux-arm64': 'bbpPairings-linux-arm64',
    'darwin-x64':  'bbpPairings-macos-x64',
    'darwin-arm64':'bbpPairings-macos-arm64',
    'win32-x64':   'bbpPairings-windows-x64.exe',
  };

  const key  = `${platform}-${arch}`;
  const name = binaryNames[key] ?? 'bbpPairings';

  // Intentar ruta local ./bin/ primero
  const localPath = resolve(new URL('.', import.meta.url).pathname, '..', 'bin', name);
  return localPath;
}

// ── Runner principal ──────────────────────────────────────────────────────────

/**
 * Ejecuta bbpPairings con los argumentos dados.
 *
 * @param {string[]} args        — Argumentos CLI para bbpPairings
 * @param {object}   [opts]
 * @param {number}   [opts.timeoutMs]   — Timeout en ms (por defecto 30s)
 * @param {string}   [opts.binaryPath]  — Ruta explícita al binario
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number }>}
 */
export function runBBP(args, opts = {}) {
  const binaryPath = opts.binaryPath ?? resolveBinaryPath();
  const timeoutMs  = opts.timeoutMs  ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const child = spawn(binaryPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new BbpError(
        `bbpPairings tardó más de ${timeoutMs}ms — proceso terminado`,
        BBP_EXIT.UNEXPECTED_ERROR
      ));
    }, timeoutMs);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (err) => {
      clearTimeout(timer);
      if (err.code === 'ENOENT') {
        reject(new BbpError(
          `Binario bbpPairings no encontrado en: ${binaryPath}\n` +
          `Ejecuta: npm run download-bbp  para descargarlo.`,
          BBP_EXIT.FILE_ERROR
        ));
      } else {
        reject(new BbpError(`Error al lanzar bbpPairings: ${err.message}`, BBP_EXIT.UNEXPECTED_ERROR));
      }
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code ?? BBP_EXIT.UNEXPECTED_ERROR });
    });
  });
}

// ── API de alto nivel ─────────────────────────────────────────────────────────

/**
 * Genera los emparejamientos de la siguiente ronda de un torneo.
 *
 * Flujo:
 *   1. Escribe el TRF de entrada en un fichero temporal
 *   2. Invoca bbpPairings --dutch input.trf -p output.trf
 *   3. Lee el TRF de salida (que contiene los nuevos emparejamientos)
 *   4. Limpia los temporales
 *
 * @param {string} inputTrf   — Contenido TRF del torneo hasta la ronda anterior
 * @param {object} [opts]
 * @param {string} [opts.system]     — 'dutch' | 'burstein' (por defecto: 'dutch')
 * @param {number} [opts.timeoutMs]
 * @param {string} [opts.binaryPath]
 * @returns {Promise<{ outputTrf: string, warnings: string[] }>}
 */
export async function generatePairings(inputTrf, opts = {}) {
  const system = opts.system ?? 'dutch';
  const tmpDir = await mkdtemp(join(tmpdir(), 'co-bbp-'));
  const inputPath  = join(tmpDir, 'input.trf');
  const outputPath = join(tmpDir, 'output.trf');

  try {
    await writeFile(inputPath, inputTrf, 'utf-8');

    const { stdout, stderr, exitCode } = await runBBP(
      [`--${system}`, inputPath, '-p', outputPath],
      opts
    );

    if (exitCode !== BBP_EXIT.SUCCESS) {
      throw new BbpError(
        BBP_EXIT_MESSAGES[exitCode] ?? `bbpPairings falló con código ${exitCode}`,
        exitCode,
        stderr
      );
    }

    const outputTrf = await readFile(outputPath, 'utf-8');
    const warnings  = parseWarnings(stderr);

    return { outputTrf, warnings };

  } finally {
    await cleanupTemp([inputPath, outputPath]);
  }
}

/**
 * Verifica los emparejamientos de un TRF completo.
 * Equivale a ejecutar el Free Pairings Checker (FPC) con bbpPairings.
 *
 * @param {string} trf            — TRF completo (todas las rondas)
 * @param {object} [opts]
 * @param {string} [opts.system]  — 'dutch' | 'burstein'
 * @returns {Promise<{ ok: boolean, discrepancies: string[], warnings: string[] }>}
 */
export async function checkPairings(trf, opts = {}) {
  const system = opts.system ?? 'dutch';
  const tmpDir = await mkdtemp(join(tmpdir(), 'co-bbp-check-'));
  const inputPath = join(tmpDir, 'input.trf');

  try {
    await writeFile(inputPath, trf, 'utf-8');

    const { stdout, stderr, exitCode } = await runBBP(
      [`--${system}`, inputPath, '-c'],
      opts
    );

    // Exit 0 = sin discrepancias; exit 1 = discrepancias encontradas (no es error)
    if (exitCode !== BBP_EXIT.SUCCESS && exitCode !== BBP_EXIT.NO_VALID_PAIRING) {
      throw new BbpError(
        BBP_EXIT_MESSAGES[exitCode] ?? `bbpPairings falló con código ${exitCode}`,
        exitCode,
        stderr
      );
    }

    const discrepancies = parseDiscrepancies(stdout);
    const warnings      = parseWarnings(stderr);

    return {
      ok: exitCode === BBP_EXIT.SUCCESS && discrepancies.length === 0,
      discrepancies,
      warnings,
    };

  } finally {
    await cleanupTemp([inputPath]);
  }
}

/**
 * Genera un torneo aleatorio usando el RTG integrado de bbpPairings.
 *
 * @param {object} opts
 * @param {string} [opts.modelTrf]    — TRF modelo (estructura del torneo sin jugadores)
 * @param {number} [opts.seed]        — Semilla aleatoria
 * @param {string} [opts.system]      — 'dutch' | 'burstein'
 * @param {string} [opts.configPath]  — Ruta a un fichero de configuración RTG
 * @returns {Promise<{ trf: string, seed: number }>}
 */
export async function generateRandomTournament(opts = {}) {
  const system = opts.system ?? 'dutch';
  const tmpDir = await mkdtemp(join(tmpdir(), 'co-bbp-rtg-'));
  const outputPath = join(tmpDir, 'output.trf');

  const args = [`--${system}`];

  let modelPath = null;
  if (opts.modelTrf) {
    modelPath = join(tmpDir, 'model.trf');
    await writeFile(modelPath, opts.modelTrf, 'utf-8');
    args.push(modelPath, '-g');
  } else if (opts.configPath) {
    args.push('-g', opts.configPath);
  } else {
    args.push('-g');
  }

  args.push('-o', outputPath);

  if (opts.seed != null) {
    args.push('-s', String(opts.seed));
  }

  try {
    const { stdout, stderr, exitCode } = await runBBP(args, opts);

    if (exitCode !== BBP_EXIT.SUCCESS) {
      throw new BbpError(
        BBP_EXIT_MESSAGES[exitCode] ?? `bbpPairings RTG falló con código ${exitCode}`,
        exitCode,
        stderr
      );
    }

    const trf  = await readFile(outputPath, 'utf-8');
    // bbpPairings escribe la semilla usada en la primera línea del TRF
    const seed = parseSeedFromTrf(trf) ?? opts.seed ?? 0;

    return { trf, seed };

  } finally {
    const paths = [outputPath];
    if (modelPath) paths.push(modelPath);
    await cleanupTemp(paths);
  }
}

// ── Utilidades privadas ───────────────────────────────────────────────────────

function parseWarnings(stderr) {
  if (!stderr) return [];
  return stderr
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('Error'));
}

function parseDiscrepancies(stdout) {
  if (!stdout) return [];
  // bbpPairings imprime discrepancias como líneas que empiezan por "Round"
  return stdout
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
}

function parseSeedFromTrf(trf) {
  const match = trf.match(/^#\s*seed[:\s]+(\d+)/im);
  return match ? parseInt(match[1], 10) : null;
}

async function cleanupTemp(paths) {
  await Promise.allSettled(paths.map((p) => unlink(p).catch(() => {})));
}

// ── Error tipado ──────────────────────────────────────────────────────────────

export class BbpError extends Error {
  /**
   * @param {string} message
   * @param {number} exitCode   — Uno de BBP_EXIT.*
   * @param {string} [stderr]   — Salida de error del proceso
   */
  constructor(message, exitCode, stderr = '') {
    super(message);
    this.name     = 'BbpError';
    this.exitCode = exitCode;
    this.stderr   = stderr;
  }
}
