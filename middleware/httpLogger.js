/**
 * @file Лог HTTP-запиту після завершення відповіді (статус, тривалість, requestId).
 * @module middleware/httpLogger
 */

const { logger } = require('../logger');

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function httpLogger(req, res, next) {
    const start = Date.now();
    res.on('finish', () => {
        logger.info('HTTP request', {
            requestId: req.requestId,
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            durationMs: Date.now() - start,
            locale: req.locale,
        });
    });
    next();
}

module.exports = { httpLogger };
