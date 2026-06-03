const bcrypt = require('bcryptjs');
const { query } = require('../../db');
const { AppError } = require('../../../../errors/AppError');
const { asyncRoute, signToken, requireAuth } = require('../../middleware/auth');

function registerAuthModule(router) {
  router.post('/auth/register', asyncRoute(async (req, res) => {
    let { full_name, phone, email, password } = req.body;
    full_name = typeof full_name === 'string' ? full_name.trim() : '';
    phone = typeof phone === 'string' ? phone.trim() : '';
    email = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!full_name || !phone || !email || !password) {
      throw new AppError('CF_VALIDATION', 400, 'BAD_REQUEST', { fallbackMessage: 'Потрібні всі поля реєстрації' });
    }

    const emailTaken = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (emailTaken.rows[0]) {
      throw new AppError('CF_CONFLICT', 409, 'EMAIL_TAKEN', { fallbackMessage: 'Цей email уже використовується' });
    }

    const existingClient = await query('SELECT id, full_name, phone FROM clients WHERE phone = $1', [phone]);

    let client;
    if (existingClient.rows[0]) {
      const portalUser = await query(
        'SELECT id FROM users WHERE client_id = $1 AND role = $2',
        [existingClient.rows[0].id, 'client'],
      );
      if (portalUser.rows[0]) {
        throw new AppError('CF_CONFLICT', 409, 'PHONE_HAS_ACCOUNT', {
          fallbackMessage: 'Для цього номера телефону вже створено обліковий запис клієнта',
        });
      }
      client = existingClient.rows[0];
    } else {
      const clientResult = await query(
        'INSERT INTO clients (full_name, phone, notes) VALUES ($1, $2, $3) RETURNING id, full_name, phone',
        [full_name, phone, ''],
      );
      client = clientResult.rows[0];
    }

    const hash = await bcrypt.hash(password, 10);
    const userResult = await query(
      `INSERT INTO users (email, password_hash, role, client_id)
       VALUES ($1, $2, 'client', $3)
       RETURNING id, email, role, client_id`,
      [email, hash, client.id],
    );
    const user = userResult.rows[0];
    res.status(201).json({ token: signToken(user), user, client });
  }));

  router.post('/auth/login', asyncRoute(async (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const { password } = req.body;
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password || '', user.password_hash))) {
      throw new AppError('CF_AUTH', 401, 'WRONG_PASSWORD', { fallbackMessage: 'Невірний email або пароль' });
    }
    res.json({ token: signToken(user), user: { id: user.id, email: user.email, role: user.role, client_id: user.client_id } });
  }));

  router.get('/auth/me', requireAuth, asyncRoute(async (req, res) => {
    const result = await query('SELECT id, email, role, client_id FROM users WHERE id = $1', [req.user.userId]);
    res.json(result.rows[0] || null);
  }));

  router.patch('/auth/me', requireAuth, asyncRoute(async (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      throw new AppError('CF_VALIDATION', 400, 'BAD_REQUEST', { fallbackMessage: 'Вкажіть поточний і новий пароль' });
    }
    const result = await query('SELECT * FROM users WHERE id = $1', [req.user.userId]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(current_password, user.password_hash))) {
      throw new AppError('CF_AUTH', 401, 'WRONG_PASSWORD', { fallbackMessage: 'Невірний поточний пароль' });
    }
    const hash = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.userId]);
    res.json({ ok: true });
  }));
}

module.exports = { registerAuthModule };
