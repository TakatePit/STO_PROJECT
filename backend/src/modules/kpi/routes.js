const { query } = require('../../db');
const { asyncRoute, requireAuth, requireRole } = require('../../middleware/auth');

function registerKpiModule(router) {
  router.get('/kpi/dashboard', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (_req, res) => {
    const revenue = await query('SELECT COALESCE(SUM(total_cost), 0)::float AS value FROM orders WHERE status = $1', ['done']);
    const avg = await query('SELECT COALESCE(AVG(total_cost), 0)::float AS value FROM orders WHERE total_cost > 0');
    const activeOrders = await query(`SELECT COUNT(*)::int AS value FROM orders WHERE status IN ('in_progress','new')`);
    const totalOrders = await query('SELECT COUNT(*)::int AS value FROM orders');
    const repeatSource = await query('SELECT v.client_id FROM orders o JOIN vehicles v ON v.id = o.vehicle_id');
    const counts = repeatSource.rows.reduce((acc, row) => {
      const key = String(row.client_id);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const repeatVisits = Object.values(counts).filter((value) => value > 1).length;

    const payload = {
      revenue: revenue.rows[0].value,
      avgTicket: avg.rows[0].value,
      loadFactor: totalOrders.rows[0].value ? (activeOrders.rows[0].value / totalOrders.rows[0].value) * 100 : 0,
      repeatVisits,
    };

    await query(
      'INSERT INTO kpi_snapshots (snapshot_date, revenue, avg_ticket, repeat_visits, load_factor) VALUES (CURRENT_DATE, $1, $2, $3, $4)',
      [payload.revenue, payload.avgTicket, payload.repeatVisits, payload.loadFactor],
    );

    res.json(payload);
  }));
}

module.exports = { registerKpiModule };
