// Lugares que generan y atraen viajes en San Gil. Coordenadas tomadas de
// OpenStreetMap salvo donde se indica. Las salidas son nodos de la red
// (public/data/red-sangil.json) en el borde del área descargada.

export const ZONAS = {
  centro: { nombre: 'Parque La Libertad (centro)', lon: -73.13356, lat: 6.55483, peso: 4 },
  // La plaza de mercado no está en OSM: ubicación aproximada, por confirmar con el usuario.
  mercado: { nombre: 'Plaza de mercado (aproximada)', lon: -73.1342, lat: 6.5570, peso: 3 },
  terminal: { nombre: 'Terminal de Transportes', lon: -73.14899, lat: 6.55444, peso: 2 },
  terminalito: { nombre: 'Terminalito', lon: -73.13686, lat: 6.55661, peso: 1 },
};

export const SALIDAS = {
  socorro: { nombre: 'Salida a Socorro / Bogotá', nodo: 'n268142246', avenida: true },
  bucaramanga: { nombre: 'Salida a Bucaramanga', nodo: 'n277771396', avenida: true },
  curiti: { nombre: 'Salida a Curití', nodo: 'n1420096299', avenida: false },
  mogotes: { nombre: 'Salida a Mogotes', nodo: 'n580927953', avenida: false },
  barichara: { nombre: 'Salida a Barichara', nodo: 'n8679370924', avenida: false },
};
