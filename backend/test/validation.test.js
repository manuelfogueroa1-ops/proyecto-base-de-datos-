'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const v=require('../validation');
test('normaliza texto sin aceptar blancos ni excesos',()=>{
 assert.equal(v.text('  Nicolás  ','Nombre',50),'Nicolás');
 for(const value of [' ',null,42,'x'.repeat(51)])assert.throws(()=>v.text(value,'Nombre',50));
});
test('valida enteros y cupos sin conversión de valores vacíos',()=>{
 assert.equal(v.integer('5','Cupo',1,5),5);
 for(const value of ['',null,undefined,true,{},[],1.5,0,6])assert.throws(()=>v.integer(value,'Cupo',1,5));
 assert.equal(v.integer(0,'Muertes',0),0);
});
test('valida fechas reales y horas locales',()=>{
 assert.equal(v.date('2028-02-29','Fecha'),'2028-02-29');
 for(const value of ['2027-02-29','2026-02-30','2026-13-01','hola'])assert.throws(()=>v.date(value,'Fecha'));
 assert.equal(v.datetime('2026-10-30T18:30'),'2026-10-30T18:30');
 assert.throws(()=>v.datetime('2026-10-30T25:30'));
});
test('traduce reglas SQL a errores comprensibles',()=>{
 const error=v.sqlError({number:2601,message:'UX_Jugador_EquipoCupo'});
 assert.equal(error.status,409);assert.match(error.message,/cinco jugadores/);
 assert.equal(v.sqlError(new v.HttpError(404,'No existe')).status,404);
});
