@echo off
setlocal
cd /d "%~dp0backend"
where node >nul 2>nul
if errorlevel 1 (
 echo Instala Node.js 24 o superior para Windows x64 y vuelve a abrir este archivo.
 pause
 exit /b 1
)
echo Preparando la base del proyecto. No se cargaran datos de ejemplo.
echo SQL Server debe estar instalado y en ejecucion antes de continuar.
if not exist "node_modules\express\package.json" goto instalar
if not exist "node_modules\msnodesqlv8\package.json" goto instalar
goto preparar
:instalar
echo Instalando dependencias del backend. Se necesita acceso a Internet...
call npm ci --no-audit --no-fund
if errorlevel 1 (
 pause
 exit /b 1
)
:preparar
call npm run setup
pause
