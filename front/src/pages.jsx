import { useEffect, useState } from 'react';
import { useArena } from './context.js';
import { Action, Badge, FormPanel, GameFields, Input, ListPanel, Select, StatusControl, Table, dateLabel, find, stateLabel, useFilters } from './components.jsx';

export function Dashboard() {
  const {data} = useArena();
  const metrics = [['♜','Equipos',data.equipos.length,'Hasta 5 jugadores por equipo'], ['♙','Jugadores',data.jugadores.length,'Integrantes de tu comunidad'], ['♕','Torneos',data.torneos.length,'Competencias registradas'], ['⚑','Partidas',data.partidas.length,'Encuentros y carreras']];
  const steps = [['01','Arma tu equipo','Elige un juego y asigna a tus integrantes.','equipos'], ['02','Abre la competencia','Crea un torneo e inscribe a los equipos.','torneos'], ['03','Juega y registra','Programa la partida y guarda sus resultados.','partidas']];
  return <><section className="hero"><div><p className="eyebrow">TU PRÓXIMA COMPETENCIA EMPIEZA AQUÍ</p><h2>{data.equipos.length ? 'Todo listo para competir.' : 'Dale inicio a tu arena.'}</h2><p>Organiza equipos, reúne a tus jugadores y lleva cada partida hasta el último resultado. Tú creas la competencia.</p><a className="button lime" href="#equipos">{data.equipos.length ? 'Gestionar equipos' : 'Crear mi primer equipo'} <span>↗</span></a></div><div className="hero-symbol" aria-hidden="true">A↗<small>PLAY. COMPETE.</small></div></section>
    <section className="metrics" aria-label="Resumen de registros">{metrics.map(([icon,label,total,desc]) => <div className="metric" key={label}><div className="metric-top">{label}<span className="metric-icon">{icon}</span></div><strong>{String(total).padStart(2,'0')}</strong><small>{desc}</small></div>)}</section>
    <div className="dashboard-grid"><section className="panel"><div className="panel-head"><div><h2>Videojuegos disponibles</h2><p>Cuatro arenas. Una sola plataforma.</p></div><span className="index">04</span></div><div className="game-grid">{data.videojuegos.map(game => <a href="#torneos" className="game-card" key={game.VideojuegoId}><span className={`game-icon game-${game.Nombre.split(' ')[0]}`}>{({'Valorant':'VA','League of Legends':'LOL','Counter-Strike':'CS','Assetto Corsa':'AC'})[game.Nombre] || 'GG'}</span><strong>{game.Nombre}</strong><small>{find(data.categorias,'CategoriaId',game.CategoriaId)?.Nombre} · {data.torneos.filter(t => t.VideojuegoId === game.VideojuegoId).length} torneos</small></a>)}</div></section>
      <section className="panel"><div className="panel-head"><div><h2>De la plantilla al resultado</h2><p>Tu competencia, paso a paso.</p></div><span className="index">↗</span></div><div className="steps">{steps.map(([number,title,description,target]) => <a href={`#${target}`} className="step" key={number}><span className="step-num">{number}</span><div><strong>{title}</strong><p>{description}</p></div><span className="step-link">↗</span></a>)}</div></section></div>
  </>;
}

