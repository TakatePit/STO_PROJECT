const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const rootDb = require('../../../db');

async function ensureMigrationTable() {
  await rootDb.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      version TEXT NOT NULL UNIQUE,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function runMigrations() {
  await ensureMigrationTable();
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = (await fs.readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort();

  for (const fileName of files) {
    const version = fileName.replace('.sql', '');
    const sql = await fs.readFile(path.join(migrationsDir, fileName), 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    const existing = await rootDb.query('SELECT checksum FROM schema_migrations WHERE version = $1', [version]);

    if (existing.rows.length > 0) {
      continue;
    }

    await rootDb.query('BEGIN');
    try {
      await rootDb.query(sql);
      await rootDb.query(
        'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)',
        [version, checksum],
      );
      await rootDb.query('COMMIT');
    } catch (error) {
      await rootDb.query('ROLLBACK');
      throw error;
    }
  }
}

async function initDb() {
  if (rootDb.isDbInitialized()) {
    return;
  }
  await rootDb.initSchema();
  await runMigrations();
  await rootDb.initData();
  rootDb.setInitialized(true);
}

module.exports = {
  query: rootDb.query,
  closeDb: rootDb.closeDb,
  saveSnapshot: rootDb.saveSnapshot,
  initDb,
  runMigrations,
};
