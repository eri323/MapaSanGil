// Escenarios e historias que vienen listos para la demo. Lo que no sale de OSM
// ni del usuario es un SUPUESTO: el trazado de la Variante y el puente
// propuesto son aproximaciones que el usuario puede reemplazar en el editor.

import { crearEscenario } from './escenario.js';
import { aplicarCambio } from './cambios.js';
import { crearRed, componentePrincipal, arcoTransitable } from '../sim/red.js';
import { rutaMasRapida } from '../sim/rutas.js';
import { distanciaMetros, proyectarEnLinea, lineasSeCruzan } from '../sim/geo.js';
import { ZONAS, CASCO_URBANO, SALIDAS } from './zonas.js';

const CENTRO = [ZONAS.centro.lon, ZONAS.centro.lat];
const MARGEN_CASCO = 200; // m por fuera del casco donde la Variante se une a la Avenida
const ATRIBUTOS_VARIANTE = {
  nombre: 'Variante de San Gil (trazado aproximado)', tipo: 'variante', sentido: 'ambos',
  velocidadMax: 60, carrilesPorSentido: 1, enConstruccion: true,
};

const entrada = (cambio, descripcion) => ({ cambio, descripcion });
const medio = (g) => g[Math.floor(g.length / 2)];

function gradoDeNodos(datos) {
  const grado = new Map();
  for (const v of datos.vias) for (const n of [v.desde, v.hasta]) grado.set(n, (grado.get(n) ?? 0) + 1);
  return grado;
}

// Cruces de la Avenida, por fuera del casco, que están en la ruta de ida Y en la
// de vuelta entre una salida y el centro. Donde la Avenida es doble calzada (dos
// vías de un sentido), solo los cruces donde las calzadas se juntan sirven en
// los dos sentidos.
function crucesHacia(red, salidaId, fueraDelCasco) {
  let centro = null;
  let mejor = Infinity;
  for (const n of red.nodos.values()) {
    const d = distanciaMetros([n.lon, n.lat], CENTRO);
    if (d < mejor) { mejor = d; centro = n.id; }
  }
  const costo = (id) => (arcoTransitable(red, id) ? red.vias.get(red.arcos.get(id).viaId).longitud : Infinity);
  const nodosDe = (ruta) => new Set(ruta ? ruta.arcos.flatMap((id) => [red.arcos.get(id).desde, red.arcos.get(id).hasta]) : []);
  const ida = nodosDe(rutaMasRapida(red, salidaId, centro, costo));
  const vuelta = nodosDe(rutaMasRapida(red, centro, salidaId, costo));
  const enAvenida = new Set();
  for (const v of red.vias.values()) if (v.tipo === 'avenida_nacional') { enAvenida.add(v.desde); enAvenida.add(v.hasta); }
  return [...ida]
    .filter((id) => vuelta.has(id) && enAvenida.has(id))
    .map((id) => red.nodos.get(id))
    .filter((n) => fueraDelCasco([n.lon, n.lat]));
}

// Si la recta entre dos puntos pasa por el casco, se desvía por un punto
// intermedio por fuera de él (como iría la Variante, rodeando el centro).
function rodearCasco(p, q, casco) {
  const centro = [casco.lon, casco.lat];
  const medioPQ = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const distancia = distanciaMetros(medioPQ, centro);
  const necesaria = casco.radio + MARGEN_CASCO + 100;
  if (distancia >= necesaria) return [p, q];
  const escala = necesaria / Math.max(distancia, 1);
  const w = [centro[0] + (medioPQ[0] - centro[0]) * escala, centro[1] + (medioPQ[1] - centro[1]) * escala];
  return [p, w, q];
}

