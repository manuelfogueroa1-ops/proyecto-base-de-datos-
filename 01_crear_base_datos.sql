/* PROYECTO: PLATAFORMA DE TORNEOS DE VIDEOJUEGOS
   Ejecutar completo en SSMS (F5). No elimina ninguna base existente.
   Motor: SQL Server 2016 SP1 o superior; probado en el motor indicado en README.
   SSMS es la aplicación cliente; SQL Server almacena la base de datos.
*/
USE master;
GO
IF DB_ID(N'PlataformaTorneosVideojuegos') IS NULL
    EXEC(N'CREATE DATABASE PlataformaTorneosVideojuegos COLLATE Latin1_General_100_CI_AI');
GO
USE PlataformaTorneosVideojuegos;
GO
SET XACT_ABORT ON;
SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;
GO
-- Instalación transaccional: si ya está instalada, omite las tablas y catálogos.
IF OBJECT_ID(N'dbo.Categoria', N'U') IS NULL
BEGIN
 BEGIN TRY
 BEGIN TRANSACTION;
 CREATE TABLE dbo.Categoria (
    CategoriaId int IDENTITY CONSTRAINT PK_Categoria PRIMARY KEY,
    Nombre nvarchar(40) NOT NULL CONSTRAINT UQ_Categoria_Nombre UNIQUE,
    CONSTRAINT CK_Categoria_Nombre CHECK (LEN(LTRIM(RTRIM(Nombre))) > 0)
 );
 CREATE TABLE dbo.Videojuego (
    VideojuegoId int IDENTITY CONSTRAINT PK_Videojuego PRIMARY KEY,
    CategoriaId int NOT NULL CONSTRAINT FK_Videojuego_Categoria REFERENCES dbo.Categoria,
    Nombre nvarchar(80) NOT NULL CONSTRAINT UQ_Videojuego_Nombre UNIQUE,
    TipoEstadistica varchar(10) NOT NULL,
    CONSTRAINT CK_Videojuego_Tipo CHECK (TipoEstadistica IN ('KDA','CARRERA')),
    CONSTRAINT CK_Videojuego_Nombre CHECK (LEN(LTRIM(RTRIM(Nombre))) > 0)
 );
 CREATE TABLE dbo.Equipo (
    EquipoId int IDENTITY CONSTRAINT PK_Equipo PRIMARY KEY,
    VideojuegoId int NOT NULL CONSTRAINT FK_Equipo_Videojuego REFERENCES dbo.Videojuego,
    Nombre nvarchar(80) NOT NULL CONSTRAINT UQ_Equipo_Nombre UNIQUE,
    Activo bit NOT NULL CONSTRAINT DF_Equipo_Activo DEFAULT 1,
    FechaCreacion datetime2(0) NOT NULL CONSTRAINT DF_Equipo_Fecha DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_Equipo_Juego UNIQUE (EquipoId, VideojuegoId),
    CONSTRAINT CK_Equipo_Nombre CHECK (LEN(LTRIM(RTRIM(Nombre))) > 0)
 );
 CREATE TABLE dbo.Jugador (
    JugadorId int IDENTITY CONSTRAINT PK_Jugador PRIMARY KEY,
    PrimerNombre nvarchar(50) NOT NULL,
    Apellido nvarchar(50) NOT NULL,
    Alias nvarchar(50) NOT NULL CONSTRAINT UQ_Jugador_Alias UNIQUE,
    EquipoId int NULL CONSTRAINT FK_Jugador_Equipo REFERENCES dbo.Equipo,
    Cupo tinyint NULL,
    CONSTRAINT UQ_Jugador_NombreApellido UNIQUE (PrimerNombre, Apellido),
    CONSTRAINT CK_Jugador_Textos CHECK (LEN(LTRIM(RTRIM(PrimerNombre))) > 0
        AND LEN(LTRIM(RTRIM(Apellido))) > 0 AND LEN(LTRIM(RTRIM(Alias))) > 0),
    CONSTRAINT CK_Jugador_Cupo CHECK (
        (EquipoId IS NULL AND Cupo IS NULL) OR
        (EquipoId IS NOT NULL AND Cupo IS NOT NULL AND Cupo BETWEEN 1 AND 5))
 );
 -- Cinco cupos únicos por equipo: garantiza el máximo incluso con inserciones simultáneas.
 CREATE UNIQUE INDEX UX_Jugador_EquipoCupo ON dbo.Jugador(EquipoId,Cupo)
    WHERE EquipoId IS NOT NULL;
 CREATE TABLE dbo.Torneo (
    TorneoId int IDENTITY CONSTRAINT PK_Torneo PRIMARY KEY,
    VideojuegoId int NOT NULL CONSTRAINT FK_Torneo_Videojuego REFERENCES dbo.Videojuego,
    Nombre nvarchar(100) NOT NULL,
    FechaInicio date NOT NULL,
    FechaFin date NOT NULL,
    Estado varchar(12) NOT NULL CONSTRAINT DF_Torneo_Estado DEFAULT 'INSCRIPCION',
    CONSTRAINT UQ_Torneo_Nombre UNIQUE(VideojuegoId,Nombre),
    CONSTRAINT UQ_Torneo_Juego UNIQUE(TorneoId,VideojuegoId),
    CONSTRAINT CK_Torneo_Fechas CHECK(FechaFin >= FechaInicio),
    CONSTRAINT CK_Torneo_Nombre CHECK(LEN(LTRIM(RTRIM(Nombre))) > 0),
    CONSTRAINT CK_Torneo_Estado CHECK(Estado IN ('INSCRIPCION','EN_CURSO','FINALIZADO','CANCELADO'))
 );
 CREATE TABLE dbo.Inscripcion (
    TorneoId int NOT NULL,
    EquipoId int NOT NULL,
    VideojuegoId int NOT NULL,
    FechaInscripcion datetime2(0) NOT NULL CONSTRAINT DF_Inscripcion_Fecha DEFAULT SYSDATETIME(),
    Estado varchar(10) NOT NULL CONSTRAINT DF_Inscripcion_Estado DEFAULT 'INSCRITO',
    CONSTRAINT PK_Inscripcion PRIMARY KEY(TorneoId,EquipoId),
    CONSTRAINT FK_Inscripcion_Torneo FOREIGN KEY(TorneoId,VideojuegoId)
        REFERENCES dbo.Torneo(TorneoId,VideojuegoId),
    CONSTRAINT FK_Inscripcion_Equipo FOREIGN KEY(EquipoId,VideojuegoId)
        REFERENCES dbo.Equipo(EquipoId,VideojuegoId),
    CONSTRAINT CK_Inscripcion_Estado CHECK(Estado IN ('INSCRITO','RETIRADO'))
 );
 CREATE TABLE dbo.Partida (
    PartidaId int IDENTITY CONSTRAINT PK_Partida PRIMARY KEY,
    TorneoId int NOT NULL CONSTRAINT FK_Partida_Torneo REFERENCES dbo.Torneo,
    Nombre nvarchar(100) NOT NULL,
    FechaHora datetime2(0) NOT NULL,
    Estado varchar(12) NOT NULL CONSTRAINT DF_Partida_Estado DEFAULT 'PROGRAMADA',
    CONSTRAINT UQ_Partida_Torneo UNIQUE(PartidaId,TorneoId),
    CONSTRAINT CK_Partida_Nombre CHECK(LEN(LTRIM(RTRIM(Nombre))) > 0),
    CONSTRAINT CK_Partida_Estado CHECK(Estado IN ('PROGRAMADA','EN_CURSO','FINALIZADA','CANCELADA'))
 );
 CREATE TABLE dbo.EquipoPartida (
    PartidaId int NOT NULL,
    EquipoId int NOT NULL,
    TorneoId int NOT NULL,
    CONSTRAINT PK_EquipoPartida PRIMARY KEY(PartidaId,EquipoId),
    CONSTRAINT FK_EquipoPartida_Partida FOREIGN KEY(PartidaId,TorneoId)
        REFERENCES dbo.Partida(PartidaId,TorneoId),
    CONSTRAINT FK_EquipoPartida_Inscripcion FOREIGN KEY(TorneoId,EquipoId)
        REFERENCES dbo.Inscripcion(TorneoId,EquipoId)
 );
 CREATE TABLE dbo.AlineacionPartida (
    PartidaId int NOT NULL,
    JugadorId int NOT NULL CONSTRAINT FK_Alineacion_Jugador REFERENCES dbo.Jugador,
    EquipoId int NOT NULL,
    Cupo tinyint NOT NULL,
    CONSTRAINT PK_AlineacionPartida PRIMARY KEY(PartidaId,JugadorId),
    CONSTRAINT UQ_Alineacion_Cupo UNIQUE(PartidaId,EquipoId,Cupo),
    CONSTRAINT FK_Alineacion_EquipoPartida FOREIGN KEY(PartidaId,EquipoId)
        REFERENCES dbo.EquipoPartida(PartidaId,EquipoId),
    CONSTRAINT CK_Alineacion_Cupo CHECK(Cupo BETWEEN 1 AND 5)
 );
 CREATE TABLE dbo.EstadisticaKDA (
    PartidaId int NOT NULL,
    JugadorId int NOT NULL,
    Asesinatos int NOT NULL,
    Muertes int NOT NULL,
    Asistencias int NOT NULL,
    KDA AS CONVERT(decimal(12,2),
        (CONVERT(decimal(19,4),Asesinatos)+Asistencias) /
        CASE WHEN Muertes = 0 THEN 1 ELSE Muertes END) PERSISTED,
    FechaRegistro datetime2(0) NOT NULL CONSTRAINT DF_KDA_Fecha DEFAULT SYSDATETIME(),
    RegistradoPor sysname NOT NULL CONSTRAINT DF_KDA_Usuario DEFAULT ORIGINAL_LOGIN(),
    CONSTRAINT PK_EstadisticaKDA PRIMARY KEY(PartidaId,JugadorId),
    CONSTRAINT FK_KDA_Alineacion FOREIGN KEY(PartidaId,JugadorId)
        REFERENCES dbo.AlineacionPartida(PartidaId,JugadorId),
    CONSTRAINT CK_KDA_NoNegativo CHECK(Asesinatos BETWEEN 0 AND 1000000
        AND Muertes BETWEEN 0 AND 1000000 AND Asistencias BETWEEN 0 AND 1000000)
 );
 CREATE TABLE dbo.ResultadoCarrera (
    PartidaId int NOT NULL,
    JugadorId int NOT NULL,
    Posicion smallint NOT NULL,
    TiempoMilisegundos bigint NOT NULL,
    Vueltas smallint NOT NULL,
    FechaRegistro datetime2(0) NOT NULL CONSTRAINT DF_Carrera_Fecha DEFAULT SYSDATETIME(),
    RegistradoPor sysname NOT NULL CONSTRAINT DF_Carrera_Usuario DEFAULT ORIGINAL_LOGIN(),
    CONSTRAINT PK_ResultadoCarrera PRIMARY KEY(PartidaId,JugadorId),
    CONSTRAINT UQ_Carrera_Posicion UNIQUE(PartidaId,Posicion),
    CONSTRAINT FK_Carrera_Alineacion FOREIGN KEY(PartidaId,JugadorId)
        REFERENCES dbo.AlineacionPartida(PartidaId,JugadorId),
    CONSTRAINT CK_Carrera_Valores CHECK(Posicion > 0 AND TiempoMilisegundos > 0 AND Vueltas > 0)
 );
 INSERT dbo.Categoria(Nombre) VALUES(N'Shooter'),(N'MOBA'),(N'Conducción');
 INSERT dbo.Videojuego(CategoriaId,Nombre,TipoEstadistica)
 SELECT CategoriaId,N'Valorant','KDA' FROM dbo.Categoria WHERE Nombre=N'Shooter'
 UNION ALL SELECT CategoriaId,N'Counter-Strike','KDA' FROM dbo.Categoria WHERE Nombre=N'Shooter'
 UNION ALL SELECT CategoriaId,N'League of Legends','KDA' FROM dbo.Categoria WHERE Nombre=N'MOBA'
 UNION ALL SELECT CategoriaId,N'Assetto Corsa','CARRERA' FROM dbo.Categoria WHERE Nombre=N'Conducción';
 COMMIT;
 END TRY
 BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
 END CATCH;
