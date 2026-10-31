'use strict';
const db = require('./db');
const {sql} = db;
const v = require('./validation');
const int = value => ({type:sql.Int,value});
const str = (value, size=100) => ({type:sql.NVarChar(size),value});
const notFound = () => { throw new v.HttpError(404, 'El registro ya no existe. Actualiza la página.'); };
const idResult = result => result.recordset[0];

async function state() {
  const result = await db.query(`
    SELECT CategoriaId,Nombre FROM dbo.Categoria ORDER BY Nombre;
    SELECT VideojuegoId,CategoriaId,Nombre,TipoEstadistica FROM dbo.Videojuego ORDER BY Nombre;
    SELECT e.*,v.Nombre AS Videojuego,(SELECT COUNT(*) FROM dbo.Jugador j WHERE j.EquipoId=e.EquipoId) AS Integrantes
      FROM dbo.Equipo e JOIN dbo.Videojuego v ON v.VideojuegoId=e.VideojuegoId ORDER BY e.Nombre;
    SELECT j.*,e.Nombre AS Equipo FROM dbo.Jugador j LEFT JOIN dbo.Equipo e ON e.EquipoId=j.EquipoId ORDER BY j.PrimerNombre,j.Apellido;
    SELECT t.*,v.Nombre AS Videojuego,v.TipoEstadistica FROM dbo.Torneo t JOIN dbo.Videojuego v ON v.VideojuegoId=t.VideojuegoId ORDER BY t.FechaInicio DESC;
    SELECT i.*,e.Nombre AS Equipo,t.Nombre AS Torneo FROM dbo.Inscripcion i JOIN dbo.Equipo e ON e.EquipoId=i.EquipoId JOIN dbo.Torneo t ON t.TorneoId=i.TorneoId ORDER BY t.Nombre,e.Nombre;
    SELECT p.*,t.Nombre AS Torneo,t.VideojuegoId,v.Nombre AS Videojuego,v.TipoEstadistica,
      (SELECT STRING_AGG(e.Nombre,N' · ') FROM dbo.EquipoPartida ep JOIN dbo.Equipo e ON e.EquipoId=ep.EquipoId WHERE ep.PartidaId=p.PartidaId) AS Equipos
      FROM dbo.Partida p JOIN dbo.Torneo t ON t.TorneoId=p.TorneoId JOIN dbo.Videojuego v ON v.VideojuegoId=t.VideojuegoId ORDER BY p.FechaHora DESC;
    SELECT a.*,j.PrimerNombre,j.Apellido,j.Alias,e.Nombre AS Equipo FROM dbo.AlineacionPartida a JOIN dbo.Jugador j ON j.JugadorId=a.JugadorId JOIN dbo.Equipo e ON e.EquipoId=a.EquipoId ORDER BY e.Nombre,a.Cupo;
    SELECT * FROM dbo.vw_ResultadosKDA ORDER BY PartidaId,Equipo,JugadorId;
    SELECT * FROM dbo.vw_ResultadosCarrera ORDER BY PartidaId,Posicion;`);
  const names = ['categorias','videojuegos','equipos','jugadores','torneos','inscripciones','partidas','alineaciones','kda','carreras'];
  return Object.fromEntries(names.map((key,index) => [key,result.recordsets[index]]));
}