export function trazadoAproximadoVariante(datos, casco = CASCO_URBANO, salidas = SALIDAS) {
  const grado = gradoDeNodos(datos);
  const nodos = new Map(datos.nodos.map((n) => [n.id, n]));
  const red = crearRed(datos);
  const fueraDelCasco = (p) => distanciaMetros(p, [casco.lon, casco.lat]) > casco.radio + MARGEN_CASCO;
  // El extremo más occidental empata con la Avenida hacia Socorro y el más
  // oriental con la Avenida hacia Bucaramanga; así la Variante rodea el centro.
  const extremosSueltos = [...new Set(datos.vias
    .filter((v) => v.tipo === 'variante')
    .flatMap((v) => [v.desde, v.hasta])
    .filter((n) => grado.get(n) === 1))]
    .sort((x, y) => nodos.get(x).lon - nodos.get(y).lon);
  if (extremosSueltos.length < 2) return [];
  const destinos = [
    [extremosSueltos[0], crucesHacia(red, salidas.socorro.nodo, fueraDelCasco)],
    [extremosSueltos.at(-1), crucesHacia(red, salidas.bucaramanga.nodo, fueraDelCasco)],
  ];

  const entradas = [];
  destinos.forEach(([nodoId, candidatos], k) => {
    const n = nodos.get(nodoId);
    const p = [n.lon, n.lat];
    let mejor = null;
    for (const c of candidatos) {
      const d = distanciaMetros(p, [c.lon, c.lat]);
      if (!mejor || d < mejor.d) mejor = { d, nodo: c };
    }
    if (!mejor) return;
    const q = [mejor.nodo.lon, mejor.nodo.lat];
    entradas.push(entrada({
      tipo: 'viaNueva', id: `variante-aprox-${k + 1}`, puntos: rodearCasco(p, q, casco),
      extremos: [{ tipo: 'nodo', nodo: nodoId, punto: p }, { tipo: 'nodo', nodo: mejor.nodo.id, punto: q }],
      atributos: ATRIBUTOS_VARIANTE,
    }, `Tramo aproximado de la Variante ${k + 1}`));
  });

  // Se calculan los ids después de agregar los tramos, para terminarlos todos.
  let conTramos = datos;
  for (const e of entradas) conTramos = aplicarCambio(conTramos, e.cambio);
  const enObra = conTramos.vias.filter((v) => v.tipo === 'variante' && v.enConstruccion).map((v) => v.id);
  if (enObra.length) entradas.push(entrada({ tipo: 'terminarObra', viaIds: enObra }, 'Variante terminada'));
  return entradas;
}

export function puentePropuesto(datos, rios, { largoMax = 160, separacion = 300, cercaDelRio = 120 } = {}) {
  if (!rios.length) return null;
  const red = crearRed(datos);
  const principal = componentePrincipal(red);
  const puentes = datos.vias.filter((v) => v.esPuente).map((v) => medio(v.geometria));
  const candidatos = [...principal]
    .map((id) => red.nodos.get(id))
    .filter((n) => rios.some((r) => proyectarEnLinea(r, [n.lon, n.lat]).distancia < cercaDelRio));

  let mejor = null;
  for (let i = 0; i < candidatos.length; i++) {
    for (let j = i + 1; j < candidatos.length; j++) {
      const a = [candidatos[i].lon, candidatos[i].lat];
      const b = [candidatos[j].lon, candidatos[j].lat];
      const largo = distanciaMetros(a, b);
      if (largo > largoMax || largo < 30) continue;
      if (!rios.some((r) => lineasSeCruzan([a, b], r))) continue;
      const centro = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (puentes.some((p) => distanciaMetros(p, centro) < separacion)) continue;
      const puntaje = distanciaMetros(centro, CENTRO);
      if (!mejor || puntaje < mejor.puntaje) mejor = { a: candidatos[i], b: candidatos[j], puntaje };
    }
  }
  if (!mejor) return null;
  const pa = [mejor.a.lon, mejor.a.lat];
  const pb = [mejor.b.lon, mejor.b.lat];
  return entrada({
    tipo: 'viaNueva', id: 'puente-propuesto', puntos: [pa, pb],
    extremos: [{ tipo: 'nodo', nodo: mejor.a.id, punto: pa }, { tipo: 'nodo', nodo: mejor.b.id, punto: pb }],
    atributos: {
      nombre: 'Puente nuevo (propuesto)', tipo: 'doble_sentido', sentido: 'ambos',
      velocidadMax: 30, carrilesPorSentido: 1, enConstruccion: false, esPuente: true,
    },
  }, 'Puente nuevo propuesto');
}

