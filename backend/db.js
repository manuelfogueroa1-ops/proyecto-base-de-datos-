'use strict';
const sql = require('mssql/msnodesqlv8');
const config = require('./config');

// La conexión utiliza la cuenta Windows que inicia el backend. No hay claves en el front.
const pool = new sql.ConnectionPool({connectionString:config.connectionString(), pool:{max:5,min:0,idleTimeoutMillis:30000},connectionTimeout:10000,requestTimeout:15000});
pool.on('error', error => console.error('Conexión SQL:', error.message));
let connecting;
async function connect() {
  if (pool.connected) return pool;
  if (!connecting) connecting = pool.connect().finally(() => { connecting = null; });
  return connecting;
}
const settings = 'SET NOCOUNT ON; SET XACT_ABORT ON; SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON; SET ANSI_PADDING ON; SET ANSI_WARNINGS ON; SET CONCAT_NULL_YIELDS_NULL ON; SET ARITHABORT ON; SET NUMERIC_ROUNDABORT OFF; ';
async function query(text, params = {}, transaction) {
  const request = transaction ? new sql.Request(transaction) : (await connect()).request();
  for (const [name, parameter] of Object.entries(params)) request.input(name, parameter.type, parameter.value);
  return request.query(settings + text);
}
async function transaction(work) {
  const tx = new sql.Transaction(await connect());
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try { const result = await work((text, params) => query(text, params, tx)); await tx.commit(); return result; }
  catch (error) { try { await tx.rollback(); } catch {} throw error; }
}
module.exports = {sql, connect, query, transaction, close: () => pool.close()};