END;
GO
CREATE OR ALTER TRIGGER dbo.tr_Alineacion_EquipoActual
ON dbo.AlineacionPartida AFTER INSERT,UPDATE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.Jugador j ON j.JugadorId=i.JugadorId
    WHERE j.EquipoId IS NULL OR j.EquipoId<>i.EquipoId)
    THROW 51001,N'El jugador debe pertenecer al equipo al registrar o corregir la alineación.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.tr_KDA_ValidarPartida
ON dbo.EstadisticaKDA AFTER INSERT,UPDATE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.Partida p ON p.PartidaId=i.PartidaId
 JOIN dbo.Torneo t ON t.TorneoId=p.TorneoId JOIN dbo.Videojuego v ON v.VideojuegoId=t.VideojuegoId
 WHERE p.Estado<>'FINALIZADA' OR v.TipoEstadistica<>'KDA')
    THROW 51002,N'El KDA solo se registra en partidas finalizadas de juegos compatibles.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.tr_Carrera_ValidarPartida
ON dbo.ResultadoCarrera AFTER INSERT,UPDATE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.Partida p ON p.PartidaId=i.PartidaId
 JOIN dbo.Torneo t ON t.TorneoId=p.TorneoId JOIN dbo.Videojuego v ON v.VideojuegoId=t.VideojuegoId
 WHERE p.Estado<>'FINALIZADA' OR v.TipoEstadistica<>'CARRERA')
    THROW 51003,N'Los resultados de carrera requieren una partida finalizada de conducción.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.tr_Partida_ConservarResultados
