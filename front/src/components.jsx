import { useState } from 'react';

export const stateLabel = value => ({INSCRIPCION:'Inscripciones abiertas', EN_CURSO:'En curso', FINALIZADO:'Finalizado', FINALIZADA:'Finalizada', PROGRAMADA:'Programada', CANCELADA:'Cancelada', CANCELADO:'Cancelado', INSCRITO:'Inscrito', RETIRADO:'Retirado'}[value] || value);
export const find = (rows, key, id) => rows.find(row => String(row[key]) === String(id));
export const dateLabel = value => value ? new Intl.DateTimeFormat('es-CL', {day:'2-digit', month:'short', year:'numeric', timeZone:'UTC'}).format(new Date(value)) : '—';
export function Badge({children, inactive = false}) {return <span className={`badge ${inactive ? 'inactive' : ''}`}>{children}</span>;}
export function Action({children, onClick, danger = false, disabled = false}) {return <button className={`table-action ${danger ? 'danger' : ''}`} type="button" onClick={onClick} disabled={disabled}>{children}</button>;}
export function Input({label, name, value, onChange, type = 'text', ...props}) {
  const handleChange = event => onChange(event.target.value);
  return <label className="field">{label}<input name={name} type={type} value={value ?? ''} onChange={handleChange} onInput={['date','datetime-local'].includes(type) ? handleChange : undefined} required {...props} /></label>;
}
export function Select({label, value, onChange, rows, id, text, placeholder = 'Seleccionar…', required = true, ...props}) {
  return <label className="field">{label}<select aria-label={label} value={value ?? ''} onChange={event => onChange(event.target.value)} required={required} {...props}>
    <option value="">{placeholder}</option>{rows.map(row => <option key={row[id]} value={row[id]}>{typeof text === 'function' ? text(row) : row[text]}</option>)}
  </select></label>;
}
export function GameFields({data, values, setValues}) {
  const games = data.videojuegos.filter(game => String(game.CategoriaId) === values.categoriaId);
  return <><Select label="Categoría" value={values.categoriaId} rows={data.categorias} id="CategoriaId" text="Nombre" onChange={categoriaId => {
    const choices = data.videojuegos.filter(game => String(game.CategoriaId) === categoriaId);
    setValues(previous => ({...previous, categoriaId, videojuegoId: choices.length === 1 ? String(choices[0].VideojuegoId) : ''}));
  }} /><Select label="Videojuego" value={values.videojuegoId} rows={games} id="VideojuegoId" text="Nombre" disabled={!games.length} placeholder={games.length ? 'Seleccionar…' : 'Elige una categoría primero'} onChange={videojuegoId => setValues(previous => ({...previous, videojuegoId}))} /></>;
}
export function FormPanel({title, subtitle, children, onSubmit, button = 'Guardar', onCancel}) {
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError('');
    try {await onSubmit();} catch (problem) {setError(problem.message);} finally {setSaving(false);}
  }
  return <aside className="panel form-panel"><div className="panel-head"><div><h2>{title}</h2><p>{subtitle}</p></div><span className="index">＋</span></div>
    <form onSubmit={submit}><fieldset disabled={saving} className="form-fields">{error && <div className="form-message" role="alert">{error}</div>}{children}
      <button className="button full" type="submit" disabled={saving}>{saving ? 'Guardando…' : button} <span>↗</span></button>
      {onCancel && <button className="cancel-edit" type="button" onClick={onCancel}>Cancelar edición</button>}
    </fieldset></form></aside>;
}
export function Table({headers, rows, title, description, icon = '⊞'}) {
  if (!rows.length) return <div className="empty"><span className="empty-icon">{icon}</span><h3>{title}</h3><p>{description}</p></div>;
  return <><div className="table-wrap"><table><thead><tr>{headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.key}>{row.cells.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody></table></div><div className="table-foot">{rows.length} registro{rows.length === 1 ? '' : 's'}</div></>;
}
export function ListPanel({title, children}) {return <section className="panel list-panel"><div className="panel-head"><h2>{title}</h2><span className="index">REGISTROS</span></div>{children}</section>;}
export function FilterBar({data, search, setSearch, game, setGame, label}) {
  return <div className="toolbar"><label className="search"><span>⌕</span><input type="search" aria-label="Buscar registros" placeholder={`Buscar ${label.toLowerCase()}…`} value={search} onChange={event => setSearch(event.target.value)} /></label>
    <select value={game} onChange={event => setGame(event.target.value)} aria-label="Filtrar por videojuego"><option value="">Todos los videojuegos</option>{data.videojuegos.map(row => <option key={row.VideojuegoId} value={row.VideojuegoId}>{row.Nombre}</option>)}</select></div>;
}
export function StatusControl({id, current, type, mutate, notify, pending}) {
  const [value, setValue] = useState(current);
  const states = type === 'torneo' ? ['INSCRIPCION','EN_CURSO','FINALIZADO','CANCELADO'] : ['PROGRAMADA','EN_CURSO','FINALIZADA','CANCELADA'];
  async function save() {
    try {await mutate(`/api/${type === 'torneo' ? 'torneos' : 'partidas'}/${id}/estado`, 'PATCH', {estado:value});}
    catch (error) {setValue(current); notify(error.message, true);}
  }
  return <div className="actions"><select className="inline-status" value={value} onChange={event => setValue(event.target.value)} aria-label={`Estado de ${type}`} disabled={pending}>{states.map(state => <option key={state} value={state}>{stateLabel(state)}</option>)}</select><Action onClick={save} disabled={pending}>Aplicar</Action></div>;
}
export function useFilters(data, label) {
  const [search, setSearch] = useState(''), [game, setGame] = useState('');
  const filtered = rows => rows.filter(row => (!game || String(row.VideojuegoId) === game) && (!search || Object.values(row).join(' ').toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))));
  return {search, filtered, toolbar:<FilterBar {...{data, search, setSearch, game, setGame, label}} />};
}
