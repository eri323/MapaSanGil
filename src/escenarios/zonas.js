// Lugares que generan y atraen viajes en San Gil. Coordenadas tomadas de
// OpenStreetMap salvo donde se indica. Las salidas son nodos de la red
// (public/data/red-sangil.json) en el borde del área descargada.

export const ZONAS = {
  centro: { nombre: 'Parque La Libertad (centro)', lon: -73.13356, lat: 6.55483, peso: 4 },
  // Mercado cubierto, Carrera 11 entre Calles 13 y 14 (OSM node 5478495523, confirmado por el usuario).
  mercado: { nombre: 'Plaza de mercado', lon: -73.1347516, lat: 6.5541899, peso: 3 },
  terminal: { nombre: 'Terminal de Transportes', lon: -73.14899, lat: 6.55444, peso: 2 },
  terminalito: { nombre: 'Terminalito', lon: -73.13686, lat: 6.55661, peso: 1 },
};

export const SALIDAS = {
  socorro: { nombre: 'Salida a Socorro / Bogotá', nodo: 'n268142246', avenida: true },
  bucaramanga: { nombre: 'Salida a Bucaramanga', nodo: 'n277771396', avenida: true },
  curiti: { nombre: 'Salida a Curití', nodo: 'n1420096299', avenida: false },
  mogotes: { nombre: 'Salida a Mogotes', nodo: 'n580927953', avenida: false },
  barichara: { nombre: 'Salida a Barichara', nodo: 'n8679370924', avenida: false },
  charala: { nombre: 'Salida a Charalá', nodo: 'n1420153782', avenida: false },
};
