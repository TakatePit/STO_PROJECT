const jwt = require('jsonwebtoken');
const { AppError } = require('../../../errors/AppError');

const JWT_SECRET = process.env.JWT_SECRET || 'sto_dev_secret';

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function signToken(user) {
  return jwt.sign({ userId: user.id, role: user.role, clientId: user.client_id }, JWT_SECRET, { expiresIn: '8h' });
}

function requireAuth(req, _res, next) {
  const authHeader = req.get('authorization') || '';
  const [, token] = authHeader.split(' ');
  if (!token) {
    return next(new AppError('CF_AUTH', 401, 'UNAUTHORIZED', { fallbackMessage: 'Немає токена' }));
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (error) {
    return next(new AppError('CF_AUTH', 401, 'UNAUTHORIZED', { fallbackMessage: 'Невалідний токен' }));
  }
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('CF_FORBIDDEN', 403, 'FORBIDDEN', { fallbackMessage: 'Недостатньо прав' }));
    }
    return next();
  };
}

module.exports = { asyncRoute, signToken, requireAuth, requireRole };
