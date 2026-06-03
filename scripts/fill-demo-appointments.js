/* eslint-disable no-console */
/**
 * Добавляет несколько демо онлайн-записей в работающий API.
 * Требует запущенный сервер (npm run dev / npm start).
 */
const API_URL = process.env.API_URL || 'http://127.0.0.1:3000/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sto.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';

/**
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
async function call(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${path}: ${body.error || body.message || 'Request failed'}`);
  return body;
}

/**
 * @param {Date} base
 * @param {number} plusDays
 * @param {number} hour
 * @returns {{starts_at: string, ends_at: string}}
 */
function slot(base, plusDays, hour) {
  const start = new Date(base);
  start.setDate(start.getDate() + plusDays);
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return { starts_at: start.toISOString(), ends_at: end.toISOString() };
}

async function main() {
  const auth = await call('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${auth.token}`,
  };

  const clients = await call('/clients', { headers });
  const vehicles = await call('/vehicles', { headers });
  if (!Array.isArray(clients) || clients.length === 0) throw new Error('Нет клиентов для создания записей');

  const now = new Date();
  const plans = [
    { day: 1, hour: 10, comment: 'Планова діагностика ходової', status: 'confirmed' },
    { day: 1, hour: 14, comment: 'Заміна масла та фільтра', status: 'pending' },
    { day: 2, hour: 11, comment: 'Перевірка гальмівної системи', status: 'confirmed' },
    { day: 3, hour: 9, comment: 'Комп’ютерна діагностика', status: 'pending' },
    { day: 4, hour: 15, comment: 'Огляд перед далекою поїздкою', status: 'pending' },
    { day: 5, hour: 13, comment: 'Контрольний візит після ремонту', status: 'confirmed' },
  ];

  let created = 0;
  for (let i = 0; i < plans.length; i += 1) {
    const client = clients[i % clients.length];
    const vehicle = vehicles.find((v) => v.client_id === client.id) || null;
    const times = slot(now, plans[i].day, plans[i].hour);
    await call('/appointments', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        client_id: client.id,
        vehicle_id: vehicle ? vehicle.id : null,
        starts_at: times.starts_at,
        ends_at: times.ends_at,
        comment: plans[i].comment,
        status: plans[i].status,
      }),
    });
    created += 1;
  }

  console.log(`Демо-записей добавлено: ${created}`);
}

main().catch((err) => {
  console.error('Ошибка добавления онлайн-записей:', err.message);
  process.exit(1);
});
