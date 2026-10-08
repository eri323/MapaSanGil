// Traduce las etiquetas de una vía de OpenStreetMap a los atributos del modelo.
// Lo que OSM no dice se llena con supuestos que el usuario corrige en el editor.

const HIGHWAYS_VEHICULARES = new Set([
  'trunk', 'trunk_link', 'primary', 'primary_link',
  'secondary', 'secondary_link', 'tertiary', 'tertiary_link',
  'unclassified', 'residential', 'living_street',
]);

const SUPERFICIE_OSM = {
  pavimento: ['asphalt', 'paved', 'concrete', 'concrete:plates', 'concrete:lanes', 'chipseal'],
  adoquin: ['paving_stones', 'sett', 'cobblestone', 'unhewn_cobblestone', 'bricks'],
  destapado: ['unpaved', 'dirt', 'gravel', 'fine_gravel', 'ground', 'compacted', 'earth', 'mud', 'sand', 'pebblestone'],
};

const SMOOTHNESS_HUECOS = new Set(['bad', 'very_bad', 'horrible', 'very_horrible', 'impassable']);

const VELOCIDAD_POR_TIPO = {
  avenida_nacional: 50,
  variante: 60,
  doble_calzada: 40,
  doble_sentido: 30,
  un_sentido: 30,
  glorieta: 20,
};

const esVariante = (tags) => /variante/i.test(tags.name ?? '');

export function esViaVehicular(tags) {
  if (!tags) return false;
  if (HIGHWAYS_VEHICULARES.has(tags.highway)) return true;
  return tags.highway === 'construction'
    && (HIGHWAYS_VEHICULARES.has(tags.construction) || esVariante(tags));
}

function leerEntero(valor) {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function leerVelocidad(valor) {
  const m = /^(\d+)\s*(mph)?$/.exec(String(valor ?? '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  if (n <= 0) return null; // una vía con velocidad 0 dejaría a los vehículos quietos para siempre
  return m[2] ? Math.round(n * 1.609) : n;
}

function leerSentido(tags, glorieta) {
  const oneway = tags.oneway;
  if (oneway === '-1' || oneway === 'reverse') return 'inverso';
  if (oneway === 'no') return 'ambos';
  if (oneway === 'yes' || oneway === 'true' || oneway === '1' || glorieta) return 'adelante';
  return 'ambos';
}

function leerTipo(tags, highway, sentido, glorieta) {
  if (esVariante(tags)) return 'variante';
  if (glorieta) return 'glorieta';
  if (highway.startsWith('trunk') || highway.startsWith('primary')) return 'avenida_nacional';
  if (tags.dual_carriageway === 'yes') return 'doble_calzada';
  return sentido === 'ambos' ? 'doble_sentido' : 'un_sentido';
}

function leerSuperficie(surface) {
  for (const [superficie, valores] of Object.entries(SUPERFICIE_OSM)) {
    if (valores.includes(surface)) return superficie;
  }
  return 'pavimento';
}

function leerEstado(smoothness) {
  if (SMOOTHNESS_HUECOS.has(smoothness)) return 'huecos';
  if (smoothness === 'intermediate') return 'regular';
  return 'bueno';
}

export function clasificarVia(tags) {
  const enConstruccion = tags.highway === 'construction';
  const highway = enConstruccion ? (tags.construction ?? 'tertiary') : tags.highway;
  const glorieta = tags.junction === 'roundabout' || tags.junction === 'circular';
  const sentido = leerSentido(tags, glorieta);
  const tipo = leerTipo(tags, highway, sentido, glorieta);

  const carriles = leerEntero(tags.lanes);
  let carrilesPorSentido = 1;
  if (carriles) {
    carrilesPorSentido = sentido === 'ambos' ? Math.max(1, Math.floor(carriles / 2)) : carriles;
  }

  return {
    nombre: tags.name ?? '',
    tipo,
    sentido,
    carrilesPorSentido,
    superficie: leerSuperficie(tags.surface),
    estado: leerEstado(tags.smoothness),
    velocidadMax: leerVelocidad(tags.maxspeed) ?? VELOCIDAD_POR_TIPO[tipo],
    enConstruccion,
    esPuente: tags.bridge !== undefined && tags.bridge !== 'no',
  };
}
