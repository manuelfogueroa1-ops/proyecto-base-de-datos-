'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {splitBatches}=require('../install-db');
test('separa lotes GO de SSMS y conserva procedimientos completos',()=>{
 const batches=splitBatches('SELECT 1;\r\nGO\r\nCREATE PROCEDURE p AS SELECT 2;\r\nGO -- siguiente\r\nSELECT 3;');
 assert.deepEqual(batches,['SELECT 1;','CREATE PROCEDURE p AS SELECT 2;','SELECT 3;']);
 const actual=splitBatches(fs.readFileSync(path.resolve(__dirname,'../../01_crear_base_datos.sql'),'utf8'));
 assert.equal(actual.filter(batch=>batch.startsWith('CREATE OR ALTER PROCEDURE')).length,4);
 assert.ok(actual.some(batch=>batch.includes('CREATE DATABASE PlataformaTorneosVideojuegos')));
 assert.ok(actual.every(batch=>!/^GO\s*$/mi.test(batch)));
});
