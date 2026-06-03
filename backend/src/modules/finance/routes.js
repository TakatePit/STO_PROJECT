const logic = require('../../../../logic');
const { query } = require('../../db');
const { asyncRoute, requireAuth, requireRole } = require('../../middleware/auth');

function registerFinanceModule(router) {
  router.get('/finance/invoices', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (_req, res) => {
    const result = await query('SELECT id, order_id, invoice_no, subtotal::float, tax::float, total::float, status, created_at FROM invoices ORDER BY id DESC');
    res.json(result.rows);
  }));

  router.get('/finance/payment-methods', requireAuth, asyncRoute(async (_req, res) => {
    const result = await query('SELECT id, key, title FROM payment_methods ORDER BY id');
    res.json(result.rows);
  }));

  router.post('/finance/invoices', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
    const { order_id, idempotency_key = null } = req.body;
    if (idempotency_key) {
      const existing = await query('SELECT * FROM invoices WHERE idempotency_key = $1', [idempotency_key]);
      if (existing.rows[0]) return res.json(existing.rows[0]);
    }

    const orderRes = await query('SELECT id, total_cost::float AS total_cost FROM orders WHERE id = $1', [order_id]);
    const order = orderRes.rows[0];
    const calc = logic.calculateInvoice(order?.total_cost || 0);
    const invoiceNo = `INV-${Date.now()}-${order_id}`;

    const created = await query(
      `INSERT INTO invoices (order_id, invoice_no, subtotal, tax, total, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, order_id, invoice_no, subtotal::float, tax::float, total::float, status`,
      [order_id, invoiceNo, calc.subtotal, calc.tax, calc.total, idempotency_key],
    );

    await query('INSERT INTO documents (order_id, doc_type, doc_no, body) VALUES ($1, $2, $3, $4::jsonb)', [order_id, 'invoice', invoiceNo, JSON.stringify(calc)]);
    res.status(201).json(created.rows[0]);
  }));

  router.post('/finance/payments', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
    const { invoice_id, payment_method_id, amount, idempotency_key = null } = req.body;
    if (idempotency_key) {
      const existing = await query('SELECT * FROM payments WHERE idempotency_key = $1', [idempotency_key]);
      if (existing.rows[0]) return res.json(existing.rows[0]);
    }

    const created = await query(
      `INSERT INTO payments (invoice_id, payment_method_id, amount, idempotency_key)
       VALUES ($1, $2, $3, $4)
       RETURNING id, invoice_id, payment_method_id, amount::float, paid_at`,
      [invoice_id, payment_method_id, amount, idempotency_key],
    );
    await query('INSERT INTO cashbox (operation, amount, comment) VALUES ($1, $2, $3)', ['income', amount, `Payment for invoice ${invoice_id}`]);
    res.status(201).json(created.rows[0]);
  }));

  router.get('/finance/documents/:orderId', requireAuth, asyncRoute(async (req, res) => {
    const result = await query('SELECT id, order_id, doc_type, doc_no, body, created_at FROM documents WHERE order_id = $1 ORDER BY id DESC', [req.params.orderId]);
    res.json(result.rows);
  }));
}

module.exports = { registerFinanceModule };
