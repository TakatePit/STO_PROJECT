const logic = require('../../../../logic');
const { query } = require('../../db');
const { AppError } = require('../../../../errors/AppError');
const { asyncRoute, requireAuth, requireRole } = require('../../middleware/auth');

async function recalcOrderTotal(orderId) {
  const result = await query('SELECT COALESCE(SUM(qty * unit_price), 0) AS total FROM order_items WHERE order_id = $1', [orderId]);
  const total = Number(result.rows[0].total || 0);
  await query('UPDATE orders SET total_cost = $1 WHERE id = $2', [total, orderId]);
  return total;
}

function registerOrdersModule(router) {
  router.get('/orders', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (_req, res) => {
    const result = await query(`SELECT o.id, o.vehicle_id, o.status, o.description, o.opened_at, o.closed_at, o.total_cost::float AS total_cost,
      c.full_name AS client_name, c.id AS client_id, v.brand, v.model, v.plate
      FROM orders o
      JOIN vehicles v ON v.id = o.vehicle_id
      JOIN clients c ON c.id = v.client_id
      ORDER BY o.id DESC`);
    const orders = result.rows;
    if (orders.length === 0) {
      res.json([]);
      return;
    }
    const ids = orders.map((o) => o.id);
    const itemsRes = await query(
      `SELECT oi.id, oi.order_id, oi.qty, oi.unit_price::float AS unit_price, s.title AS service_title
       FROM order_items oi JOIN services s ON s.id = oi.service_id WHERE oi.order_id = ANY($1::int[])`,
      [ids],
    );
    const byOrder = new Map();
    for (const row of itemsRes.rows) {
      const lineTotal = Number(row.qty) * Number(row.unit_price);
      const item = {
        id: row.id,
        service_title: row.service_title,
        qty: row.qty,
        unit_price: row.unit_price,
        line_total: lineTotal,
      };
      if (!byOrder.has(row.order_id)) byOrder.set(row.order_id, []);
      byOrder.get(row.order_id).push(item);
    }
    const merged = orders.map((o) => ({ ...o, items: byOrder.get(o.id) || [] }));
    res.json(merged);
  }));

  router.post('/orders', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
    const { vehicle_id, description = '', items = [] } = req.body;
    const orderRes = await query(`INSERT INTO orders (vehicle_id, status, description) VALUES ($1, 'new', $2)
      RETURNING id, vehicle_id, status, description, total_cost::float AS total_cost`, [vehicle_id, description]);
    const order = orderRes.rows[0];

    for (const item of items) {
      const serviceRes = await query('SELECT id, price::float AS price, title FROM services WHERE id = $1 AND is_active = TRUE', [item.service_id]);
      const service = serviceRes.rows[0];
      if (!service) continue;
      await query('INSERT INTO order_items (order_id, service_id, qty, unit_price) VALUES ($1, $2, $3, $4)', [order.id, service.id, Number(item.qty || 1), service.price]);
    }

    const total = await recalcOrderTotal(order.id);
    res.status(201).json({ ...order, total_cost: total });
  }));

  router.post('/orders/:id/items', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
    const { service_id, qty = 1 } = req.body;
    const serviceResult = await query('SELECT id, price::float AS price, title FROM services WHERE id = $1 AND is_active = TRUE', [service_id]);
    const service = serviceResult.rows[0];
    if (!service) throw new AppError('CF_NOT_FOUND', 404, 'SERVICE_NOT_FOUND', { fallbackMessage: 'Послугу не знайдено' });

    await query('INSERT INTO order_items (order_id, service_id, qty, unit_price) VALUES ($1, $2, $3, $4)', [req.params.id, service.id, qty, service.price]);
    const total = await recalcOrderTotal(req.params.id);
    res.status(201).json({ order_id: Number(req.params.id), total_cost: total });
  }));

  router.patch('/orders/:id', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
    const { status } = req.body;
    const closedAt = status === 'done' ? new Date().toISOString() : null;
    const result = await query(`UPDATE orders SET status = COALESCE($1, status), closed_at = COALESCE($2, closed_at)
      WHERE id = $3 RETURNING id, status, total_cost::float AS total_cost`, [status || null, closedAt, req.params.id]);
    if (!result.rows[0]) throw new AppError('CF_NOT_FOUND', 404, 'ORDER_NOT_FOUND', { fallbackMessage: 'Замовлення не знайдено' });
    res.json(result.rows[0]);
  }));

  router.delete('/orders/:id', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
    const result = await query('DELETE FROM orders WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) throw new AppError('CF_NOT_FOUND', 404, 'ORDER_NOT_FOUND', { fallbackMessage: 'Замовлення не знайдено' });
    res.json({ success: true });
  }));

  router.get('/orders/:id/invoice', requireAuth, asyncRoute(async (req, res) => {
    const result = await query(`SELECT o.total_cost::float AS total_cost, u.role, u.client_id, v.client_id AS order_client_id FROM orders o
      JOIN vehicles v ON v.id = o.vehicle_id LEFT JOIN users u ON u.id = $2 WHERE o.id = $1`, [req.params.id, req.user.userId]);
    const row = result.rows[0];
    if (!row) throw new AppError('CF_NOT_FOUND', 404, 'ORDER_NOT_FOUND', { fallbackMessage: 'Замовлення не знайдено' });
    if (row.role !== 'admin' && row.role !== 'manager' && Number(row.client_id) !== Number(row.order_client_id)) {
      throw new AppError('CF_FORBIDDEN', 403, 'FORBIDDEN', { fallbackMessage: 'Немає доступу до рахунку' });
    }
    res.json(logic.calculateInvoice(Number(row.total_cost)));
  }));

  router.delete('/orders/:id/items/:itemId', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
    await query('DELETE FROM order_items WHERE id = $1 AND order_id = $2', [req.params.itemId, req.params.id]);
    const total = await recalcOrderTotal(req.params.id);
    res.json({ ok: true, total_cost: total });
  }));

  router.get('/client/orders', requireAuth, requireRole('client'), asyncRoute(async (req, res) => {
    const result = await query(`SELECT o.id, o.status, o.description, o.opened_at, o.closed_at, o.total_cost::float AS total_cost,
      v.brand, v.model, v.plate FROM orders o JOIN vehicles v ON v.id = o.vehicle_id WHERE v.client_id = $1 ORDER BY o.id DESC`, [req.user.clientId]);
    res.json(result.rows);
  }));
}

module.exports = { registerOrdersModule };
