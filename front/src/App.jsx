import { useCallback, useEffect, useRef, useState } from 'react';
import { ArenaContext } from './context.js';
import { request } from './api.js';
import { Dashboard, Equipos, Jugadores, Torneos, Inscripciones, Partidas, Resultados } from './pages.jsx';

const pages = {
  resumen: ['◫','Resumen','Una vista de tu competencia.',Dashboard],
  equipos: ['♜','Equipos','Crea equipos y organiza hasta cinco integrantes por plantilla.',Equipos],
  jugadores: ['♙','Jugadores','Registra participantes, corrige sus datos y asigna sus equipos.',Jugadores],
  torneos: ['♕','Torneos','Organiza competencias para cada videojuego.',Torneos],
  inscripciones: ['⊞','Inscripciones','Inscribe equipos en los torneos de su videojuego.',Inscripciones],
  partidas: ['⚑','Partidas','Programa enfrentamientos y conserva sus alineaciones.',Partidas],
  resultados: ['▥','Resultados','Ingresa o corrige las estadísticas de las partidas finalizadas.',Resultados],
};
const currentPage = () => Object.hasOwn(pages, location.hash.slice(1)) ? location.hash.slice(1) : 'resumen';
export default function App() {
  const [page, setPage] = useState(currentPage), [data, setData] = useState(null), [online, setOnline] = useState(null);
  const [error, setError] = useState(''), [pending, setPending] = useState(false), [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const notify = useCallback((message, isError = false) => {
    clearTimeout(toastTimer.current); setToast({message, isError});
    toastTimer.current = setTimeout(() => setToast(null), 5500);
  }, []);
  const refresh = useCallback(async () => {
    try {const result = await request('/api/estado'); setData(result); setOnline(true); setError('');}
    catch (problem) {setOnline(false); setError(problem.message); throw problem;}
  }, []);
  const mutate = async (path, method, body) => {
    setPending(true);
    try {const result = await request(path, method, body); await refresh(); notify('Cambios guardados correctamente.'); return result;}
    finally {setPending(false);}
  };
  useEffect(() => {
    const navigate = () => setPage(currentPage());
    window.addEventListener('hashchange', navigate);
    refresh().catch(() => {});
    return () => {window.removeEventListener('hashchange', navigate); clearTimeout(toastTimer.current);};
  }, [refresh]);
  const [, title, description, Page] = pages[page];
  useEffect(() => {document.title = `${title} · Arena`;}, [title]);
  async function reload() {try {await refresh(); notify('Datos actualizados.');} catch (problem) {notify(problem.message, true);}}
  return <ArenaContext.Provider value={{data, refresh, mutate, pending, notify}}>
    <aside className="sidebar">
      <a className="brand" href="#resumen"><span className="brand-mark">A<span>↗</span></span><span>arena<span className="brand-sub">TOURNAMENT MANAGER</span></span></a>
      <div className="workspace"><span className="workspace-icon">⌘</span><div>Mi plataforma<small>Espacio de administración</small></div><span className="workspace-dot" /></div>
      <p className="nav-label">GESTIONAR</p>
      <nav aria-label="Navegación principal">{Object.entries(pages).map(([key, [icon, label]]) => <a key={key} href={`#${key}`} className={page === key ? 'active' : ''} aria-current={page === key ? 'page' : undefined} title={label}><span className="nav-icon" aria-hidden="true">{icon}</span><span>{label}</span>{page === key && <span className="nav-arrow">›</span>}</a>)}</nav>
      <div className="sidebar-bottom"><div className="local-tag"><i /> ENTORNO LOCAL</div><p>Tu competencia.<br />Todos los datos, en un lugar.</p><div className="admin-avatar"><span>AD</span><div>Administrador<small>Gestión de la plataforma</small></div></div></div>
    </aside>
    <div className="shell">
      <header className="topbar"><div className="breadcrumb">Mi plataforma <span>/</span> <strong>{title}</strong></div><button className="connection" type="button" onClick={reload} title="Actualizar los datos" disabled={pending}><i className={online === null ? '' : online ? 'online' : 'offline'} /><span>{online === null ? 'Conectando…' : online ? 'Base de datos conectada' : 'Sin conexión'}</span><span className="refresh-icon">↻</span></button></header>
      <main tabIndex="-1">{!data ? error ? <section className="error-page"><p className="eyebrow">CONEXIÓN</p><h1>No pudimos cargar tu plataforma</h1><p>{error}</p><button className="button" onClick={reload}>Volver a intentar</button></section> : <div className="loading">Conectando con tu plataforma…</div> : <>
        <div className="page-heading"><div><div className="eyebrow">CENTRO DE COMPETENCIA</div><h1>{title}</h1><p>{description}</p></div>{page === 'resumen' ? <span className="date">{new Intl.DateTimeFormat('es-CL', {day:'numeric', month:'long', year:'numeric'}).format(new Date())}</span> : <span className="state-pill">Panel de administración</span>}</div>
        <Page key={page} />
      </>}</main>
      <footer>Arena <span>Gestión de torneos de videojuegos</span><span>Proyecto de base de datos · 2026</span></footer>
    </div>
    {toast && <div id="toast" role="status" aria-live="polite" className={toast.isError ? 'error' : ''}>{toast.message}</div>}
  </ArenaContext.Provider>;
}
