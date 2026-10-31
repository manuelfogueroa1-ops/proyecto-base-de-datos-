# Arena · React + Vite, Node.js + Express y SQL Server

Plataforma local para equipos de hasta cinco jugadores, torneos, inscripciones, partidas, estadísticas KDA y resultados de carreras.

## Tecnologías implementadas

| Capa | Tecnología | Archivos principales |
| --- | --- | --- |
| Frontend | React, JavaScript JSX y Vite | `front/src/App.jsx`, `front/src/pages.jsx`, `front/src/components.jsx`, `front/vite.config.js` |
| Backend | Node.js y Express | `backend/app.js`, `backend/server.js`, `backend/api.js` |
| Base de datos | SQL Server y T-SQL | `01_crear_base_datos.sql`, `backend/db.js` |

Los formularios son componentes React con estado y eventos. Vite compila la interfaz y Express entrega el resultado y atiende la API. Los datos se guardan en SQL Server; no se utiliza almacenamiento simulado en el navegador.

## Usar en este computador

Abre **iniciar.cmd**, espera que el servidor esté listo y entra a **http://127.0.0.1:3000**. El iniciador instala las dependencias que falten en ambas carpetas, compila el front con Vite e inicia Express. Deja su ventana abierta; Ctrl+C detiene el servidor.

## Preparar el computador de un compañero

1. Tener Windows x64, Node.js 24 o superior x64, SQL Server 2017 o superior (Express sirve) y Microsoft ODBC Driver 18 x64.
2. Copiar el proyecto. Se pueden excluir `backend/node_modules`, `front/node_modules`, `front/dist`, la configuración local `.env` y los logs. Conservar ambos `package-lock.json` y `backend/.env.example`.
3. Si su instancia no se llama `SQLEXPRESS`, copiar `backend/.env.example` como `backend/.env` y ajustar `DB_SERVER`.
4. Ejecutar **instalar_base.cmd** una vez para crear `PlataformaTorneosVideojuegos`. Su cuenta Windows debe tener permiso para crear la base.
5. Ejecutar **iniciar.cmd** y abrir la dirección mostrada. La primera instalación de dependencias requiere Internet.

Cada computador tendrá una base independiente. Copiar los archivos no copia la base instalada ni sincroniza los datos. La aplicación no carga equipos, jugadores ni torneos de ejemplo.

## Archivos importantes de la raíz

| Archivo | Función |
| --- | --- |
| `iniciar.cmd` | Instala dependencias faltantes, compila React con Vite e inicia Express. |
| `instalar_base.cmd` | Prepara la base en otro computador, sin demostraciones ni borrados. |
| `01_crear_base_datos.sql` | Diseño completo de SQL Server; necesario para instalar la base. |
| `GUIA_APLICACION.md` | Manual de uso, instalación, desarrollo y API. |
| `modelo_relacional.md` | Modelo y explicación académica del diseño. |
| `README.md` | Resumen del proyecto. |
| `.gitignore` | Excluye dependencias, compilaciones, configuración local y logs de Git. |

## Para desarrollar

Después de instalar dependencias en ambas carpetas, abre dos terminales:

- En `backend`: `npm start` inicia Express y la conexión a SQL Server en el puerto 3000.
- En `front`: `npm run dev` inicia Vite en http://127.0.0.1:5173 con recarga de React y proxy `/api` hacia Express.

Para el uso habitual, basta `iniciar.cmd`. Si solo ejecutas `npm start` en backend, primero debe existir un build actualizado de `front` generado con `npm run build`.

[Guía completa](GUIA_APLICACION.md) · [Modelo relacional](modelo_relacional.md)