ON dbo.Partida AFTER UPDATE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM inserted i WHERE i.Estado<>'FINALIZADA' AND
    (EXISTS(SELECT 1 FROM dbo.EstadisticaKDA k WHERE k.PartidaId=i.PartidaId)
    OR EXISTS(SELECT 1 FROM dbo.ResultadoCarrera r WHERE r.PartidaId=i.PartidaId)))
    THROW 51004,N'Una partida con resultados debe permanecer finalizada.',1;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_AsignarJugador
 @JugadorId int, @EquipoId int = NULL, @Cupo tinyint = NULL
AS
BEGIN
 SET NOCOUNT ON;
 SET XACT_ABORT ON;
 -- Equipo NULL deja al jugador sin equipo. Equipo y cupo se actualizan juntos.
 IF NOT EXISTS(SELECT 1 FROM dbo.Jugador WHERE JugadorId=@JugadorId)
    THROW 51005,N'El jugador no existe.',1;
 IF @EquipoId IS NOT NULL AND NOT EXISTS(SELECT 1 FROM dbo.Equipo WHERE EquipoId=@EquipoId AND Activo=1)
    THROW 51006,N'El equipo no existe o está inactivo.',1;
 UPDATE dbo.Jugador SET EquipoId=@EquipoId,Cupo=@Cupo WHERE JugadorId=@JugadorId;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_InscribirEquipo @TorneoId int,@EquipoId int AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @Juego int=(SELECT VideojuegoId FROM dbo.Equipo WHERE EquipoId=@EquipoId AND Activo=1);
 IF @Juego IS NULL THROW 51007,N'El equipo no existe o está inactivo.',1;
 IF NOT EXISTS(SELECT 1 FROM dbo.Torneo WHERE TorneoId=@TorneoId AND Estado='INSCRIPCION')
    THROW 51008,N'El torneo no existe o no tiene inscripciones abiertas.',1;
 IF NOT EXISTS(SELECT 1 FROM dbo.Jugador WHERE EquipoId=@EquipoId)
    THROW 51009,N'El equipo debe tener al menos un jugador.',1;
 INSERT dbo.Inscripcion(TorneoId,EquipoId,VideojuegoId) VALUES(@TorneoId,@EquipoId,@Juego);
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_RegistrarKDA
 @PartidaId int,@JugadorId int,@Asesinatos int,@Muertes int,@Asistencias int AS
