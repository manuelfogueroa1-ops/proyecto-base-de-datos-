'use strict';
const express = require('express');
const path = require('node:path');
const {existsSync} = require('node:fs');
const {api} = require('./api');
const {createAuth, destination} = require('./auth');
const {HttpError, sqlError} = require('./validation');

function createApp(authOptions) {
  const app = express();
  const auth = createAuth(authOptions);
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
    if (req.path.startsWith('/acceso/')) {
      return res.json(await auth.handle(req, res, body));
    }
    if (!(req.method === 'GET' && req.path === '/salud')) {
      const session = auth.session(req);
      if (!session) throw new HttpError(401, 'Inicia sesión para continuar.');
      const required = req.path === '/portal' ? 'JUGADOR' : 'ADMIN';
      if (session.rol !== required) throw new HttpError(403, 'Tu cuenta no tiene acceso a esta sección.');
    }
    const result = await api(req.method, '/api' + req.path, body);
    res.status(req.method === 'POST' ? 201 : 200).json(result);
  });
  app.use('/api', router);

  app.get('/', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const session = auth.session(req);
    res.redirect(session ? destination(session.rol) : '/login.html');
  });
  app.get(['/login.html', '/index.html', '/portal.html'], (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const session = auth.session(req);
    const file = req.path.toLowerCase().replace(/\/$/, '');
    const allowed = session ? destination(session.rol) : '/login.html';
    if (file !== allowed) return res.redirect(allowed);
    const document = path.join(front, allowed.slice(1));
    if (!existsSync(document)) return next(new HttpError(503, 'Falta compilar el front. Ejecuta iniciar.cmd o npm run build en front.'));
    res.sendFile(document, {cacheControl: false});
  });
  const publicOptions = {dotfiles: 'deny', index: false, redirect: false, maxAge: '1h'};
  app.use('/assets', express.static(path.join(front, 'assets'), publicOptions));
  app.use('/torneos', express.static(path.join(front, 'torneos'), publicOptions));
  app.get('/favicon.svg', (req, res) => res.sendFile(path.join(front, 'favicon.svg')));
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
