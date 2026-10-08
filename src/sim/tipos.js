// Constantes del dominio. Las comparten el motor, los scripts y la interfaz.

export const TIPOS_VIA = [
  'un_sentido',
  'doble_sentido',
  'doble_calzada',
  'glorieta',
  'avenida_nacional',
  'variante',
];

export const SENTIDOS = ['adelante', 'ambos'];
export const SUPERFICIES = ['pavimento', 'adoquin', 'destapado'];
export const ESTADOS = ['bueno', 'regular', 'huecos'];
export const CONTROLES = ['pare', 'prioridad', 'sin_senal', 'semaforo'];

// Mayor número = más prelación en un cruce.
export const JERARQUIA = {
  avenida_nacional: 4,
  variante: 4,
  doble_calzada: 3,
  glorieta: 3,
  doble_sentido: 2,
  un_sentido: 1,
};

export const ETIQUETA_TIPO = {
  un_sentido: 'Un sentido',
  doble_sentido: 'Doble sentido',
  doble_calzada: 'Doble calzada',
  glorieta: 'Glorieta',
  avenida_nacional: 'Avenida Nacional',
  variante: 'Variante',
};
export const ETIQUETA_ESTADO = { bueno: 'Bueno', regular: 'Regular', huecos: 'Con huecos' };
export const ETIQUETA_SUPERFICIE = { pavimento: 'Pavimento', adoquin: 'Adoquín', destapado: 'Destapada' };
export const ETIQUETA_CONTROL = {
  pare: 'Pare',
  prioridad: 'Prioridad por jerarquía',
  sin_senal: 'Sin señal (cede a la derecha)',
  semaforo: 'Semáforo',
};
