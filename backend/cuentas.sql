DECLARE @bloqueo int;
EXEC @bloqueo = sys.sp_getapplock
  @Resource = 'Arena.CuentaArena',
  @LockMode = 'Exclusive',
  @LockOwner = 'Transaction',
  @LockTimeout = 10000;

IF @bloqueo < 0 THROW 50001, 'No se pudo preparar la tabla de cuentas de Arena.', 1;

IF OBJECT_ID(N'dbo.CuentaArena', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CuentaArena (
    Usuario varchar(32) NOT NULL CONSTRAINT PK_CuentaArena PRIMARY KEY,
    Rol varchar(7) NOT NULL CONSTRAINT CK_CuentaArena_Rol CHECK (Rol IN ('ADMIN', 'JUGADOR')),
    Sal char(32) NOT NULL,
    ClaveHash char(128) NOT NULL
  );

  CREATE UNIQUE INDEX UX_CuentaArena_Admin ON dbo.CuentaArena(Rol) WHERE Rol = 'ADMIN';
END;
