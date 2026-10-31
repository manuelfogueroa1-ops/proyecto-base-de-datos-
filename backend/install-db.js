'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const sql = require('mssql/msnodesqlv8');
const config = require('./config');

// GO es un separador de SSMS, no una sentencia que entienda el motor.
function splitBatches(source) {
  return source.replace(/^\uFEFF/, '').split(/^[\t ]*GO[\t ]*(?:--[^\r\n]*)?\r?$/gmi).map(batch=>batch.trim()).filter(Boolean);
}
async function install() {
  if (config.database !== 'PlataformaTorneosVideojuegos') throw Error('El script crea PlataformaTorneosVideojuegos. Conserva ese DB_NAME al instalar; DB_SERVER puede cambiarse en .env.');
  const source=await fs.readFile(path.resolve(__dirname,'../01_crear_base_datos.sql'),'utf8');
  const pools=new Map();
  let database='master';
  const settings='SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON; SET ANSI_PADDING ON; SET ANSI_WARNINGS ON; SET CONCAT_NULL_YIELDS_NULL ON; SET ARITHABORT ON; SET NUMERIC_ROUNDABORT OFF; SET XACT_ABORT ON; SET NOCOUNT ON; ';
  try {
    for(const batch of splitBatches(source)) {
      // USE determina la conexión de los lotes siguientes. Solo los nombres del proyecto.
      const use=batch.match(/(?:^|\n)USE\s+(master|PlataformaTorneosVideojuegos)\s*;\s*$/i);
      if(use) {database=use[1].toLowerCase()==='master'?'master':config.database;continue;}
      if(!pools.has(database)) {
        const pool=new sql.ConnectionPool({connectionString:config.connectionString(database),connectionTimeout:10000,requestTimeout:60000,pool:{max:1,min:0,idleTimeoutMillis:1000}});
        pool.on('error',error=>console.error(error.message));
        pools.set(database,pool);
        await pool.connect();
      }
      // El lote DDL se ejecuta aislado para que CREATE PROCEDURE siga siendo su primera sentencia.
      await pools.get(database).request().input('script',sql.NVarChar(sql.MAX),batch).query(settings+'EXEC sys.sp_executesql @script;');
    }
    console.log('Base preparada: PlataformaTorneosVideojuegos. No se cargaron ejemplos ni se borraron registros existentes.');
    console.log('Ahora abre iniciar.cmd y entra a http://127.0.0.1:3000');
  } finally {await Promise.allSettled([...pools.values()].map(pool=>pool.close()));}
}
if(require.main===module) install().catch(error=>{
 console.error('No se pudo preparar la base:',error.message);
 console.error('Comprueba SQL Server en ejecucion, DB_SERVER, ODBC Driver 18 y los permisos de tu cuenta Windows para crear bases.');
 process.exitCode=1;
});
module.exports={splitBatches,install};