const emptyEquipo = {nombre:'', categoriaId:'', videojuegoId:''};
export function Equipos() {
  const {data, mutate, pending, notify} = useArena();
  const {toolbar, filtered, search} = useFilters(data,'Equipos');
  const [editing, setEditing] = useState(null), [values, setValues] = useState(emptyEquipo);
  function reset() {setEditing(null); setValues(emptyEquipo);}
  function edit(team) {setEditing(team); setValues({...emptyEquipo, nombre:team.Nombre});}
  async function retire(team) {
    if (!confirm('¿Retirar este equipo y sus inscripciones? Sus jugadores y resultados históricos se conservarán.')) return;
    try {await mutate(`/api/equipos/${team.EquipoId}/retirar`, 'POST', {});} catch (error) {notify(error.message,true);}
  }
  const rows = filtered(data.equipos).map(team => ({key:team.EquipoId, cells:[<><strong>{team.Nombre}</strong><small>{team.Videojuego}</small></>, <>{team.Integrantes}<span className="text-muted"> / 5</span></>, <Badge inactive={!team.Activo}>{team.Activo ? 'Activo' : 'Retirado'}</Badge>, <div className="actions"><Action onClick={() => edit(team)} disabled={pending}>Editar</Action>{team.Activo && <Action danger onClick={() => retire(team)} disabled={pending}>Retirar</Action>}</div>]}));
  return <>{toolbar}<div className="data-layout"><ListPanel title="Mis equipos"><Table headers={['EQUIPO','JUGADORES','ESTADO','ACCIONES']} rows={rows} title={search ? 'Sin coincidencias' : 'Todavía no hay equipos'} description="Crea un equipo en el formulario. Luego podrás asignarle sus jugadores." icon="♜" /></ListPanel>
    <FormPanel key={editing?.EquipoId || 'new'} title={editing ? 'Editar equipo' : 'Nuevo equipo'} subtitle={editing ? 'Actualiza el nombre de tu equipo.' : 'El primer paso para competir.'} button={editing ? 'Guardar cambios' : 'Crear equipo'} onCancel={editing ? reset : undefined} onSubmit={async () => {await mutate(editing ? `/api/equipos/${editing.EquipoId}` : '/api/equipos', editing ? 'PUT' : 'POST', values); reset();}}>
      <Input label="Nombre del equipo" name="nombre" value={values.nombre} maxLength={80} placeholder="Ej. Cóndores Esports" onChange={nombre => setValues({...values,nombre})} />
      {editing ? <div className="notice">Videojuego: {editing.Videojuego}. La pertenencia al juego se conserva.</div> : <GameFields {...{data,values,setValues}} />}
      <p className="result-note">El nombre debe ser único en toda la plataforma.</p>
    </FormPanel></div></>;
}

const emptyJugador = {primerNombre:'', apellido:'', alias:'', equipoId:'', cupo:''};
export function Jugadores() {
  const {data, mutate, pending} = useArena();
  const {toolbar, filtered, search} = useFilters(data,'Jugadores');
  const [editing, setEditing] = useState(null), [values, setValues] = useState(emptyJugador);
  function reset() {setEditing(null);setValues(emptyJugador);}
  function edit(player) {setEditing(player);setValues({primerNombre:player.PrimerNombre,apellido:player.Apellido,alias:player.Alias,equipoId:String(player.EquipoId ?? ''),cupo:String(player.Cupo ?? '')});}
  const occupied = data.jugadores.filter(player => String(player.EquipoId) === values.equipoId && player.JugadorId !== editing?.JugadorId).map(player => player.Cupo);
  const cupos = [1,2,3,4,5].filter(cupo => !occupied.includes(cupo)).map(id => ({id,label:`Cupo ${id}`}));
  const players = data.jugadores.map(player => ({...player,VideojuegoId:find(data.equipos,'EquipoId',player.EquipoId)?.VideojuegoId}));
  const rows = filtered(players).map(player => ({key:player.JugadorId,cells:[<><strong>{player.PrimerNombre} {player.Apellido}</strong><small>{player.Alias}</small></>, <>{player.Equipo || 'Sin equipo'}<small>{player.Cupo ? `Cupo ${player.Cupo}` : 'Disponible'}</small></>, <Action onClick={() => edit(player)} disabled={pending}>Editar / transferir</Action>]}));
  const field = (name,label,placeholder) => <Input label={label} name={name} value={values[name]} onChange={value => setValues({...values,[name]:value})} maxLength={50} placeholder={placeholder} />;
  return <>{toolbar}<div className="data-layout"><ListPanel title="Participantes"><Table headers={['JUGADOR','EQUIPO','ACCIÓN']} rows={rows} title={search ? 'Sin coincidencias' : 'Tu próxima estrella está por llegar'} description="Registra a tus jugadores. Puedes asignarlos a un equipo ahora o más adelante." icon="♙" /></ListPanel>
    <FormPanel key={editing?.JugadorId || 'new'} title={editing ? 'Editar jugador' : 'Nuevo jugador'} subtitle={editing ? 'Corrige sus datos o cambia su equipo.' : 'Cada jugador, una sola plantilla.'} button={editing ? 'Guardar cambios' : 'Registrar jugador'} onCancel={editing ? reset : undefined} onSubmit={async () => {await mutate(editing ? `/api/jugadores/${editing.JugadorId}` : '/api/jugadores',editing ? 'PUT' : 'POST',values);reset();}}>
      {field('primerNombre','Primer nombre','Ej. Camila')}{field('apellido','Apellido','Ej. Rojas')}{field('alias','Alias de juego','Ej. Nova')}
      <Select label="Equipo" value={values.equipoId} rows={data.equipos.filter(team => team.Activo || team.EquipoId === editing?.EquipoId)} id="EquipoId" text={team => `${team.Nombre} · ${team.Integrantes}/5`} placeholder="Sin equipo" required={false} onChange={equipoId => setValues({...values,equipoId,cupo:''})} />
      <Select label="Cupo" value={values.cupo} rows={values.equipoId ? cupos : []} id="id" text="label" disabled={!values.equipoId} required={Boolean(values.equipoId)} placeholder={values.equipoId ? cupos.length ? 'Seleccionar cupo…' : 'Equipo completo' : 'Sin equipo'} onChange={cupo => setValues({...values,cupo})} />
      <p className="result-note">El nombre y apellido no pueden repetirse. El alias también debe ser único.</p>
    </FormPanel></div></>;
}

