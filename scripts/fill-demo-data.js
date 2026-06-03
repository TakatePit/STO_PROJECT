/* eslint-disable no-console */
/**
 * Заповнює працюючий API демо-даними: клієнти, авто, замовлення.
 * Потрібен запущений сервер (наприклад, npm run dev).
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
  if (!res.ok) {
    throw new Error(`${res.status} ${path}: ${body.error || body.message || 'Request failed'}`);
  }
  return body;
}

async function main() {
  const auth = await call('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const token = auth.token;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const services = await call('/services', { headers });
  if (!Array.isArray(services) || services.length < 2) {
    throw new Error('Недостатньо послуг у довіднику для створення замовлень.');
  }

  const stamp = Date.now().toString().slice(-6);
  const dataset = [
    {
      full_name: 'Ігор Кравченко',
      phone: `+38067${stamp}01`,
      notes: 'Регулярне ТО',
      vehicle: { brand: 'Skoda', model: 'Octavia', vin: `VINDEMO${stamp}A001`, plate: `AA${stamp.slice(0, 2)}1IK`, year: 2018 },
      order: { status: 'new', description: 'Планове ТО, заміна масла', lines: [{ idx: 0, qty: 1 }, { idx: 2, qty: 1 }] },
    },
    {
      full_name: 'Олена Мартиненко',
      phone: `+38050${stamp}02`,
      notes: 'Сторонній шум у гальмах',
      vehicle: { brand: 'Mazda', model: '6', vin: `VINDEMO${stamp}A002`, plate: `KA${stamp.slice(0, 2)}2OM`, year: 2016 },
      order: { status: 'in_progress', description: 'Діагностика та ремонт гальм', lines: [{ idx: 1, qty: 1 }, { idx: 3, qty: 1 }] },
    },
    {
      full_name: 'Сергій Бондар',
      phone: `+38093${stamp}03`,
      notes: 'Підготовка до продажу авто',
      vehicle: { brand: 'Volkswagen', model: 'Passat', vin: `VINDEMO${stamp}A003`, plate: `BC${stamp.slice(0, 2)}3SB`, year: 2019 },
      order: { status: 'done', description: 'Комплексна діагностика', lines: [{ idx: 1, qty: 1 }] },
    },
  ];

  for (const row of dataset) {
    const client = await call('/clients', {
      method: 'POST',
      headers,
      body: JSON.stringify({ full_name: row.full_name, phone: row.phone, notes: row.notes }),
    });

    const vehicle = await call('/vehicles', {
      method: 'POST',
      headers,
      body: JSON.stringify({ client_id: client.id, ...row.vehicle }),
    });

    const order = await call('/orders', {
      method: 'POST',
      headers,
      body: JSON.stringify({ vehicle_id: vehicle.id, description: row.order.description }),
    });

    for (const line of row.order.lines) {
      const service = services[line.idx] || services[0];
      await call(`/orders/${order.id}/items`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ service_id: service.id, qty: line.qty }),
      });
    }

    if (row.order.status !== 'new') {
      await call(`/orders/${order.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: row.order.status }),
      });
    }
  }

  console.log('Демо-дані успішно додані: 3 клієнти, 3 авто, 3 замовлення.');
}

main().catch((err) => {
  console.error('Помилка наповнення демо-даними:', err.message);
  process.exit(1);
});
