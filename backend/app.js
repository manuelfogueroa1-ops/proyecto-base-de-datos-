'use strict';
const express = require('express');
const path = require('node:path');
const {existsSync} = require('node:fs');
const {api} = require('./api');
const {HttpError, sqlError} = require('./validation');

function createApp() {
  const app = express();
  const front = path.resolve(__dirname, '../front/dist');
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",
    });
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '')) return next(new HttpError(403, 'Usa la dirección local de la aplicación.'));
    next();
  });

  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'POST', 'PUT', 'PATCH'].includes(req.method)) return next(new HttpError(405, 'Método no permitido.'));
    const origin = req.headers.origin;
    const sameOrigin = `http://${req.headers.host}`;
    const devOrigins = process.env.NODE_ENV === 'production' ? [] : ['http://127.0.0.1:5173', 'http://localhost:5173'];
    if (origin && origin !== sameOrigin && !devOrigins.includes(origin)) return next(new HttpError(403, 'Origen no permitido.'));
    if (req.method !== 'GET' && !req.is('application/json')) return next(new HttpError(415, 'Envía los datos en formato JSON.'));
    next();
  });
  router.use(express.json({limit: '64kb', strict: true}));
  router.use(async (req, res) => {
    const body = req.method === 'GET' ? {} : req.body;
    if (!body || Array.isArray(body) || typeof body !== 'object') throw new HttpError(400, 'El formulario contiene JSON no válido.');
    const result = await api(req.method, '/api' + req.path, body);
    res.status(req.method === 'POST' ? 201 : 200).json(result);
  });
  app.use('/api', router);

  app.get('/', (req, res, next) => {
    if (!existsSync(path.join(front, 'index.html'))) return next(new HttpError(503, 'Falta compilar el front. Ejecuta iniciar.cmd o npm run build en front.'));
    next();
  });
  app.use(express.static(front, {dotfiles: 'deny', setHeaders(res, filename) {
    res.setHeader('Cache-Control', filename.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600');
  }}));
  app.use((req, res, next) => next(new HttpError(404, 'Página o ruta no encontrada.')));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    let problem;
    if (error.type === 'entity.too.large') problem = new HttpError(413, 'El formulario es demasiado grande.');
    else if (error.type === 'entity.parse.failed') problem = new HttpError(400, 'El formulario contiene JSON no válido.');
    else problem = sqlError(error);
    res.status(problem.status).json({error: problem.message});
  });
  return app;
}
module.exports = {createApp};
