// Correcciones de campo sobre OpenStreetMap, confirmadas por el usuario.
// Cada vía usa nodos que ya existen en los datos descargados.

export const VIAS_AGREGADAS = [
  {
    // En OSM es peatonal de la Carrera 9 a la 11. Desde 2026 el tramo entre la
    // Carrera 10 y la 11 está habilitado a vehículos, bajando hacia la Carrera 11.
    // (confirmado por el usuario el 2026-10-08)
    id: 389740222,
    nodes: [268715844, 4286225182], // cruce con Carrera 10 → cruce con Carrera 11
    tags: { highway: 'residential', name: 'Calle 12', oneway: 'yes', surface: 'concrete' },
  },
];

// Estado de las vías por nombre. Lo marcado "SUPUESTO" está por confirmar con el usuario.
export const ESTADOS_CAMPO = [
  {
    nombres: ['Carrera 1', 'Carrera 1A'],
    estado: 'huecos',
    superficie: 'destapado',
    nota: 'SUPUESTO: la base Python preguntaba si "la carrera 1ª pavimentada alcanza como vía alterna".',
  },
];