BEGIN
 SET NOCOUNT ON;
 INSERT dbo.EstadisticaKDA(PartidaId,JugadorId,Asesinatos,Muertes,Asistencias)
 VALUES(@PartidaId,@JugadorId,@Asesinatos,@Muertes,@Asistencias);
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_RetirarEquipo @EquipoId int AS
BEGIN
 SET NOCOUNT ON;
 SET XACT_ABORT ON;
 BEGIN TRY
 BEGIN TRAN;
 IF NOT EXISTS(SELECT 1 FROM dbo.Equipo WHERE EquipoId=@EquipoId)
    THROW 51010,N'El equipo no existe.',1;
 UPDATE dbo.Equipo SET Activo=0 WHERE EquipoId=@EquipoId;
 UPDATE dbo.Inscripcion SET Estado='RETIRADO' WHERE EquipoId=@EquipoId;
 COMMIT;
 END TRY
 BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK;
 THROW;
 END CATCH;
END;
GO
CREATE OR ALTER VIEW dbo.vw_EquiposJugadores AS
 SELECT e.EquipoId,e.Nombre AS Equipo,v.Nombre AS Videojuego,e.Activo,
 j.JugadorId,j.PrimerNombre,j.Apellido,j.Alias,j.Cupo
 FROM dbo.Equipo e JOIN dbo.Videojuego v ON v.VideojuegoId=e.VideojuegoId
 LEFT JOIN dbo.Jugador j ON j.EquipoId=e.EquipoId;
