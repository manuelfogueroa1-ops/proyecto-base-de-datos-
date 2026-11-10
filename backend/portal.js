'use strict';
const db = require('./db');

async function portal() {
  const {recordsets} = await db.query(`
    SELECT CategoriaId, Nombre
    FROM dbo.Categoria ORDER BY Nombre;

    SELECT VideojuegoId, CategoriaId, Nombre, TipoEstadistica
    FROM dbo.Videojuego ORDER BY Nombre;

    SELECT resumen.TorneoId, torneo.VideojuegoId, resumen.Torneo AS Nombre,
           resumen.FechaInicio, resumen.FechaFin, resumen.Estado, resumen.EquiposInscritos
    FROM dbo.vw_ResumenTorneos resumen
    JOIN dbo.Torneo torneo ON torneo.TorneoId = resumen.TorneoId
    ORDER BY resumen.FechaInicio, resumen.Torneo, resumen.TorneoId;

    SELECT EquipoId, VideojuegoId, Nombre, Activo
    FROM dbo.Equipo ORDER BY Nombre;

    SELECT JugadorId, EquipoId, Alias, Cupo
    FROM dbo.Jugador WHERE EquipoId IS NOT NULL
    ORDER BY EquipoId, Cupo;

    SELECT p.PartidaId, p.TorneoId, p.Nombre, p.FechaHora, ep.EquipoId, e.Nombre AS Equipo
    FROM dbo.Partida p
    JOIN dbo.EquipoPartida ep ON ep.PartidaId = p.PartidaId
    JOIN dbo.Equipo e ON e.EquipoId = ep.EquipoId
    WHERE p.Estado = 'FINALIZADA'
    ORDER BY p.FechaHora DESC, p.PartidaId DESC, ep.EquipoId;

    SELECT k.PartidaId, a.EquipoId, k.JugadorId, k.Alias,
           k.Asesinatos, k.Muertes, k.Asistencias, k.KDA
    FROM dbo.vw_ResultadosKDA k
    JOIN dbo.AlineacionPartida a ON a.PartidaId = k.PartidaId AND a.JugadorId = k.JugadorId
    ORDER BY k.PartidaId, a.EquipoId, k.KDA DESC, k.JugadorId;

    SELECT r.PartidaId, a.EquipoId, r.JugadorId, r.Alias,
           r.Posicion, r.TiempoMilisegundos, r.Vueltas
    FROM dbo.vw_ResultadosCarrera r
    JOIN dbo.AlineacionPartida a ON a.PartidaId = r.PartidaId AND a.JugadorId = r.JugadorId
    ORDER BY r.PartidaId, r.Posicion;`);
  const [categorias, videojuegos, torneos, equipos, jugadores, partidas, kda, carreras] = recordsets;
  return {categorias, videojuegos, torneos, equipos, jugadores, partidas, kda, carreras};
}

module.exports = {portal};
