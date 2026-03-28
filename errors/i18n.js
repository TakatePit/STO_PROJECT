/**
 * @module errors/i18n
 */

const path = require('path');
const uk = require('../locales/uk.json');
const en = require('../locales/en.json');

const MAP = { uk, en };

/**
 * @param {import('express').Request} req
 * @returns {'uk'|'en'}
 */
function pickLocale(req) {
    const q = req.query && String(req.query.lang || '').toLowerCase();
    if (q === 'en') return 'en';
    if (q === 'uk') return 'uk';
    const al = (req.get && req.get('accept-language')) || '';
    if (/^en\b/i.test(al)) return 'en';
    return 'uk';
}

/**
 * @param {'uk'|'en'} locale
 * @param {string} key
 * @returns {string|undefined}
 */
function t(locale, key) {
    const pack = MAP[locale] || uk;
    return pack[key];
}

module.exports = { pickLocale, t, path: path.join(__dirname, '..', 'locales') };
