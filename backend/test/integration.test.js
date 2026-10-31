'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const db=require('../db');
const {createServer}=require('../server');

// Optativo: crea registros con prefijo único y elimina únicamente sus IDs en finally.
test('Front/API/SQL Server: flujo completo y reglas de integridad',{skip:process.env.RUN_INTEGRATION!=='1'},async t=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const tag=`QA_${randomUUID().slice(0,8)}`;
 const equipos=[],jugadores=[],torneos=[],partidas=[];
 const call=async(path,method='GET',body,expected=200)=>{
  const response=await fetch(base+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  const payload=await response.json();assert.equal(response.status,expected,JSON.stringify(payload));return payload;
 };
 const crearEquipo=async(name,juego)=>{
  const row=await call('/api/equipos','POST',{nombre:tag+name,videojuegoId:juego},201);equipos.push(row.EquipoId);return row.EquipoId;
 };
 const crearJugador=async(name,equipoId,cupo)=>{
  const body={primerNombre:tag+name,apellido:'Verificación',alias:tag+name,equipoId,cupo};
  const row=await call('/api/jugadores','POST',body,201);jugadores.push(row.JugadorId);return {id:row.JugadorId,body};
 };
 try {
  await t.test('servidor entrega el front y bloquea orígenes externos',async()=>{
   const response=await fetch(base);assert.equal(response.status,200);assert.match(await response.text(),/Arena/);
   const blocked=await fetch(base+'/api/equipos',{method:'POST',headers:{Origin:'http://externo.example','Content-Type':'application/json'},body:'{}'});assert.equal(blocked.status,403);
   await call('/api/equipos','POST',{nombre:' ',videojuegoId:1},400);
  });
  const state=await call('/api/estado');assert.equal(state.videojuegos.length,4);
  const valorant=state.videojuegos.find(g=>g.Nombre==='Valorant').VideojuegoId;
  const assetto=state.videojuegos.find(g=>g.Nombre==='Assetto Corsa').VideojuegoId;
  const a=await crearEquipo('_A',valorant), b=await crearEquipo('_B',valorant), c=await crearEquipo('_C',assetto), d=await crearEquipo('_D',assetto);
  const p1=await crearJugador('_P1',a,1),p2=await crearJugador('_P2',b,1),p3=await crearJugador('_P3',c,1),p4=await crearJugador('_P4',d,1);
  await t.test('rechaza duplicados y cupos ocupados',async()=>{
   await call('/api/equipos','POST',{nombre:tag+'_A',videojuegoId:valorant},409);
   await call('/api/jugadores','POST',{primerNombre:tag+'_extra',apellido:'Prueba',alias:tag+'_extra',equipoId:a,cupo:1},409);
   await call('/api/jugadores','POST',{...p1.body,alias:tag+'_otro'},409);
  });
  for(const [name,game]of [['_VAL',valorant],['_AC',assetto]]){
   const row=await call('/api/torneos','POST',{nombre:tag+name,videojuegoId:game,fechaInicio:'2026-10-30',fechaFin:'2026-11-15'},201);torneos.push(row.TorneoId);
  }
  await t.test('inscripciones verifican el videojuego',async()=>{
   await call('/api/inscripciones','POST',{torneoId:torneos[0],equipoId:c},409);
   for(const [index,team]of [[0,a],[0,b],[1,c],[1,d]])await call('/api/inscripciones','POST',{torneoId:torneos[index],equipoId:team},201);
  });
  for(const [index,teams]of [[0,[a,b]],[1,[c,d]]]){
   const row=await call('/api/partidas','POST',{torneoId:torneos[index],nombre:tag+'_Partida'+index,fechaHora:'2026-10-30T18:30',equipoIds:teams},201);partidas.push(row.PartidaId);
  }
  await t.test('alineación guardada y KDA solo al finalizar',async()=>{
   const state=await call('/api/estado');assert.equal(state.alineaciones.filter(a=>partidas.includes(a.PartidaId)).length,4);
   await call('/api/resultados/kda','PUT',{partidaId:partidas[0],jugadorId:p1.id,asesinatos:20,muertes:0,asistencias:5},400);
   for(const id of partidas)await call(`/api/partidas/${id}/estado`,'PATCH',{estado:'FINALIZADA'});
   await call('/api/resultados/kda','PUT',{partidaId:partidas[0],jugadorId:p1.id,asesinatos:20,muertes:0,asistencias:5});
   await call('/api/resultados/kda','PUT',{partidaId:partidas[0],jugadorId:p1.id,asesinatos:21,muertes:0,asistencias:5});
   const state2=await call('/api/estado');const saved=state2.kda.filter(r=>r.PartidaId===partidas[0]&&r.JugadorId===p1.id);assert.equal(saved.length,1);assert.equal(saved[0].KDA,26);
  });
  await t.test('carreras y validación de tipo de estadística',async()=>{
   await call('/api/resultados/carrera','PUT',{partidaId:partidas[1],jugadorId:p3.id,posicion:1,tiempoMilisegundos:90500,vueltas:3});
   await call('/api/resultados/carrera','PUT',{partidaId:partidas[1],jugadorId:p4.id,posicion:1,tiempoMilisegundos:91500,vueltas:3},409);
   await call('/api/resultados/kda','PUT',{partidaId:partidas[1],jugadorId:p3.id,asesinatos:1,muertes:1,asistencias:1},400);
   await call(`/api/partidas/${partidas[0]}/estado`,'PATCH',{estado:'EN_CURSO'},400);
  });
  await t.test('correcciones, transferencia e historial',async()=>{
   await call(`/api/jugadores/${p1.id}`,'PUT',{...p1.body,equipoId:b,cupo:2});
   await call(`/api/equipos/${a}`,'PUT',{nombre:tag+'_Corregido'});
   await call(`/api/equipos/${a}/retirar`,'POST',{},201);
   const state=await call('/api/estado');assert.equal(state.jugadores.find(j=>j.JugadorId===p1.id).EquipoId,b);
   assert.equal(state.alineaciones.find(j=>j.JugadorId===p1.id).EquipoId,a);
   assert.equal(state.equipos.find(j=>j.EquipoId===a).Activo,false);
   await call(`/api/equipos/${b}/retirar`,'POST',{},201);
   await call(`/api/jugadores/${p1.id}`,'PUT',{...p1.body,primerNombre:tag+'_Corregido',equipoId:b,cupo:2});
  });
  await t.test('nombres con comillas se almacenan como texto',async()=>{
   const name=tag+"_O'Connor";
   const row=await call('/api/equipos','POST',{nombre:name,videojuegoId:valorant},201);equipos.push(row.EquipoId);
   assert.ok((await call('/api/estado')).equipos.some(e=>e.Nombre===name));
  });
 }finally{
  // Solo los registros identificados por las respuestas de esta prueba; nunca catálogos.
  await db.transaction(async query=>{
   for(const id of partidas){const params={id:{type:db.sql.Int,value:id}};
    await query('DELETE dbo.EstadisticaKDA WHERE PartidaId=@id; DELETE dbo.ResultadoCarrera WHERE PartidaId=@id; DELETE dbo.AlineacionPartida WHERE PartidaId=@id; DELETE dbo.EquipoPartida WHERE PartidaId=@id; DELETE dbo.Partida WHERE PartidaId=@id',params);}
   for(const id of torneos)await query('DELETE dbo.Inscripcion WHERE TorneoId=@id; DELETE dbo.Torneo WHERE TorneoId=@id',{id:{type:db.sql.Int,value:id}});
   for(const id of jugadores)await query('DELETE dbo.Jugador WHERE JugadorId=@id',{id:{type:db.sql.Int,value:id}});
   for(const id of equipos)await query('DELETE dbo.Equipo WHERE EquipoId=@id',{id:{type:db.sql.Int,value:id}});
  });
  await new Promise(resolve=>server.close(resolve));await db.close();
 }
});
