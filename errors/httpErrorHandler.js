/**
 * @file Відповіді API з errorId, кодом типу та requestId; HTML 404 поза /api.
 * @module errors/httpErrorHandler
 */

const path = require('path');
const { randomUUID } = require('crypto');
const { logger } = require('../logger');
const { AppError } = require('./AppError');
const { pickLocale, t } = require('./i18n');

/**
 * @param {import('express').Response} res
 * @param {import('express').Request} req
 * @param {AppError|Error} err
 */
function sendApiError(res, req, err) {
    const locale = pickLocale(req);
    const errorId = randomUUID();

    if (err instanceof AppError) {
        err.errorId = errorId;
        const userMsg =
            t(locale, err.messageKey) || err.fallbackMessage || t('uk', err.messageKey) || err.messageKey;

        logger.error(`AppError ${err.code}`, {
            requestId: req.requestId,
            errorId,
            code: err.code,
            messageKey: err.messageKey,
            ...err.context,
        });

        return res.status(err.statusCode).json({
            error: userMsg,
            errorId,
            code: err.code,
            requestId: req.requestId,
        });
    }

    logger.error('Unhandled error', {
        requestId: req.requestId,
        errorId,
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    });

    const userMsg = t(locale, 'INTERNAL') || t('uk', 'INTERNAL');
    return res.status(500).json({
        error: userMsg,
        errorId,
        code: 'STO_INTERNAL',
        requestId: req.requestId,
    });
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function notFoundHandler(req, res) {
    if (req.path.startsWith('/api')) {
        const err = new AppError('STO_ROUTE_NOT_FOUND', 404, 'ROUTE_NOT_FOUND', {
            fallbackMessage: 'Маршрут не знайдено',
            context: { path: req.path, method: req.method },
        });
        return sendApiError(res, req, err);
    }
    res.status(404).sendFile(path.join(__dirname, '..', 'public', 'errors', '404.html'));
}

/**
 * Фінальний обробник помилок Express (4 аргументи).
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }
    return sendApiError(res, req, err);
}

module.exports = { sendApiError, notFoundHandler, errorHandler };
