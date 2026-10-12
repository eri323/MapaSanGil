// Escenario: los cambios sobre la red base más la demanda y la restricción de
// pesados. Se guarda en el navegador, se exporta como archivo y se compara.

import { aplicarCambios } from './cambios.js';
import { crearRed } from '../sim/red.js';

export const DEMANDA_POR_DEFECTO = { factor: 1, temporada: 1, horaInicio: 7 };
export const TIPO_ARCHIVO = 'escenario-mapa-sangil';

export function crearEscenario({
  nombre, descripcion = '', entradas = [], demanda = {}, restriccionPesados = false, precargado,
}) {
  return {
    version: 1,
    nombre,
    descripcion,
    entradas,
    demanda: { ...DEMANDA_POR_DEFECTO, ...demanda },
    restriccionPesados,
    ...(precargado && { precargado: true }),
  };
}

export function validarEscenario(e) {
  const errores = [];
  if (!e || typeof e !== 'object') return ['no es un objeto'];
  if (typeof e.nombre !== 'string' || !e.nombre.trim()) errores.push('falta el nombre');
  const d = e.demanda ?? {};
  if (!(Number.isFinite(d.factor) && d.factor >= 0 && d.factor <= 5)) errores.push('factor de demanda inválido');
  if (!(Number.isFinite(d.temporada) && d.temporada > 0 && d.temporada <= 5)) errores.push('temporada inválida');
  if (!(Number.isInteger(d.horaInicio) && d.horaInicio >= 0 && d.horaInicio <= 23)) errores.push('hora de inicio inválida');
  if (typeof e.restriccionPesados !== 'boolean') errores.push('restricción de pesados inválida');
  if (!Array.isArray(e.entradas)) errores.push('faltan los cambios');
  else if (e.entradas.some((x) => !x?.cambio || typeof x.cambio.tipo !== 'string')) errores.push('hay un cambio mal formado');
  return errores;
}

export function aplicarEscenario(base, e) {
  const datos = aplicarCambios(base, e.entradas.map((x) => x.cambio));
  crearRed(datos);
  return datos;
}

export function exportarEscenario(e) {
  return JSON.stringify({ tipo: TIPO_ARCHIVO, ...e }, null, 2);
}

export function importarEscenario(texto, base) {
  let objeto;
  try {
    objeto = JSON.parse(texto);
  } catch {
    throw new Error('El archivo no es un escenario válido (no es JSON).');
  }
  if (objeto?.tipo !== TIPO_ARCHIVO) throw new Error('El archivo no es un escenario del simulador de San Gil.');
  const { tipo: _tipo, ...resto } = objeto;
  const e = crearEscenario(resto);
  const errores = validarEscenario(e);
  if (errores.length) throw new Error(`Escenario inválido: ${errores.join('; ')}.`);
  try {
    aplicarEscenario(base, e);
  } catch (err) {
    throw new Error(`El escenario no se puede aplicar a esta red: ${err.message}`);
  }
  return e;
}

export function nombreArchivo(e) {
  const limpio = e.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${limpio || 'escenario'}.json`;
}

// --- almacén en el navegador (el texto lo lee y escribe la interfaz) ---------

export const CLAVE_ESCENARIOS = 'mapa-sangil:escenarios';

export function leerEscenarios(texto) {
  try {
    const lista = JSON.parse(texto);
    return Array.isArray(lista) ? lista.filter((e) => validarEscenario(e).length === 0) : [];
  } catch {
    return [];
  }
}

export const guardarEscenario = (lista, e) => [...lista.filter((x) => x.nombre !== e.nombre), e];
export const borrarEscenario = (lista, nombre) => lista.filter((x) => x.nombre !== nombre);

// ¿Los cambios actuales son exactamente los de algún escenario conocido? Si no,
// son ediciones propias que se perderían al cargar otro escenario.
export function esEstadoConocido(entradas, escenarios) {
  if (!entradas.length) return true;
  const firma = JSON.stringify(entradas.map((e) => e.cambio));
  return escenarios.some((e) => JSON.stringify(e.entradas.map((x) => x.cambio)) === firma);
}

export function nombreDisponible(nombre, existentes) {
  if (!existentes.includes(nombre)) return nombre;
  let k = 2;
  while (existentes.includes(`${nombre} (${k})`)) k += 1;
  return `${nombre} (${k})`;
}

// Un escenario propio con el mismo nombre se reemplaza; un precargado nunca.
export function nombreParaGuardar(nombre, nombresPrecargados, nombresGuardados) {
  if (!nombresPrecargados.includes(nombre)) return nombre;
  return nombreDisponible(nombre, [...nombresPrecargados, ...nombresGuardados]);
}