const emptyTorneo = {nombre:'',categoriaId:'',videojuegoId:'',fechaInicio:'',fechaFin:''};
export function Torneos() {
  const arena = useArena(), {data,mutate} = arena;
  const {toolbar,filtered,search} = useFilters(data,'Torneos');
  const [values,setValues] = useState(emptyTorneo);
  const rows = filtered(data.torneos).map(torneo => ({key:torneo.TorneoId,cells:[<><strong>{torneo.Nombre}</strong><small>{torneo.Videojuego}</small></>, <>{dateLabel(torneo.FechaInicio)}<small>hasta {dateLabel(torneo.FechaFin)}</small></>, <StatusControl key={`${torneo.TorneoId}-${torneo.Estado}`} {...arena} id={torneo.TorneoId} current={torneo.Estado} type="torneo" />]}));
  return <>{toolbar}<div className="data-layout"><ListPanel title="Competencias"><Table headers={['TORNEO','FECHAS','ESTADO']} rows={rows} title={search ? 'Sin coincidencias' : 'El calendario está abierto'} description="Crea tu primer torneo y después inscribe a los equipos de ese videojuego." icon="♕" /></ListPanel>
    <FormPanel title="Nuevo torneo" subtitle="Define la próxima competencia." button="Crear torneo" onSubmit={async () => {await mutate('/api/torneos','POST',values);setValues(emptyTorneo);}}>
      <Input label="Nombre del torneo" name="nombre" value={values.nombre} onChange={nombre => setValues({...values,nombre})} maxLength={100} placeholder="Ej. Copa Primavera" />
      <GameFields {...{data,values,setValues}} />
      <Input label="Fecha de inicio" name="fechaInicio" type="date" value={values.fechaInicio} onChange={fechaInicio => setValues({...values,fechaInicio})} />
      <Input label="Fecha de término" name="fechaFin" type="date" value={values.fechaFin} min={values.fechaInicio || undefined} onChange={fechaFin => setValues({...values,fechaFin})} />
      <p className="result-note">El torneo se crea con las inscripciones abiertas.</p>
    </FormPanel></div></>;
}

