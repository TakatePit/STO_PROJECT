const { query } = require('../../db');
const { AppError } = require('../../../../errors/AppError');
const { asyncRoute, requireAuth, requireRole } = require('../../middleware/auth');

function registerAdminModule(router) {
  router.get('/services', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (_req, res) => {
    const result = await query('SELECT id, title, price::float AS price, type, is_active FROM services WHERE is_active = TRUE ORDER BY type, id');
    res.json(result.rows);
  }));

  router.post('/admin/services', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
    const { title, price, type = 'work' } = req.body;
    const result = await query(
      `INSERT INTO services (title, price, type, is_active)
       VALUES ($1, $2, $3, TRUE)
       RETURNING id, title, price::float AS price, type, is_active`,
      [title, price, type],
    );
    res.status(201).json(result.rows[0]);
  }));

  router.patch('/admin/services/:id', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
    const { title, price, type } = req.body;
    const result = await query(
      `UPDATE services SET
         title = COALESCE($1, title),
         price = COALESCE($2::numeric, price),
         type = COALESCE($3, type)
       WHERE id = $4
       RETURNING id, title, price::float AS price, type, is_active`,
      [title || null, price != null ? price : null, type || null, req.params.id],
    );
    if (!result.rows[0]) throw new AppError('CF_NOT_FOUND', 404, 'SERVICE_NOT_FOUND', { fallbackMessage: 'Послугу не знайдено' });
    res.json(result.rows[0]);
  }));

  router.patch('/admin/services/:id/archive', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
    const result = await query('UPDATE services SET is_active = FALSE WHERE id = $1 RETURNING id, title, is_active', [req.params.id]);
    if (!result.rows[0]) throw new AppError('CF_NOT_FOUND', 404, 'SERVICE_NOT_FOUND', { fallbackMessage: 'Послугу не знайдено' });
    res.json(result.rows[0]);
  }));
}

module.exports = { registerAdminModule };
