'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createServer} = require('../server');
test('Express entrega el inicio de sesión y valida peticiones sin tocar SQL Server', async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const page = await fetch(base);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    const html = await page.text();
    const asset = html.match(/src="(\/assets\/[^\"]+\.js)"/)[1];
    const bundle = await fetch(base + asset);
    assert.equal(bundle.status, 200);
    assert.match(bundle.headers.get('content-type'), /javascript/);
    assert.match(await bundle.text(), /Configura el administrador/);
    assert.equal((await fetch(base + '/src/main.jsx')).status, 404);
    assert.equal((await fetch(base + '/api/no-existe')).status, 401);
    assert.equal((await fetch(base + '/api/equipos', {method:'DELETE'})).status, 405);
    assert.equal((await fetch(base + '/api/equipos', {method:'POST', headers:{'Content-Type':'text/plain'},body:'test'})).status, 415);
    assert.equal((await fetch(base + '/api/equipos', {method:'POST', headers:{'Content-Type':'application/json'},body:'{'})).status, 400);
    assert.equal((await fetch(base + '/api/equipos', {method:'POST', headers:{'Content-Type':'application/json'},body:'[]'})).status, 400);
    assert.equal((await fetch(base + '/api/equipos', {method:'POST', headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:'a'.repeat(70000)})})).status, 413);
    assert.equal((await fetch(base + '/api/no-existe', {headers:{Origin:'http://externo.example'}})).status, 403);
    assert.equal((await fetch(base + '/api/no-existe', {headers:{Origin:'http://127.0.0.1:5173'}})).status, 401);
  } finally {await new Promise(resolve => server.close(resolve));}
});

test('El rol de la cuenta protege HTML y API y el cierre invalida la sesión', async () => {
  const saved = new Map();
  const setupCode = 'abcde12345abcde12345';
  const server = createServer({
    setupCode,
    accountStore: {
      hasAdmin: async () => [...saved.values()].some(account => account.Rol === 'ADMIN'),
      find: async usuario => saved.get(usuario),
      insert: async account => saved.set(account.Usuario, account),
    },
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const credentials = {usuario: 'prueba', clave: 'Clave de prueba segura'};
  const send = (path, body, cookie = '') => fetch(base + '/api/acceso/' + path, {
    method: 'POST', headers: {'Content-Type': 'application/json', Cookie: cookie}, body: JSON.stringify(body),
  });
  const get = (path, cookie = '') => fetch(base + path, {headers: {Cookie: cookie}, redirect: 'manual'});

  try {
    assert.equal((await get('/')).headers.get('location'), '/login.html');
    assert.equal((await get('/portal.html')).headers.get('location'), '/login.html');
    assert.equal((await get('/index%2ehtml')).status, 404);
    assert.equal((await get('/api/portal')).status, 401);
    assert.equal((await send('configurar', {...credentials, codigo: 'no-valido'})).status, 403);

    const registered = await send('registro', {...credentials, rol: 'ADMIN'});
    assert.equal(registered.status, 200);
    assert.equal((await registered.json()).destino, '/portal.html');
    assert.equal(saved.get(credentials.usuario).Rol, 'JUGADOR');
    assert.match(saved.get(credentials.usuario).ClaveHash, /^[0-9a-f]{128}$/);
    const cookieHeader = registered.headers.get('set-cookie');
    assert.match(cookieHeader, /HttpOnly; SameSite=Strict/);
    const playerCookie = cookieHeader.split(';', 1)[0];
    assert.equal((await get('/portal.html', playerCookie)).status, 200);
    assert.equal((await get('/index.html', playerCookie)).headers.get('location'), '/portal.html');
    assert.equal((await get('/api/estado', playerCookie)).status, 403);
    const write = await fetch(base + '/api/equipos', {
      method: 'POST', headers: {'Content-Type': 'application/json', Cookie: playerCookie}, body: '{}',
    });
    assert.equal(write.status, 403);

    const admin = {usuario: 'admin-prueba', clave: 'Otra clave de prueba'};
    const configured = await send('configurar', {...admin, codigo: setupCode});
    assert.equal(configured.status, 200);
    assert.equal((await configured.json()).destino, '/index.html');
    const adminCookie = configured.headers.get('set-cookie').split(';', 1)[0];
    assert.equal((await get('/index.html', adminCookie)).status, 200);
    assert.equal((await get('/portal.html', adminCookie)).headers.get('location'), '/index.html');
    assert.equal((await get('/api/portal', adminCookie)).status, 403);
    assert.equal((await send('configurar', {...admin, codigo: setupCode})).status, 409);

    assert.equal((await send('salir', {}, playerCookie)).status, 200);
    assert.equal((await get('/api/portal', playerCookie)).status, 401);
    assert.equal((await send('entrar', {...credentials, clave: 'incorrecta'})).status, 401);
    const login = await send('entrar', credentials);
    assert.equal(login.status, 200);
    assert.equal((await login.json()).destino, '/portal.html');
  } finally {await new Promise(resolve => server.close(resolve));}
});
