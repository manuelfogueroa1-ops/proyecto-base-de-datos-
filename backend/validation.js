'use strict';
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = message => { throw new HttpError(400, message); };
function text(value, label, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(`${label}: ingresa entre 1 y ${max} caracteres.`);
  return value.trim();
}
function integer(value, label, min = 1, max = 2147483647) {
  if (value === '' || value === null || value === undefined || typeof value === 'boolean' || !['number','string'].includes(typeof value)) fail(`${label}: ingresa un número entero válido.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) fail(`${label}: debe estar entre ${min} y ${max}.`);
  return number;
}
function optionalId(value) { return value === '' || value === null || value === undefined ? null : integer(value, 'Equipo'); }
function choice(value, choices, label) { if (!choices.includes(value)) fail(`${label} no válido.`); return value; }
function date(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) fail(`${label}: fecha no válida.`);
  if (Number(value.slice(0,4)) < 1900) fail(`${label}: utiliza un año desde 1900.`);
  return value;
}
function datetime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) fail('Fecha y hora no válidas.');
  date(value.slice(0,10), 'Fecha de partida');
  if (Number(value.slice(11,13)) > 23 || Number(value.slice(14,16)) > 59) fail('Hora de partida no válida.');
  return value;
}
function sqlError(error) {
  if (error instanceof HttpError) return error;
  const number = error.number || error.originalError?.info?.number;
  const message = String(error.message || '');
  if ([2601,2627].includes(number)) {
    if (message.includes('UX_Jugador_EquipoCupo')) return new HttpError(409, 'Ese cupo ya está ocupado. El equipo admite como máximo cinco jugadores.');
    if (message.includes('UQ_Jugador_NombreApellido')) return new HttpError(409, 'Ya existe un jugador con ese nombre y apellido.');
    if (message.includes('UQ_Jugador_Alias')) return new HttpError(409, 'Ese alias ya está registrado.');
    if (message.includes('UQ_Equipo_Nombre')) return new HttpError(409, 'Ya existe un equipo con ese nombre.');
    if (message.includes('UQ_Carrera_Posicion')) return new HttpError(409, 'Esa posición ya pertenece a otro piloto.');
    return new HttpError(409, 'El registro ya existe o repite un valor único.');
  }
  if (number >= 51000 && number < 53000) return new HttpError(400, message);
  if (number === 547) return new HttpError(409, 'La operación no cumple las reglas: revisa el juego, las fechas, el cupo y los registros relacionados.');
  if ([241,242].includes(number)) return new HttpError(400, 'La fecha o la hora no son válidas. Revisa el formulario.');
  if (number === 1205) return new HttpError(409, 'Otra operación modificó estos datos. Actualiza y vuelve a intentarlo.');
  console.error('Error SQL:', error);
  return new HttpError(503, 'No fue posible comunicarse con SQL Server. Comprueba que SQLEXPRESS esté en ejecución.');
}
module.exports = {HttpError, text, integer, optionalId, choice, date, datetime, sqlError};
