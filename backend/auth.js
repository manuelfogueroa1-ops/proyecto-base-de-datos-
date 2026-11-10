'use strict';
const {randomBytes, scrypt, timingSafeEqual} = require('node:crypto');
const {promisify} = require('node:util');
const accounts = require('./accounts');
const {HttpError} = require('./validation');

const derive = promisify(scrypt);
const sessionDuration = 8 * 60 * 60 * 1000;
const cookieName = 'arena_session';
const cookieOptions = {httpOnly: true, sameSite: 'strict', path: '/'};
const attemptsWindow = 60_000;

function destination(role) {
  return role === 'ADMIN' ? '/index.html' : '/portal.html';
}

function credentials(body, creating) {
  const usuario = typeof body.usuario === 'string' ? body.usuario.trim().toLowerCase() : '';
  const clave = typeof body.clave === 'string' ? body.clave : '';
  if (!/^[a-z0-9_.-]{3,32}$/.test(usuario)) {
    throw new HttpError(400, 'El usuario debe tener entre 3 y 32 letras, números, puntos, guiones o guiones bajos.');
  }
  if (clave.length < (creating ? 12 : 1) || clave.length > 128) {
    throw new HttpError(400, creating ? 'La contraseña debe tener entre 12 y 128 caracteres.' : 'Ingresa tu contraseña.');
  }
  return {usuario, clave};
}

function passwordHash(clave, sal) {
  return derive(clave, Buffer.from(sal, 'hex'), 64, {N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024});
}

function createAuth({setupCode, accountStore = accounts} = {}) {
  const sessions = new Map();
  const attempts = new Map();
  let nextCleanup = 0;

  function token(req) {
    return (req.headers.cookie ?? '').match(/(?:^|;\s*)arena_session=([\w-]{43})(?:;|$)/)?.[1];
  }

  function session(req) {
    const id = token(req);
    const value = sessions.get(id);
    if (value && value.expires > Date.now()) return value;
    sessions.delete(id);
    return null;
  }

  function begin(req, res, rol) {
    sessions.delete(token(req));
    const id = randomBytes(32).toString('base64url');
    sessions.set(id, {rol, expires: Date.now() + sessionDuration});
    res.cookie(cookieName, id, {...cookieOptions, maxAge: sessionDuration, secure: req.secure});
    return {destino: destination(rol)};
  }

  function limit(req) {
    const now = Date.now();
    if (now >= nextCleanup) {
      for (const [id, value] of sessions) if (value.expires <= now) sessions.delete(id);
      for (const [ip, entry] of attempts) if (entry.expires <= now) attempts.delete(ip);
      nextCleanup = now + attemptsWindow;
    }
    const key = req.ip;
    const previous = attempts.get(key);
    const entry = previous?.expires > now ? previous : {count: 0, expires: now + attemptsWindow};
    if (entry.count >= 12) throw new HttpError(429, 'Hubo varios intentos seguidos. Espera un minuto y vuelve a intentar.');
    entry.count += 1;
    attempts.set(key, entry);
  }

  async function handle(req, res, body) {
    if (req.method === 'GET' && req.path === '/acceso/configuracion') {
      const current = session(req);
      return {
        configurar: Boolean(setupCode) && !await accountStore.hasAdmin(),
        destino: current ? destination(current.rol) : null,
      };
    }
    if (req.method !== 'POST') throw new HttpError(404, 'Operación de acceso no encontrada.');
    if (req.path === '/acceso/salir') {
      sessions.delete(token(req));
      res.clearCookie(cookieName, {...cookieOptions, secure: req.secure});
      return {ok: true};
    }
    if (req.path === '/acceso/entrar') {
      limit(req);
      const {usuario, clave} = credentials(body, false);
      const account = await accountStore.find(usuario);
      const hash = await passwordHash(clave, account?.Sal ?? '0'.repeat(32));
      if (!account || !timingSafeEqual(hash, Buffer.from(account.ClaveHash, 'hex'))) {
        throw new HttpError(401, 'Usuario o contraseña incorrectos.');
      }
      return begin(req, res, account.Rol);
    }

    const configuring = req.path === '/acceso/configurar';
    if (!configuring && req.path !== '/acceso/registro') throw new HttpError(404, 'Operación de acceso no encontrada.');
    limit(req);
    if (configuring) {
      const code = setupCode;
      if (!code || await accountStore.hasAdmin()) throw new HttpError(409, 'El administrador ya está configurado.');
      const submitted = typeof body.codigo === 'string' ? body.codigo.trim().toLowerCase() : '';
      if (submitted.length !== code.length || !/^[0-9a-f]+$/.test(submitted)
          || !timingSafeEqual(Buffer.from(submitted), Buffer.from(code))) {
        throw new HttpError(403, 'El código de configuración no es válido.');
      }
    }
    const {usuario, clave} = credentials(body, true);
    const Rol = configuring ? 'ADMIN' : 'JUGADOR';
    const Sal = randomBytes(16).toString('hex');
    const ClaveHash = (await passwordHash(clave, Sal)).toString('hex');
    await accountStore.insert({Usuario: usuario, Rol, Sal, ClaveHash});
    if (configuring) setupCode = null;
    return begin(req, res, Rol);
  }

  return {handle, session};
}

module.exports = {createAuth, destination};
