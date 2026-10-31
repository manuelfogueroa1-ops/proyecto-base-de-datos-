'use strict';
const database = process.env.DB_NAME || 'PlataformaTorneosVideojuegos';
function connectionString(name = database) {
  return `Driver={${process.env.DB_DRIVER || 'ODBC Driver 18 for SQL Server'}};Server={${process.env.DB_SERVER || 'lpc:.\\SQLEXPRESS'}};Database={${name}};Trusted_Connection=Yes;Encrypt=Yes;TrustServerCertificate=Yes;`;
}
module.exports = {database, connectionString};
