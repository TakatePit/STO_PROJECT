/**
 * Одночасний запуск REST API (:3000) і Vite (:5173) для роботи повного інтерфейсу ІС.
 * Зупинка: Ctrl+C.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function ensureFrontendDeps() {
  const viteJs = path.join(root, 'frontend', 'node_modules', 'vite', 'bin', 'vite.js');
  if (fs.existsSync(viteJs)) return;
  const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  console.log('[dev] Установлюємо залежності frontend…');
  const r = spawnSync(npmBin, ['install'], {
    cwd: path.join(root, 'frontend'),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

ensureFrontendDeps();

const backendEnv = {
  ...process.env,
  NODE_ENV: 'development',
  USE_IN_MEMORY_DB: process.env.USE_IN_MEMORY_DB ?? 'persist',
  DB_SNAPSHOT_PATH: process.env.DB_SNAPSHOT_PATH,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET ?? 'dev_local_jwt',
  PORT: process.env.PORT ?? '3000',
};

const backend = spawn(process.execPath, ['server.js'], {
  cwd: root,
  env: backendEnv,
  stdio: 'inherit',
});

const viteCli = path.join(root, 'frontend', 'node_modules', 'vite', 'bin', 'vite.js');
const frontend = spawn(process.execPath, [viteCli, 'dev', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
  cwd: path.join(root, 'frontend'),
  env: { ...process.env, NODE_ENV: 'development' },
  stdio: 'inherit',
});

console.log('');
console.log('  ────────────────────────────────────────');
console.log('  CarFlow — режим розробки');
console.log('  API:          http://127.0.0.1:' + String(backendEnv.PORT || '3000'));
console.log('  Інтерфейс:    http://127.0.0.1:5173');
console.log('  Зупинка:      Ctrl+C');
console.log('  ────────────────────────────────────────');
console.log('');

function shutdown(code = 0) {
  try {
    backend.kill('SIGTERM');
  } catch {
    /* ignore */
  }
  try {
    frontend.kill('SIGTERM');
  } catch {
    /* ignore */
  }
  process.exit(code);
}

backend.on('exit', (code, signal) => {
  if (signal === 'SIGTERM' || signal === 'SIGINT') return;
  if (code !== 0 && code !== null) {
    console.error('[dev] API завершився з кодом', code);
    shutdown(code ?? 1);
  }
});

frontend.on('exit', (code, signal) => {
  if (signal === 'SIGTERM' || signal === 'SIGINT') return;
  if (code !== 0 && code !== null) {
    console.error('[dev] Vite завершився з кодом', code);
    shutdown(code ?? 1);
  }
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
