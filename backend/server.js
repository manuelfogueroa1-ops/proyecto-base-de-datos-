'use strict';
const http = require('node:http');
const {createApp} = require('./app');
const db = require('./db');
function createServer() { return http.createServer(createApp()); }
if (require.main === module) {
  db.connect().then(() => {
    const server = createServer();
    const port = Number(process.env.PORT || 3000);
    server.on('error', error => { console.error('No se pudo abrir el servidor:', error.message); db.close(); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => console.log(`Aplicación lista: http://127.0.0.1:${port}\nReact + Vite -> Express + Node.js -> SQL Server conectado. Ctrl+C para detener.`));
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.close(); db.close().finally(() => process.exit()); });
  }).catch(error => { console.error('No se pudo conectar con SQL Server:', error.message); process.exitCode = 1; });
}
module.exports = {createServer};