export function arreglarVias(datos, radio = 2000) {
  return datos.vias
    .filter((v) => v.estado !== 'bueno' || v.superficie === 'destapado')
    .filter((v) => distanciaMetros(v.geometria[0], CENTRO) <= radio)
    .map((v) => entrada(
      { tipo: 'via', viaId: v.id, propiedades: { estado: 'bueno', superficie: 'pavimento' } },
      `${v.nombre || 'Vía sin nombre'}: arreglada`,
    ));
}

export function construirPrecargados(base, rios) {
  const ALTA = { temporada: 1.4 };
  const varianteSin = trazadoAproximadoVariante(base);
  const puente = puentePropuesto(base, rios);
  const rojas = base.vias.filter((v) => v.osmId === 24670013).map((v) => entrada(
    { tipo: 'via', viaId: v.id, propiedades: { abierta: false } }, 'Puente Rojas Pinilla: cerrado por obra',
  ));

  const actual = crearEscenario({ nombre: 'San Gil actual', descripcion: 'La red de hoy, día normal', precargado: true });
  const alta = crearEscenario({ nombre: 'Temporada alta', descripcion: 'Festivos y turismo: demanda ×1,4', demanda: ALTA, precargado: true });
  const obra = crearEscenario({ nombre: 'Obra en el Rojas Pinilla', descripcion: 'El puente principal cerrado', entradas: rojas, precargado: true });
  const varianteSinRestriccion = crearEscenario({
    nombre: 'Variante terminada (sin restricción)', descripcion: 'Trazado aproximado; los pesados escogen libremente',
    entradas: varianteSin, precargado: true,
  });
  const varianteConRestriccion = crearEscenario({
    nombre: 'Variante terminada con restricción', descripcion: 'Trazado aproximado; pesados de paso por la Variante',
    entradas: varianteSin, restriccionPesados: true, precargado: true,
  });
  const escenarios = [actual, alta, obra, varianteSinRestriccion, varianteConRestriccion];
  if (puente) {
    escenarios.push(crearEscenario({ nombre: 'Puente nuevo propuesto', descripcion: 'Un cruce más sobre el Fonce', entradas: [puente], precargado: true }));
  }

  // Historia "Cómo mejora": cada paso acumula los cambios del anterior.
  const pasosMejora = [];
  let acumuladas = [];
  const agregarPaso = (titulo, nota, nuevas, extra = {}) => {
    acumuladas = [...acumuladas, ...nuevas];
    pasosMejora.push({ titulo, nota, escenario: crearEscenario({ nombre: titulo, entradas: acumuladas, demanda: ALTA, ...extra }) });
  };
  pasosMejora.push({ titulo: 'San Gil hoy', nota: 'Un día normal, con la red actual.', escenario: actual });
  agregarPaso('Temporada alta', 'Festivos y turismo: 40 % más viajes. El centro y los puentes se llenan.', []);
  if (puente) agregarPaso('+ Puente nuevo', 'Un cruce más sobre el Fonce reparte el tráfico entre las dos orillas.', [puente]);
  agregarPaso('+ Variante terminada', 'Con restricción: tractomulas y buses de paso ya no cruzan el centro.', varianteSin, { restriccionPesados: true });
  agregarPaso('+ Vías arregladas', 'Las vías alternas en mal estado quedan pavimentadas y los carros empiezan a usarlas.', arreglarVias(base), { restriccionPesados: true });

  const historias = [
    { nombre: 'Cómo mejora San Gil', pasos: pasosMejora },
    {
      nombre: 'Cómo empeora San Gil',
      pasos: [
        { titulo: 'San Gil hoy', nota: 'Un día normal, con la red actual.', escenario: actual },
        { titulo: 'Obra en el Rojas Pinilla', nota: 'El puente principal se cierra: todo se va a la Calle 15.', escenario: obra },
        {
          titulo: '+ Temporada alta', nota: 'La obra coincide con festivos: el sistema colapsa.',
          escenario: crearEscenario({ nombre: 'Obra + temporada alta', entradas: rojas, demanda: ALTA }),
        },
      ],
    },
  ];
  return { escenarios, historias };
}
