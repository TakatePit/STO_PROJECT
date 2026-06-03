const { query } = require('../../db');
const { asyncRoute, requireAuth } = require('../../middleware/auth');

function registerNotificationsModule(router) {
  router.get('/notifications', requireAuth, asyncRoute(async (req, res) => {
    const result = await query('SELECT id, user_id, channel, template_key, payload, status, created_at FROM notifications WHERE user_id = $1 ORDER BY id DESC', [req.user.userId]);
    res.json(result.rows);
  }));

  router.post('/notifications', requireAuth, asyncRoute(async (req, res) => {
    const { user_id = req.user.userId, channel = 'in_app', template_key = 'generic', payload = {} } = req.body;
    const result = await query(
      `INSERT INTO notifications (user_id, channel, template_key, payload, status)
       VALUES ($1, $2, $3, $4::jsonb, 'queued')
       RETURNING id, user_id, channel, template_key, payload, status, created_at`,
      [user_id, channel, template_key, JSON.stringify(payload)],
    );
    res.status(201).json(result.rows[0]);
  }));
}

module.exports = { registerNotificationsModule };
