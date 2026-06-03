const { query } = require('../../db');
const { AppError } = require('../../../../errors/AppError');
const { asyncRoute, requireAuth, requireRole } = require('../../middleware/auth');

function registerAppointmentsModule(router) {
  router.get('/appointments', requireAuth, asyncRoute(async (_req, res) => {
    const result = await query(`SELECT a.id, a.client_id, a.vehicle_id, a.starts_at, a.ends_at, a.status, a.comment,
      c.full_name AS client_name
      FROM appointments a
      JOIN clients c ON c.id = a.client_id
      ORDER BY a.starts_at DESC`);
    res.json(result.rows);
  }));

  router.post('/appointments', requireAuth, asyncRoute(async (req, res) => {
    let { client_id = req.user.clientId || null, vehicle_id = null, starts_at, ends_at, comment = '' } = req.body;
    if (!client_id) {
      const fallbackClient = await query('SELECT id FROM clients ORDER BY id ASC LIMIT 1');
      client_id = fallbackClient.rows[0]?.id || null;
    }
    const conflict = await query(
      `SELECT id FROM appointments
       WHERE status <> 'cancelled'
         AND starts_at < $2::timestamptz
         AND ends_at > $1::timestamptz
       LIMIT 1`,
      [starts_at, ends_at],
    );
    if (conflict.rows[0]) {
      throw new AppError('CF_CONFLICT', 409, 'TIME_SLOT_CONFLICT', { fallbackMessage: 'Цей часовий слот уже зайнятий' });
    }
    const result = await query(
      `INSERT INTO appointments (client_id, vehicle_id, starts_at, ends_at, status, comment)
       VALUES ($1, $2, $3, $4, 'pending', $5)
       RETURNING id, client_id, vehicle_id, starts_at, ends_at, status, comment`,
      [client_id, vehicle_id, starts_at, ends_at, comment],
    );
    res.status(201).json(result.rows[0]);
  }));

  router.patch('/appointments/:id', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
    const { status } = req.body;
    const allowed = ['confirmed', 'cancelled'];
    if (!allowed.includes(status)) {
      throw new AppError('CF_VALIDATION', 400, 'BAD_REQUEST', { fallbackMessage: 'Недопустимий статус' });
    }
    const result = await query(
      'UPDATE appointments SET status = $1 WHERE id = $2 RETURNING id, client_id, vehicle_id, starts_at, ends_at, status, comment',
      [status, req.params.id],
    );
    if (!result.rows[0]) {
      throw new AppError('CF_NOT_FOUND', 404, 'NOT_FOUND', { fallbackMessage: 'Запис не знайдено' });
    }
    res.json(result.rows[0]);
  }));
}

module.exports = { registerAppointmentsModule };