GO
CREATE OR ALTER VIEW dbo.vw_ResumenTorneos AS
 SELECT t.TorneoId,t.Nombre AS Torneo,v.Nombre AS Videojuego,c.Nombre AS Categoria,
 t.FechaInicio,t.FechaFin,t.Estado,
 (SELECT COUNT(*) FROM dbo.Inscripcion i WHERE i.TorneoId=t.TorneoId AND i.Estado='INSCRITO') AS EquiposInscritos
 FROM dbo.Torneo t JOIN dbo.Videojuego v ON v.VideojuegoId=t.VideojuegoId
 JOIN dbo.Categoria c ON c.CategoriaId=v.CategoriaId;
GO
CREATE OR ALTER VIEW dbo.vw_TorneosValorant AS
 SELECT * FROM dbo.vw_ResumenTorneos WHERE Videojuego=N'Valorant';
GO
CREATE OR ALTER VIEW dbo.vw_TorneosLoL AS
 SELECT * FROM dbo.vw_ResumenTorneos WHERE Videojuego=N'League of Legends';
GO
CREATE OR ALTER VIEW dbo.vw_TorneosCounterStrike AS
 SELECT * FROM dbo.vw_ResumenTorneos WHERE Videojuego=N'Counter-Strike';
GO
CREATE OR ALTER VIEW dbo.vw_TorneosAssettoCorsa AS
 SELECT * FROM dbo.vw_ResumenTorneos WHERE Videojuego=N'Assetto Corsa';
GO
CREATE OR ALTER VIEW dbo.vw_ResultadosKDA AS
 SELECT p.PartidaId,p.Nombre AS Partida,t.Nombre AS Torneo,v.Nombre AS Videojuego,
 e.Nombre AS Equipo,j.JugadorId,j.PrimerNombre,j.Apellido,j.Alias,
 k.Asesinatos,k.Muertes,k.Asistencias,k.KDA,k.FechaRegistro,k.RegistradoPor
 FROM dbo.EstadisticaKDA k JOIN dbo.AlineacionPartida a
 ON a.PartidaId=k.PartidaId AND a.JugadorId=k.JugadorId
 JOIN dbo.Equipo e ON e.EquipoId=a.EquipoId JOIN dbo.Jugador j ON j.JugadorId=k.JugadorId
 JOIN dbo.Partida p ON p.PartidaId=k.PartidaId JOIN dbo.Torneo t ON t.TorneoId=p.TorneoId
 JOIN dbo.Videojuego v ON v.VideojuegoId=t.VideojuegoId;
GO
CREATE OR ALTER VIEW dbo.vw_ResultadosCarrera AS
 SELECT p.PartidaId,p.Nombre AS Carrera,t.Nombre AS Torneo,e.Nombre AS Equipo,
 j.JugadorId,j.PrimerNombre,j.Apellido,j.Alias,r.Posicion,r.TiempoMilisegundos,r.Vueltas
 FROM dbo.ResultadoCarrera r JOIN dbo.AlineacionPartida a
 ON a.PartidaId=r.PartidaId AND a.JugadorId=r.JugadorId
 JOIN dbo.Equipo e ON e.EquipoId=a.EquipoId JOIN dbo.Jugador j ON j.JugadorId=r.JugadorId
 JOIN dbo.Partida p ON p.PartidaId=r.PartidaId JOIN dbo.Torneo t ON t.TorneoId=p.TorneoId;
GO
IF DATABASE_PRINCIPAL_ID(N'AdministradorTorneos') IS NULL
    CREATE ROLE AdministradorTorneos AUTHORIZATION dbo;
GRANT CONTROL ON DATABASE::PlataformaTorneosVideojuegos TO AdministradorTorneos;
-- Usuario demostrable con EXECUTE AS; no puede iniciar sesión por su cuenta.
IF DATABASE_PRINCIPAL_ID(N'AdminProyecto') IS NULL
    CREATE USER AdminProyecto WITHOUT LOGIN;
ALTER ROLE AdministradorTorneos ADD MEMBER AdminProyecto;
-- El propietario de la base ya es dbo y dispone de todos los permisos.
DECLARE @Usuario sysname=USER_NAME();
DECLARE @SQL nvarchar(max);
IF @Usuario<>N'dbo' AND IS_ROLEMEMBER(N'AdministradorTorneos',@Usuario)=0
BEGIN
    SET @SQL=N'ALTER ROLE AdministradorTorneos ADD MEMBER '+QUOTENAME(@Usuario);
    EXEC sys.sp_executesql @SQL;
END;
PRINT N'Base instalada. Inicia la aplicación con iniciar.cmd para ingresar tus datos. El script 02 es opcional y solo carga demostraciones.';
GO
