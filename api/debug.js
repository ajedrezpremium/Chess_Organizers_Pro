import { readdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default function handler(req, res) {
  const cwd = process.cwd();
  const rootFiles = readdirSync(cwd).slice(0, 15);
  const hasServer = existsSync(resolve(cwd, 'server'));
  const hasIndex = existsSync(resolve(__dirname, '..', 'server', 'src', 'index.js'));
  res.json({
    cwd,
    __dirname,
    rootFiles,
    hasServer,
    hasIndex,
  });
}
