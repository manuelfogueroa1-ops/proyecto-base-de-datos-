'use strict';
const http = require('node:http');
const {randomBytes} = require('node:crypto');
const {createApp} = require('./app');
const db = require('./db');
const accounts = require('./accounts');
function createServer(authOptions) { return http.createServer(createApp(authOptions)); }
if (require.main === module) {
  accounts.prepare().then(async () => {
    const setupCode = await accounts.hasAdmin() ? undefined : randomBytes(10).toString('hex');
    const server = createServer({setupCode});
    const port = Number(process.env.PORT || 3000);
    server.on('error', async error => {
      if (error.code === 'EADDRINUSE') {
        try {
          const response = await fetch(`http://127.0.0.1:${port}/api/salud`, {signal: AbortSignal.timeout(3000)});
          const health = await response.json();
          if (response.ok && health.ok === true && health.mensaje === 'SQL Server conectado') {
            console.log(`La aplicacion ya esta funcionando: http://127.0.0.1:${port}\nAbre esa direccion en el navegador. SQL Server esta conectado.`);
            await db.close();
            return;
          }
        } catch {}
      }
      console.error('No se pudo abrir el servidor:', error.message);
      await db.close();
      process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => {
      console.log(`Aplicación lista: http://127.0.0.1:${port}\nSQL Server conectado. Ctrl+C para detener.`);
      if (setupCode) console.log(`Código para configurar el administrador: ${setupCode}`);
    });
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.close(); db.close().finally(() => process.exit()); });
  }).catch(async error => {
    console.error('No se pudo preparar el acceso en SQL Server:', error.message);
    await db.close();
    process.exitCode = 1;
  });
}
module.exports = {createServer};
