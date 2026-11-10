'use strict';
const {readFile} = require('node:fs/promises');
const path = require('node:path');
const db = require('./db');
const {HttpError} = require('./validation');
const {sql} = db;

async function prepare() {
  const script = await readFile(path.join(__dirname, 'cuentas.sql'), 'utf8');
  await db.transaction(query => query(script));
}

async function hasAdmin() {
  const {recordset} = await db.query("SELECT TOP (1) Usuario FROM dbo.CuentaArena WHERE Rol = 'ADMIN'");
  return recordset.length > 0;
}

async function find(usuario) {
  const {recordset} = await db.query(
    'SELECT Usuario, Rol, Sal, ClaveHash FROM dbo.CuentaArena WHERE Usuario = @usuario',
    {usuario: {type: sql.VarChar(32), value: usuario}},
  );
  return recordset[0];
}

async function insert(account) {
  try {
    await db.query('INSERT dbo.CuentaArena (Usuario, Rol, Sal, ClaveHash) VALUES (@usuario, @rol, @sal, @hash)', {
      usuario: {type: sql.VarChar(32), value: account.Usuario},
      rol: {type: sql.VarChar(7), value: account.Rol},
      sal: {type: sql.Char(32), value: account.Sal},
      hash: {type: sql.Char(128), value: account.ClaveHash},
    });
  } catch (error) {
    const number = error.number || error.originalError?.info?.number;
    if (![2601, 2627].includes(number)) throw error;
    if (account.Rol === 'ADMIN' && await hasAdmin()) throw new HttpError(409, 'El administrador ya está configurado.');
    throw new HttpError(409, 'Ese nombre de usuario ya está en uso.');
  }
}

module.exports = {prepare, hasAdmin, find, insert};
