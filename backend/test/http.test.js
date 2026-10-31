'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createServer} = require('../server');
test('Express entrega el build de Vite y valida peticiones sin tocar SQL Server', async () => {
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
    assert.match(await bundle.text(), /react/);
    assert.equal((await fetch(base + '/src/main.jsx')).status, 404);
    assert.equal((await fetch(base + '/api/no-existe')).status, 404);
    assert.equal((await fetch(base + '/api/equipos', {method:'DELETE'})).status, 405);
    assert.equal((await fetch(base + '/api/equipos', {method:'POST', headers:{'Content-Type':'text/plain'},body:'test'})).status, 415);
    assert.equal((await fetch(base + '/api/equipos', {method:'POST', headers:{'Content-Type':'application/json'},body:'{'})).status, 400);
    assert.equal((await fetch(base + '/api/equipos', {method:'POST', headers:{'Content-Type':'application/json'},body:'[]'})).status, 400);
    assert.equal((await fetch(base + '/api/equipos', {method:'POST', headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:'a'.repeat(70000)})})).status, 413);
    assert.equal((await fetch(base + '/api/no-existe', {headers:{Origin:'http://externo.example'}})).status, 403);
    assert.equal((await fetch(base + '/api/no-existe', {headers:{Origin:'http://127.0.0.1:5173'}})).status, 404);
  } finally {await new Promise(resolve => server.close(resolve));}
});
