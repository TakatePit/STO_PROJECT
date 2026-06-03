const { spawnSync } = require('child_process');

const steps = [
  ['node', ['scripts/migrate.js']],
  ['node', ['seed.js']],
  ['node', ['server.js']],
];

for (const [cmd, args] of steps) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: true, env: { ...process.env, NODE_ENV: 'production' } });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
