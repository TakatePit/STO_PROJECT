/**
 * Завершує дочірні процеси API та Vite після UI-тестів.
 * @returns {Promise<void>}
 */
module.exports = async () => {
  const killQuiet = (proc) => {
    if (!proc || proc.exitCode !== null) return;
    try {
      proc.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  };

  killQuiet(globalThis.__PW_FRONTEND__);
  killQuiet(globalThis.__PW_BACKEND__);

  await new Promise((r) => setTimeout(r, 800));
};