async function api(method, path, body) {
  if (method === 'GET' && path === '/api/salud') {
    await db.query('SELECT 1 AS conectado');
    return {ok:true,mensaje:'SQL Server conectado'};
  }
  if (method === 'GET' && path === '/api/estado') return state();
  let match;
  if (method === 'POST' && path === '/api/equipos') {
    return idResult(await db.query('INSERT dbo.Equipo(Nombre,VideojuegoId) OUTPUT inserted.EquipoId VALUES(@nombre,@juego)',{
      nombre:str(v.text(body.nombre,'Nombre del equipo',80),80),juego:int(v.integer(body.videojuegoId,'Videojuego'))}));
  }
  if (method === 'PUT' && (match = path.match(/^\/api\/equipos\/(\d+)$/))) {
    const result = await db.query('UPDATE dbo.Equipo SET Nombre=@nombre WHERE EquipoId=@id; SELECT @@ROWCOUNT AS Cambios',{
      nombre:str(v.text(body.nombre,'Nombre del equipo',80),80),id:int(v.integer(match[1],'Equipo'))});
    if (!result.recordset[0].Cambios) notFound();
    return {ok:true};
  }
  if (method === 'POST' && (match = path.match(/^\/api\/equipos\/(\d+)\/retirar$/))) {
    await db.query('EXEC dbo.usp_RetirarEquipo @EquipoId=@id',{id:int(v.integer(match[1],'Equipo'))});
    return {ok:true};
  }
  if ((method === 'POST' && path === '/api/jugadores') || (method === 'PUT' && (match = path.match(/^\/api\/jugadores\/(\d+)$/)))) {
    const equipo = v.optionalId(body.equipoId);
    const params = {nombre:str(v.text(body.primerNombre,'Primer nombre',50),50),apellido:str(v.text(body.apellido,'Apellido',50),50),
      alias:str(v.text(body.alias,'Alias',50),50),equipo:int(equipo),cupo:int(equipo === null ? null : v.integer(body.cupo,'Cupo',1,5))};
    if (method === 'PUT') params.id = int(v.integer(match[1],'Jugador'));
    return db.transaction(async query => {
      if (equipo !== null && !(await query(`SELECT e.EquipoId FROM dbo.Equipo e WHERE e.EquipoId=@equipo
        AND (e.Activo=1 OR EXISTS(SELECT 1 FROM dbo.Jugador j WHERE j.JugadorId=@jugador AND j.EquipoId=e.EquipoId))`,
        {equipo:int(equipo),jugador:int(method==='PUT'?Number(match[1]):null)})).recordset.length)
        throw new v.HttpError(400,'El equipo no existe o está retirado.');
      const result = await query(method === 'POST'
        ? 'INSERT dbo.Jugador(PrimerNombre,Apellido,Alias,EquipoId,Cupo) OUTPUT inserted.JugadorId VALUES(@nombre,@apellido,@alias,@equipo,@cupo)'
        : 'UPDATE dbo.Jugador SET PrimerNombre=@nombre,Apellido=@apellido,Alias=@alias,EquipoId=@equipo,Cupo=@cupo OUTPUT inserted.JugadorId WHERE JugadorId=@id',params);
      if (!result.recordset.length) notFound();
      return idResult(result);
    });
  }
  if (method === 'POST' && path === '/api/torneos') {
    const inicio = v.date(body.fechaInicio,'Fecha de inicio'), fin = v.date(body.fechaFin,'Fecha de fin');
    if (fin < inicio) throw new v.HttpError(400,'La fecha de fin no puede ser anterior al inicio.');
    return idResult(await db.query(`INSERT dbo.Torneo(Nombre,VideojuegoId,FechaInicio,FechaFin)
      OUTPUT inserted.TorneoId VALUES(@nombre,@juego,CONVERT(date,@inicio,23),CONVERT(date,@fin,23))`,{
      nombre:str(v.text(body.nombre,'Nombre del torneo',100)),juego:int(v.integer(body.videojuegoId,'Videojuego')),inicio:str(inicio,10),fin:str(fin,10)}));
  }
  if (method === 'PATCH' && (match = path.match(/^\/api\/torneos\/(\d+)\/estado$/))) {
    const result = await db.query('UPDATE dbo.Torneo SET Estado=@estado WHERE TorneoId=@id; SELECT @@ROWCOUNT AS Cambios',{
      estado:str(v.choice(body.estado,['INSCRIPCION','EN_CURSO','FINALIZADO','CANCELADO'],'Estado'),12),id:int(v.integer(match[1],'Torneo'))});
    if (!result.recordset[0].Cambios) notFound();
    return {ok:true};
  }
  if (method === 'POST' && path === '/api/inscripciones') {
    await db.transaction(query => query('EXEC dbo.usp_InscribirEquipo @TorneoId=@torneo,@EquipoId=@equipo',{
      torneo:int(v.integer(body.torneoId,'Torneo')),equipo:int(v.integer(body.equipoId,'Equipo'))}));
    return {ok:true};
  }
  if (method === 'PATCH' && path === '/api/inscripciones/retirar') {
    const result = await db.query("UPDATE dbo.Inscripcion SET Estado='RETIRADO' WHERE TorneoId=@torneo AND EquipoId=@equipo; SELECT @@ROWCOUNT AS Cambios",{
      torneo:int(v.integer(body.torneoId,'Torneo')),equipo:int(v.integer(body.equipoId,'Equipo'))});
    if (!result.recordset[0].Cambios) notFound();
    return {ok:true};
  }
  if (method === 'POST' && path === '/api/partidas') {
    const torneo = v.integer(body.torneoId,'Torneo');
    const nombre = v.text(body.nombre,'Nombre de la partida',100), fecha = v.datetime(body.fechaHora);
    if (!Array.isArray(body.equipoIds)) throw new v.HttpError(400,'Selecciona los equipos participantes.');
    const equipos = [...new Set(body.equipoIds.map(id => v.integer(id,'Equipo')))];
    if (equipos.length < 2 || equipos.length > 50) throw new v.HttpError(400,'Selecciona al menos dos equipos, y como máximo cincuenta.');
    return db.transaction(async query => {
      const tournaments = await query(`SELECT t.Estado,v.TipoEstadistica FROM dbo.Torneo t JOIN dbo.Videojuego v ON v.VideojuegoId=t.VideojuegoId WHERE t.TorneoId=@torneo`,{torneo:int(torneo)});
      if (!tournaments.recordset.length) notFound();
      const t = tournaments.recordset[0];
      if (['CANCELADO','FINALIZADO'].includes(t.Estado)) throw new v.HttpError(400,'El torneo ya está cerrado.');
      if (t.TipoEstadistica === 'KDA' && equipos.length !== 2) throw new v.HttpError(400,'Para este videojuego selecciona exactamente dos equipos.');
      const partida = idResult(await query(`INSERT dbo.Partida(TorneoId,Nombre,FechaHora) OUTPUT inserted.PartidaId VALUES(@torneo,@nombre,CONVERT(datetime2,@fecha,126))`,{
        torneo:int(torneo),nombre:str(nombre),fecha:str(fecha+':00',19)})).PartidaId;
      for (const equipo of equipos) {
        const params = {torneo:int(torneo),equipo:int(equipo),partida:int(partida)};
        const inscritos = await query(`SELECT i.EquipoId FROM dbo.Inscripcion i JOIN dbo.Equipo e ON e.EquipoId=i.EquipoId
          WHERE i.TorneoId=@torneo AND i.EquipoId=@equipo AND i.Estado='INSCRITO' AND e.Activo=1`,{torneo:params.torneo,equipo:params.equipo});
        if (!inscritos.recordset.length) throw new v.HttpError(400,'Todos los equipos deben estar activos e inscritos en el torneo.');
        if (!(await query('SELECT JugadorId FROM dbo.Jugador WHERE EquipoId=@equipo',{equipo:params.equipo})).recordset.length)
          throw new v.HttpError(400,'Cada equipo necesita al menos un jugador.');
        await query('INSERT dbo.EquipoPartida(PartidaId,EquipoId,TorneoId) VALUES(@partida,@equipo,@torneo)',params);
        await query(`INSERT dbo.AlineacionPartida(PartidaId,JugadorId,EquipoId,Cupo)
          SELECT @partida,JugadorId,EquipoId,Cupo FROM dbo.Jugador WHERE EquipoId=@equipo`,{partida:params.partida,equipo:params.equipo});
      }
      return {PartidaId:partida};
    });
  }
  if (method === 'PATCH' && (match = path.match(/^\/api\/partidas\/(\d+)\/estado$/))) {
    const result = await db.query('UPDATE dbo.Partida SET Estado=@estado WHERE PartidaId=@id; SELECT @@ROWCOUNT AS Cambios',{
      estado:str(v.choice(body.estado,['PROGRAMADA','EN_CURSO','FINALIZADA','CANCELADA'],'Estado'),12),id:int(v.integer(match[1],'Partida'))});
    if (!result.recordset[0].Cambios) notFound();
    return {ok:true};
  }
  if (method === 'PUT' && (path === '/api/resultados/kda' || path === '/api/resultados/carrera')) {
    const params = {partida:int(v.integer(body.partidaId,'Partida')),jugador:int(v.integer(body.jugadorId,'Jugador'))};
    if (path.endsWith('/kda')) {
      params.asesinatos=int(v.integer(body.asesinatos,'Asesinatos',0,1000000));
      params.muertes=int(v.integer(body.muertes,'Muertes',0,1000000));
      params.asistencias=int(v.integer(body.asistencias,'Asistencias',0,1000000));
      await db.transaction(query => query(`IF EXISTS(SELECT 1 FROM dbo.EstadisticaKDA WHERE PartidaId=@partida AND JugadorId=@jugador)
        UPDATE dbo.EstadisticaKDA SET Asesinatos=@asesinatos,Muertes=@muertes,Asistencias=@asistencias,FechaRegistro=SYSDATETIME(),RegistradoPor=ORIGINAL_LOGIN() WHERE PartidaId=@partida AND JugadorId=@jugador;
        ELSE INSERT dbo.EstadisticaKDA(PartidaId,JugadorId,Asesinatos,Muertes,Asistencias) VALUES(@partida,@jugador,@asesinatos,@muertes,@asistencias);`,params));
    } else {
      params.posicion=int(v.integer(body.posicion,'Posición',1,32767));
      params.tiempo={type:sql.BigInt,value:v.integer(body.tiempoMilisegundos,'Tiempo en milisegundos',1)};
      params.vueltas=int(v.integer(body.vueltas,'Vueltas',1,32767));
      await db.transaction(query => query(`IF EXISTS(SELECT 1 FROM dbo.ResultadoCarrera WHERE PartidaId=@partida AND JugadorId=@jugador)
        UPDATE dbo.ResultadoCarrera SET Posicion=@posicion,TiempoMilisegundos=@tiempo,Vueltas=@vueltas,FechaRegistro=SYSDATETIME(),RegistradoPor=ORIGINAL_LOGIN() WHERE PartidaId=@partida AND JugadorId=@jugador;
        ELSE INSERT dbo.ResultadoCarrera(PartidaId,JugadorId,Posicion,TiempoMilisegundos,Vueltas) VALUES(@partida,@jugador,@posicion,@tiempo,@vueltas);`,params));
    }
    return {ok:true};
  }
  throw new v.HttpError(404,'Esta ruta no existe.');
}
module.exports = {api,state};
