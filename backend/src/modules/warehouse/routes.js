const { query } = require('../../db');
const { asyncRoute, requireAuth, requireRole } = require('../../middleware/auth');

function registerWarehouseModule(router) {
  router.get('/warehouse/parts', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (_req, res) => {
    const result = await query('SELECT id, sku, name, stock_qty, purchase_price::float, sale_price::float, supplier_id FROM parts ORDER BY id DESC');
    res.json(result.rows);
  }));

  router.post('/warehouse/parts', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
    const { sku, name, stock_qty = 0, purchase_price = 0, sale_price = 0, supplier_id = null } = req.body;
    const result = await query(
      `INSERT INTO parts (sku, name, stock_qty, purchase_price, sale_price, supplier_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, sku, name, stock_qty, purchase_price::float, sale_price::float, supplier_id`,
      [sku, name, stock_qty, purchase_price, sale_price, supplier_id],
    );
    res.status(201).json(result.rows[0]);
  }));

  router.post('/warehouse/movements', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
    const { part_id, type, qty, reason = '', ref_order_id = null } = req.body;
    await query('INSERT INTO stock_movements (part_id, type, qty, reason, ref_order_id) VALUES ($1, $2, $3, $4, $5)', [part_id, type, qty, reason, ref_order_id]);
    const sign = type === 'in' ? 1 : -1;
    await query('UPDATE parts SET stock_qty = stock_qty + $1 WHERE id = $2', [sign * Number(qty), part_id]);
    res.status(201).json({ ok: true });
  }));
}

module.exports = { registerWarehouseModule };
