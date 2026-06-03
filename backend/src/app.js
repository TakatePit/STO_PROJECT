// @ts-nocheck — root `tsc` з checkJs тягне цей файл з server.js; типи helmet/rate-limit дають хибні помилки.
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const requestContext = require('../../middleware/requestContext');
const { httpLogger } = require('../../middleware/httpLogger');
const { notFoundHandler, errorHandler } = require('../../errors/httpErrorHandler');
const { initDb } = require('./db');
const { registerModules } = require('./modules');

const app = express();
const dbReady = initDb();

/** Якщо є збірка Vite — корінь `/` віддає новий React UI замість статики `public/index.html`. */
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
const spaIndexHtml = path.join(frontendDist, 'index.html');
const spaDistReady = fs.existsSync(spaIndexHtml);

const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

app.use(helmet());
app.use(requestContext);
app.use(httpLogger);
app.use(bodyParser.json());
if (spaDistReady) {
  app.use(express.static(frontendDist));
}
app.use(express.static('public'));
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);

app.use(async (_req, _res, next) => {
  try {
    await dbReady;
    next();
  } catch (error) {
    next(error);
  }
});

registerModules(app);

if (spaDistReady) {
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api')) return next();
    res.sendFile(spaIndexHtml, (err) => next(err));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
