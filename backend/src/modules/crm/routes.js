const { query } = require('../../db');
const { AppError } = require('../../../../errors/AppError');
const { asyncRoute, requireAuth, requireRole } = require('../../middleware/auth');

function registerCrmModule(router) {
  router.get('/clients', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (_req, res) => {
    const result = await query('SELECT id, full_name, phone, notes FROM clients ORDER BY id DESC');
    res.json(result.rows);
  }));

  router.get('/clients/:id', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
    const clientRes = await query(
      'SELECT id, full_name, phone, notes FROM clients WHERE id = $1',
      [req.params.id],
    );
    if (!clientRes.rows[0]) {
      throw new AppError('CF_NOT_FOUND', 404, 'CLIENT_NOT_FOUND', { fallbackMessage: 'Клієнта не знайдено' });
    }
    const vehiclesRes = await query(
      `SELECT id, client_id, brand, model, vin, plate, year
       FROM vehicles WHERE client_id = $1 ORDER BY brand, model`,
      [req.params.id],
    );
    res.json({ ...clientRes.rows[0], vehicles: vehiclesRes.rows });
  }));

  router.post('/clients', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
    const { full_name, phone, notes = '' } = req.body;
    const result = await query(
      'INSERT INTO clients (full_name, phone, notes) VALUES ($1, $2, $3) RETURNING id, full_name, phone, notes',
      [full_name, phone, notes],
    );
    res.status(201).json(result.rows[0]);
  }));

  router.patch('/clients/:id', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
    const { full_name, phone, notes = '' } = req.body;
    const result = await query(
      `UPDATE clients SET full_name = $1, phone = $2, notes = $3
       WHERE id = $4
       RETURNING id, full_name, phone, notes`,
      [full_name, phone, notes, req.params.id],
    );
    if (!result.rows[0]) {
      throw new AppError('CF_NOT_FOUND', 404, 'CLIENT_NOT_FOUND', { fallbackMessage: 'Клієнта не знайдено' });
    }
    res.json(result.rows[0]);
  }));

  router.delete('/clients/:id', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
    const result = await query('DELETE FROM clients WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) {
      throw new AppError('CF_NOT_FOUND', 404, 'CLIENT_NOT_FOUND', { fallbackMessage: 'Клієнта не знайдено' });
    }
    res.json({ success: true });
  }));

  router.get('/vehicles', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (_req, res) => {
    const result = await query(`SELECT v.id, v.client_id, v.brand, v.model, v.vin, v.plate, v.year, c.full_name AS owner_name
      FROM vehicles v JOIN clients c ON c.id = v.client_id ORDER BY v.id DESC`);
    res.json(result.rows);
  }));

  router.post('/vehicles', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
    const { client_id, brand, model, vin, plate, year } = req.body;
    const result = await query(
      `INSERT INTO vehicles (client_id, brand, model, vin, plate, year)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, client_id, brand, model, vin, plate, year`,
      [client_id, brand, model, vin, plate, year || null],
    );
    res.status(201).json(result.rows[0]);
  }));

  router.patch('/vehicles/:id', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
    const { client_id, brand, model, vin, plate, year } = req.body;
    const result = await query(
      `UPDATE vehicles
       SET client_id = $1, brand = $2, model = $3, vin = $4, plate = $5, year = $6
       WHERE id = $7
       RETURNING id, client_id, brand, model, vin, plate, year`,
      [client_id, brand, model, vin, plate, year || null, req.params.id],
    );
    if (!result.rows[0]) {
      throw new AppError('CF_NOT_FOUND', 404, 'VEHICLE_NOT_FOUND', { fallbackMessage: 'Авто не знайдено' });
    }
    res.json(result.rows[0]);
  }));

  router.delete('/vehicles/:id', requireAuth, requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
    const result = await query('DELETE FROM vehicles WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) {
      throw new AppError('CF_NOT_FOUND', 404, 'VEHICLE_NOT_FOUND', { fallbackMessage: 'Авто не знайдено' });
    }
    res.json({ success: true });
  }));

  router.get('/client/profile', requireAuth, requireRole('client'), asyncRoute(async (req, res) => {
    const profile = await query(
      `SELECT c.id, c.full_name, c.phone, c.notes, u.email FROM clients c
       JOIN users u ON u.client_id = c.id WHERE c.id = $1 AND u.id = $2`,
      [req.user.clientId, req.user.userId],
    );
    const vehicles = await query('SELECT id, brand, model, vin, plate, year FROM vehicles WHERE client_id = $1 ORDER BY id DESC', [req.user.clientId]);
    res.json({ profile: profile.rows[0] || null, vehicles: vehicles.rows });
  }));

  router.patch('/client/profile', requireAuth, requireRole('client'), asyncRoute(async (req, res) => {
    let { full_name, phone } = req.body;
    full_name = typeof full_name === 'string' ? full_name.trim() : '';
    phone = typeof phone === 'string' ? phone.trim() : '';
    if (!full_name || !phone) {
      throw new AppError('CF_VALIDATION', 400, 'BAD_REQUEST', { fallbackMessage: 'ПІБ та телефон обов\'язкові' });
    }
    const result = await query(
      'UPDATE clients SET full_name = $1, phone = $2 WHERE id = $3 RETURNING id, full_name, phone, notes',
      [full_name, phone, req.user.clientId],
    );
    if (!result.rows[0]) {
      throw new AppError('CF_NOT_FOUND', 404, 'CLIENT_NOT_FOUND', { fallbackMessage: 'Профіль не знайдено' });
    }
    res.json(result.rows[0]);
  }));

  router.post('/client/vehicles', requireAuth, requireRole('client'), asyncRoute(async (req, res) => {
    const { brand, model = '', vin = '', plate, year } = req.body;
    if (!brand || !plate) {
      throw new AppError('CF_VALIDATION', 400, 'BAD_REQUEST', { fallbackMessage: 'Марка і держномер обов\'язкові' });
    }
    const result = await query(
      'INSERT INTO vehicles (client_id, brand, model, vin, plate, year) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, client_id, brand, model, vin, plate, year',
      [req.user.clientId, brand, model, vin, plate, year || null],
    );
    res.status(201).json(result.rows[0]);
  }));

  router.delete('/client/vehicles/:id', requireAuth, requireRole('client'), asyncRoute(async (req, res) => {
    const result = await query(
      'DELETE FROM vehicles WHERE id = $1 AND client_id = $2 RETURNING id',
      [req.params.id, req.user.clientId],
    );
    if (!result.rows[0]) {
      throw new AppError('CF_NOT_FOUND', 404, 'VEHICLE_NOT_FOUND', { fallbackMessage: 'Авто не знайдено або не належить вам' });
    }
    res.json({ success: true });
  }));
}

module.exports = { registerCrmModule };
