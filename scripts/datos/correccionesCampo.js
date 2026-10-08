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
