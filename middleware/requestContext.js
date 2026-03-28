/**
 * @file Трасування: X-Request-Id, локаль від Accept-Language / ?lang=
 * @module middleware/requestContext
 */

const { randomUUID } = require('crypto');
const { pickLocale } = require('../errors/i18n');

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function requestContext(req, res, next) {
    req.requestId = req.get('x-request-id') || randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    req.locale = pickLocale(req);
    next();
}

module.exports = requestContext;
