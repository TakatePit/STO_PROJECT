const path = require('path');
const fs = require('fs/promises');
const { query } = require('../../db');
const { asyncRoute, requireAuth, requireRole } = require('../../middleware/auth');

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => JSON.stringify(row[h] ?? '')).join(','));
  }
  return lines.join('\n');
}

function registerReportsModule(router) {
  router.get('/reports/kpi', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (_req, res) => {
    const revenue = await query('SELECT COALESCE(SUM(total_cost),0)::float AS value FROM orders');
    const avg = await query('SELECT COALESCE(AVG(total_cost),0)::float AS value FROM orders WHERE total_cost > 0');
    const done = await query(`SELECT COUNT(*)::int AS value FROM orders WHERE status = 'done'`);
    const total = await query('SELECT COUNT(*)::int AS value FROM orders');
    res.json({ revenue: revenue.rows[0].value, avg_ticket: avg.rows[0].value, done_orders: done.rows[0].value, all_orders: total.rows[0].value });
  }));

  router.get('/reports/orders/export', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
    const format = (req.query.format || 'csv').toString();
    const rows = (await query('SELECT id, status, description, total_cost::float, opened_at, closed_at FROM orders ORDER BY id DESC')).rows;
    const body = toCsv(rows);
    const dir = path.join(process.cwd(), 'logs', 'exports');
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `orders-${Date.now()}.${format === 'pdf' ? 'txt' : 'csv'}`);
    await fs.writeFile(filePath, body, 'utf8');
    await query('INSERT INTO report_exports (report_name, format, file_path, requested_by) VALUES ($1, $2, $3, $4)', ['orders', format, filePath, req.user.userId]);
    res.json({ filePath, format, rows: rows.length });
  }));
}

module.exports = { registerReportsModule };