export function Inscripciones() {
  const {data,mutate,pending,notify} = useArena();
  const {toolbar,filtered,search} = useFilters(data,'Inscripciones');
  const [values,setValues] = useState({torneoId:'',equipoId:''});
  const tournament = find(data.torneos,'TorneoId',values.torneoId);
  const teams = tournament ? data.equipos.filter(team => team.Activo && team.Integrantes > 0 && team.VideojuegoId === tournament.VideojuegoId && !data.inscripciones.some(i => i.TorneoId === tournament.TorneoId && i.EquipoId === team.EquipoId)) : [];
  async function retire(row) {
    if (!confirm('¿Retirar a este equipo del torneo?')) return;
    try {await mutate('/api/inscripciones/retirar','PATCH',{torneoId:row.TorneoId,equipoId:row.EquipoId});} catch (error) {notify(error.message,true);}
  }
  const rows = filtered(data.inscripciones).map(row => ({key:`${row.TorneoId}-${row.EquipoId}`,cells:[<><strong>{row.Equipo}</strong><small>{find(data.videojuegos,'VideojuegoId',row.VideojuegoId)?.Nombre}</small></>,row.Torneo,<Badge inactive={row.Estado === 'RETIRADO'}>{stateLabel(row.Estado)}</Badge>,row.Estado === 'INSCRITO' ? <Action danger disabled={pending} onClick={() => retire(row)}>Retirar</Action> : '—']}));
  return <>{toolbar}<div className="data-layout"><ListPanel title="Equipos inscritos"><Table headers={['EQUIPO','TORNEO','ESTADO','ACCIÓN']} rows={rows} title={search ? 'Sin coincidencias' : 'Aún no hay inscripciones'} description="Crea un equipo con al menos un integrante y un torneo del mismo juego." /></ListPanel>
    <FormPanel title="Inscribir equipo" subtitle="Un equipo puede jugar en varios torneos." button="Inscribir equipo" onSubmit={async () => {
      if (!values.equipoId) throw Error('No hay equipos disponibles para inscribir.');
      await mutate('/api/inscripciones','POST',values);setValues({torneoId:'',equipoId:''});
    }}>
      <Select label="Torneo" value={values.torneoId} rows={data.torneos.filter(t => t.Estado === 'INSCRIPCION')} id="TorneoId" text={t => `${t.Nombre} · ${t.Videojuego}`} onChange={torneoId => setValues({torneoId,equipoId:''})} />
      <Select label="Equipo" value={values.equipoId} rows={teams} id="EquipoId" text={team => `${team.Nombre} · ${team.Integrantes} jugadores`} disabled={!teams.length} placeholder={!tournament ? 'Elige un torneo primero' : teams.length ? 'Seleccionar equipo…' : 'No hay equipos disponibles'} onChange={equipoId => setValues({...values,equipoId})} />
      <div className="form-tip">Solo aparecen equipos activos, con jugadores y del mismo videojuego que el torneo.</div>
    </FormPanel></div></>;
}

