const { initDb, closeDb } = require('../backend/src/db');

initDb()
  .then(async () => {
    console.log('Migrations completed');
    await closeDb();
  })
  .catch(async (error) => {
    console.error('Migration failed:', error.message);
    await closeDb();
    process.exit(1);
  });
