@echo off
setlocal
cd /d "%~dp0backend"
where node >nul 2>nul
if errorlevel 1 (
 echo Instala Node.js 24 o superior para Windows x64 y vuelve a abrir este archivo.
 pause
 exit /b 1
)
if not exist "node_modules\express\package.json" goto instalar_backend
if not exist "node_modules\msnodesqlv8\package.json" goto instalar_backend
goto preparar_front
:instalar_backend
echo Instalando dependencias de Node.js y Express...
call npm ci --no-audit --no-fund
if errorlevel 1 goto error
:preparar_front
cd /d "%~dp0front"
if not exist "node_modules\react\package.json" goto instalar_front
if not exist "node_modules\vite\package.json" goto instalar_front
if not exist "node_modules\@vitejs\plugin-react\package.json" goto instalar_front
goto compilar_front
:instalar_front
echo Instalando React y Vite...
call npm ci --no-audit --no-fund
if errorlevel 1 goto error
:compilar_front
echo Compilando el front React con Vite...
call npm run build
if errorlevel 1 goto error
cd /d "%~dp0backend"
echo Abre http://127.0.0.1:3000 cuando el servidor indique que esta listo.
echo Deja esta ventana abierta. Ctrl+C detiene la aplicacion.
call npm start
pause
exit /b
:error
echo No se pudo preparar la aplicacion. Revisa el mensaje anterior.
pause
exit /b 1