const emptyPartida = {nombre:'',torneoId:'',fechaHora:'',equipoIds:[]};
export function Partidas() {
  const arena = useArena(), {data,mutate} = arena;
  const {toolbar,filtered,search} = useFilters(data,'Partidas');
  const [values,setValues] = useState(emptyPartida), [expanded,setExpanded] = useState(null);
  const teams = data.inscripciones.filter(i => String(i.TorneoId) === values.torneoId && i.Estado === 'INSCRITO').map(i => find(data.equipos,'EquipoId',i.EquipoId)).filter(team => team?.Activo && team.Integrantes > 0);
  const rows = filtered(data.partidas).map(partida => ({key:partida.PartidaId,cells:[<><strong>{partida.Nombre}</strong><small>{partida.Torneo} · {dateLabel(partida.FechaHora)}</small><small>{partida.Equipos}</small><Action onClick={() => setExpanded(expanded === partida.PartidaId ? null : partida.PartidaId)}>{expanded === partida.PartidaId ? 'Ocultar alineación' : 'Ver alineación'}</Action>{expanded === partida.PartidaId && <div className="roster"><ul>{data.alineaciones.filter(a => a.PartidaId === partida.PartidaId).map(a => <li key={a.JugadorId}>{a.PrimerNombre} {a.Apellido} · {a.Equipo}</li>)}</ul></div>}</>,<StatusControl key={`${partida.PartidaId}-${partida.Estado}`} {...arena} id={partida.PartidaId} current={partida.Estado} type="partida" />]}));
  return <>{toolbar}<div className="data-layout"><ListPanel title="Encuentros"><Table headers={['PARTIDA Y EQUIPOS','ESTADO']} rows={rows} title={search ? 'Sin coincidencias' : 'La próxima partida la creas tú'} description="Inscribe al menos dos equipos en un torneo para programar su encuentro." icon="⚑" /></ListPanel>
    <FormPanel title="Nueva partida" subtitle="La alineación se guardará al crearla." button="Programar partida" onSubmit={async () => {await mutate('/api/partidas','POST',values);setValues(emptyPartida);}}>
      <Input label="Nombre de la partida" name="nombre" value={values.nombre} maxLength={100} placeholder="Ej. Semifinal 1" onChange={nombre => setValues({...values,nombre})} />
      <Select label="Torneo" value={values.torneoId} rows={data.torneos.filter(t => !['CANCELADO','FINALIZADO'].includes(t.Estado))} id="TorneoId" text={t => `${t.Nombre} · ${t.Videojuego}`} onChange={torneoId => setValues({...values,torneoId,equipoIds:[]})} />
      <Input label="Fecha y hora local" name="fechaHora" type="datetime-local" value={values.fechaHora} onChange={fechaHora => setValues({...values,fechaHora})} />
      <div className="field teams-field">Equipos participantes<div className="checkboxes">{teams.length ? teams.map(team => <label className="check-team" key={team.EquipoId}><input type="checkbox" checked={values.equipoIds.includes(team.EquipoId)} onChange={event => setValues({...values,equipoIds:event.target.checked ? [...values.equipoIds,team.EquipoId] : values.equipoIds.filter(id => id !== team.EquipoId)})} /><span>{team.Nombre}<small>{team.Integrantes} integrante{team.Integrantes === 1 ? '' : 's'}</small></span></label>) : <p className="notice">{values.torneoId ? 'No hay equipos inscritos con jugadores. Inscríbelos antes de programar.' : 'Elige un torneo para ver sus equipos inscritos.'}</p>}</div></div>
      <p className="result-note">Dos equipos para Valorant, LoL y Counter-Strike. En carreras puedes seleccionar más. La alineación conserva el historial ante futuras transferencias.</p>
    </FormPanel></div></>;
}

