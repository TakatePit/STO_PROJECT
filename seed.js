require('dotenv').config();

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { initDb, query, closeDb, saveSnapshot } = require('./backend/src/db');

const snapshotPath = path.join(
  __dirname,
  process.env.DB_SNAPSHOT_PATH || 'data/sto-snapshot.json',
);

/**
 * Очищає ключові таблиці та заповнює демо-клієнта, авто, наряд, запис і послуги (лише dev/demo).
 * @returns {Promise<void>}
 */
async function runSeed() {
  if (fs.existsSync(snapshotPath)) {
    fs.unlinkSync(snapshotPath);
  }
  await initDb();

  await query('DELETE FROM notifications');
  await query('DELETE FROM payments');
  await query('DELETE FROM invoices');
  await query('DELETE FROM documents');
  await query('DELETE FROM stock_movements');
  await query('DELETE FROM parts');
  await query('DELETE FROM suppliers');
  await query('DELETE FROM appointments');
  await query('DELETE FROM order_items');
  await query('DELETE FROM orders');
  await query('DELETE FROM vehicles');
  await query('DELETE FROM users WHERE role = $1', ['client']);
  await query('DELETE FROM clients');
  await query('DELETE FROM services');

  const serviceRows = await Promise.all(
    [
      ['Заміна масла', 800, 'work'],
      ['Діагностика ходової', 400, 'work'],
      ['Фільтр масляний', 350, 'part'],
      ['Гальмівні колодки', 1200, 'part'],
    ].map(([title, price, type]) =>
      query(
        `INSERT INTO services (title, price, type, is_active)
         VALUES ($1, $2, $3, TRUE)
         RETURNING id, title, price::float AS price`,
        [title, price, type],
      ),
    ),
  );

  const clientRes = await query('INSERT INTO clients (full_name, phone, notes) VALUES ($1, $2, $3) RETURNING id', ['Олександр Шевченко', '+380671112233', 'VIP клієнт']);
  const clientId = clientRes.rows[0].id;

  const userPassword = await bcrypt.hash('Client123!', 10);
  await query(`INSERT INTO users (email, password_hash, role, client_id) VALUES ($1, $2, 'client', $3)`, ['client@sto.local', userPassword, clientId]);

  const vehicleRes = await query(
    `INSERT INTO vehicles (client_id, brand, model, vin, plate, year)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [clientId, 'Toyota', 'Camry', 'VIN1234567890ABCDE', 'AA1234BB', 2020],
  );
  const vehicleId = vehicleRes.rows[0].id;

  const orderRes = await query(`INSERT INTO orders (vehicle_id, status, description) VALUES ($1, 'in_progress', $2) RETURNING id`, [vehicleId, 'Стукіт у підвісці, заміна масла']);
  const orderId = orderRes.rows[0].id;

  await query(`INSERT INTO order_items (order_id, service_id, qty, unit_price) VALUES ($1, $2, $3, $4)`, [orderId, serviceRows[0].rows[0].id, 1, serviceRows[0].rows[0].price]);
  await query(`INSERT INTO order_items (order_id, service_id, qty, unit_price) VALUES ($1, $2, $3, $4)`, [orderId, serviceRows[1].rows[0].id, 1, serviceRows[1].rows[0].price]);

  const sumRes = await query('SELECT COALESCE(SUM(qty * unit_price), 0)::float AS total FROM order_items WHERE order_id = $1', [orderId]);
  await query('UPDATE orders SET total_cost = $1 WHERE id = $2', [sumRes.rows[0].total, orderId]);

  await query(
    `INSERT INTO appointments (client_id, vehicle_id, starts_at, ends_at, status, comment)
     VALUES ($1, $2, NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 1 hour', 'confirmed', $3)`,
    [clientId, vehicleId, 'Плановий візит'],
  );

  console.log('Product seed completed');
  await closeDb();
}

runSeed().catch(async (e) => {
  console.error('Помилка seed:', e.message);
  await closeDb();
  process.exit(1);
});
