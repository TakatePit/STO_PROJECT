/**
 * @file Централізований логер Winston: консоль + ротація файлів за датою/розміром.
 * Рівень: змінна оточення LOG_LEVEL (debug|info|warn|error) без перекомпіляції.
 * @module logger
 */

const path = require('path');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, 'logs');

/** Допустимі рівні npm/winston; silent — лише для тестів. */
const LEVELS = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];

function resolveLevel() {
    const fromEnv = (process.env.LOG_LEVEL || '').toLowerCase();
    if (fromEnv === 'silent') return 'silent';
    if (LEVELS.includes(fromEnv)) return fromEnv;
    if (process.env.NODE_ENV === 'test') return 'silent';
    if (process.env.NODE_ENV === 'production') return 'info';
    return 'debug';
}

const level = resolveLevel();

const lineFormat = winston.format.printf((info) => {
    const { timestamp, level: lvl, message, service, requestId, ...rest } = info;
    const rid = requestId ? ` [req:${requestId}]` : '';
    const meta = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
    return `${timestamp} ${lvl.toUpperCase()} [${service || 'sto'}]${rid} ${message}${meta}`;
});

const transports = [];

if (level === 'silent') {
    transports.push(
        new winston.transports.Console({
            silent: true,
        }),
    );
} else {
    transports.push(
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
                lineFormat,
            ),
        }),
    );

    transports.push(
        new DailyRotateFile({
            dirname: LOG_DIR,
            filename: 'app-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxSize: process.env.LOG_MAX_SIZE || '10m',
            maxFiles: process.env.LOG_MAX_FILES || '14d',
            zippedArchive: true,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
            ),
            level: 'info',
        }),
    );

    transports.push(
        new DailyRotateFile({
            dirname: LOG_DIR,
            filename: 'error-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxSize: process.env.LOG_MAX_SIZE || '10m',
            maxFiles: process.env.LOG_MAX_FILES || '30d',
            zippedArchive: true,
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            level: 'error',
        }),
    );
}

const logger = winston.createLogger({
    level: level === 'silent' ? 'error' : level,
    levels: winston.config.npm.levels,
    defaultMeta: { service: 'sto-api' },
    transports,
});

/**
 * Дочірній логер з полем module (наприклад, для маршрутів).
 * @param {string} name
 * @returns {import('winston').Logger}
 */
function child(name) {
    return logger.child({ module: name });
}

module.exports = { logger, child };
