const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

/**
 * Очікує успішний HTTP GET (будь-який статус) — достатньо, щоб порт слухався.
 * @param {string} url
 * @param {number} [timeoutMs]
 * @returns {Promise<void>}
 */
function waitForHttp(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on('error', () => {
          if (Date.now() >= deadline) {
            reject(new Error(`Час очікування минув: ${url}`));
          } else {
            setTimeout(attempt, 400);
          }
        });
    };
    attempt();
  });
}

/**
 * Якщо у `frontend/` ще немає `node_modules`, виконує `npm install` у цьому каталозі (Windows — через shell).
 * @param {string} root корінь репозиторію
 * @returns {void}
 */
function ensureFrontendDeps(root) {
  const frontendRoot = path.join(root, 'frontend');
  const viteJs = path.join(frontendRoot, 'node_modules', 'vite', 'bin', 'vite.js');
  if (fs.existsSync(viteJs)) return;
  const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const r = spawnSync(npmBin, ['install'], {
    cwd: frontendRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0 || !fs.existsSync(path.join(frontendRoot, 'node_modules', 'vite', 'bin', 'vite.js'))) {
    throw new Error('Не встановлено залежності frontend (vite). Виконайте npm install у каталозі frontend.');
  }
}

module.exports = async () => {
  const root = path.resolve(__dirname, '..', '..');
  const backendEnv = {
    ...process.env,
    NODE_ENV: 'development',
    JWT_SECRET: process.env.JWT_SECRET || 'playwright_ui_secret',
    USE_IN_MEMORY_DB: 'true',
    PORT: '3000',
  };

  globalThis.__PW_BACKEND__ = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: backendEnv,
    stdio: 'ignore',
  });

  await waitForHttp('http://127.0.0.1:3000/', 30000);

  ensureFrontendDeps(root);
  const frontendRoot = path.join(root, 'frontend');
  const viteJs = path.join(frontendRoot, 'node_modules', 'vite', 'bin', 'vite.js');

  globalThis.__PW_FRONTEND__ = spawn(process.execPath, [viteJs, 'dev', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
    cwd: frontendRoot,
    env: { ...process.env, NODE_ENV: 'development' },
    stdio: 'ignore',
  });

  await waitForHttp('http://127.0.0.1:5173/', 90000);
};
