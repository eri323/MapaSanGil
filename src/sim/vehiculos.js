// Tipos de vehículo y su comportamiento. Los parámetros siguen el Intelligent
// Driver Model (IDM): largo y s0 en metros, vMax en m/s, a y b en m/s², T y
// hueco en segundos. Son supuestos razonables, documentados en "Cómo funciona".

export const TIPOS_VEHICULO = ['moto', 'carro', 'buseta', 'bus_nacional', 'bus_intermunicipal', 'camion'];

export const ETIQUETA_VEHICULO = {
  moto: 'Moto',
  carro: 'Carro / taxi',
  buseta: 'Buseta',
  bus_nacional: 'Bus nacional',
  bus_intermunicipal: 'Bus intermunicipal',
  camion: 'Camión / tractomula',
};

// a: aceleración máxima · b: frenado cómodo · T: tiempo de seguridad
// s0: distancia mínima parado · hueco: tiempo mínimo para cruzar ante otro vehículo
export const PERFILES = {
  moto: { largo: 2.0, vMax: 16.7, a: 2.5, b: 3.0, T: 1.0, s0: 1.0, hueco: 2.0 },
  carro: { largo: 4.5, vMax: 16.7, a: 1.5, b: 2.5, T: 1.4, s0: 2.0, hueco: 3.0 },
  buseta: { largo: 7.0, vMax: 13.9, a: 1.0, b: 2.0, T: 1.6, s0: 2.5, hueco: 3.5 },
  bus_nacional: { largo: 12.0, vMax: 13.9, a: 0.8, b: 1.8, T: 1.8, s0: 3.0, hueco: 4.5 },
  bus_intermunicipal: { largo: 10.0, vMax: 13.9, a: 0.8, b: 1.8, T: 1.8, s0: 3.0, hueco: 4.5 },
  camion: { largo: 16.5, vMax: 12.5, a: 0.5, b: 1.5, T: 2.0, s0: 3.5, hueco: 5.5 },
};

export const FACTOR_SUPERFICIE = { pavimento: 1, adoquin: 0.85, destapado: 0.6 };
export const FACTOR_ESTADO = { bueno: 1, regular: 0.8, huecos: 0.5 };

export const factorVia = (via) => FACTOR_SUPERFICIE[via.superficie] * FACTOR_ESTADO[via.estado];

export const CONDUCTOR_NEUTRO = { agresividad: 1, toleranciaHuecos: 1 };

// Cada conductor maneja un poco distinto; en una vía con huecos la diferencia
// es mayor (unos esquivan despacio, otros pasan rápido).
export function crearConductor(aleatorio) {
  return {
    agresividad: aleatorio.entre(0.9, 1.1),
    toleranciaHuecos: aleatorio.entre(0.7, 1.3),
  };
}

export function velocidadDeseada(perfil, via, conductor = CONDUCTOR_NEUTRO) {
  let factor = factorVia(via);
  if (via.estado === 'huecos') factor *= conductor.toleranciaHuecos;
  const limite = Math.min(perfil.vMax, (via.velocidadMax / 3.6) * conductor.agresividad);
  return Math.max(1, limite * factor);
}

export const velocidadReferencia = (via) => velocidadDeseada(PERFILES.carro, via, CONDUCTOR_NEUTRO);