const emptyStats = {asesinatos:'',muertes:'',asistencias:'',posicion:'',tiempoMilisegundos:'',vueltas:''};
export function Resultados() {
  const {data,mutate} = useArena();
  const {toolbar,filtered} = useFilters(data,'Resultados');
  const [partidaId,setPartidaId] = useState(''), [jugadorId,setJugadorId] = useState(''), [values,setValues] = useState(emptyStats);
  const match = find(data.partidas,'PartidaId',partidaId);
  useEffect(() => {
    const row = (match?.TipoEstadistica === 'KDA' ? data.kda : data.carreras).find(record => String(record.PartidaId) === partidaId && String(record.JugadorId) === jugadorId);
    setValues({asesinatos:row?.Asesinatos ?? '',muertes:row?.Muertes ?? '',asistencias:row?.Asistencias ?? '',posicion:row?.Posicion ?? '',tiempoMilisegundos:row?.TiempoMilisegundos ?? '',vueltas:row?.Vueltas ?? ''});
  }, [partidaId,jugadorId,match?.TipoEstadistica,data.kda,data.carreras]);
  const kda = data.kda.map(row => ({...row,VideojuegoId:data.videojuegos.find(game => game.Nombre === row.Videojuego)?.VideojuegoId}));
  const race = data.carreras.map(row => ({...row,VideojuegoId:find(data.partidas,'PartidaId',row.PartidaId)?.VideojuegoId}));
  const kdaRows = filtered(kda).map(row => ({key:`${row.PartidaId}-${row.JugadorId}`,cells:[<><strong>{row.PrimerNombre} {row.Apellido}</strong><small>{row.Equipo}</small></>,<>{row.Partida}<small>{row.Videojuego}</small></>,`${row.Asesinatos} / ${row.Muertes} / ${row.Asistencias}`,<strong>{Number(row.KDA).toFixed(2)}</strong>]}));
  const raceRows = filtered(race).map(row => ({key:`${row.PartidaId}-${row.JugadorId}`,cells:[<Badge>#{row.Posicion}</Badge>,<><strong>{row.PrimerNombre} {row.Apellido}</strong><small>{row.Equipo} · {row.Carrera}</small></>,<>{(Number(row.TiempoMilisegundos)/1000).toFixed(3)} s<small>{row.Vueltas} vueltas</small></>]}));
  const stat = (name,label,min,max) => <Input name={name} label={label} value={values[name]} type="number" min={min} max={max} step="1" onChange={value => setValues({...values,[name]:value})} />;
  return <>{toolbar}<div className="data-layout"><div className="results-grid"><ListPanel title="Estadísticas KDA"><Table headers={['JUGADOR','PARTIDA','K / D / A','KDA']} rows={kdaRows} title="Aún no hay estadísticas" description="Finaliza una partida e ingresa los resultados de su alineación." icon="▥" /></ListPanel><ListPanel title="Resultados de conducción"><Table headers={['POS.','PILOTO','TIEMPO']} rows={raceRows} title="La línea de meta te espera" description="Los resultados de Assetto Corsa aparecerán aquí." icon="⚑" /></ListPanel></div>
    <FormPanel title="Registrar resultado" subtitle="Los resultados se guardan por jugador." button="Guardar resultado" onSubmit={async () => {
      if (!match) throw Error('Selecciona una partida finalizada.');
      await mutate(match.TipoEstadistica === 'KDA' ? '/api/resultados/kda' : '/api/resultados/carrera','PUT',{...values,partidaId,jugadorId});
    }}>
      <Select label="Partida finalizada" value={partidaId} rows={data.partidas.filter(p => p.Estado === 'FINALIZADA')} id="PartidaId" text={p => `${p.Nombre} · ${p.Videojuego}`} onChange={id => {setPartidaId(id);setJugadorId('');}} />
      <Select label="Jugador de la alineación" value={jugadorId} rows={data.alineaciones.filter(a => String(a.PartidaId) === partidaId)} id="JugadorId" text={a => `${a.PrimerNombre} ${a.Apellido} · ${a.Equipo}`} disabled={!partidaId} placeholder={partidaId ? 'Seleccionar jugador…' : 'Elige una partida primero'} onChange={setJugadorId} />
      <div className="result-divider">{!match ? <p className="result-note">Selecciona una partida finalizada para ingresar sus estadísticas.</p> : match.TipoEstadistica === 'KDA' ? <>{stat('asesinatos','Asesinatos',0,1000000)}{stat('muertes','Muertes',0,1000000)}{stat('asistencias','Asistencias',0,1000000)}<p className="result-note">KDA = (asesinatos + asistencias) ÷ muertes. Si no hubo muertes, se utiliza 1 como divisor.</p></> : <>{stat('posicion','Posición final',1,32767)}{stat('tiempoMilisegundos','Tiempo total en milisegundos',1,2147483647)}{stat('vueltas','Vueltas completadas',1,32767)}<p className="result-note">Ejemplo de formato: 90 segundos = 90000 milisegundos.</p></>}</div>
      <p className="result-note">Si el jugador ya tiene resultados en esa partida, se cargarán para que puedas corregirlos.</p>
    </FormPanel></div></>;
}
