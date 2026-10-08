import { describe, it, expect } from 'vitest';
import {
  TIPOS_VIA, SENTIDOS, SUPERFICIES, ESTADOS, CONTROLES, JERARQUIA, ETIQUETA_TIPO,
} from '../../src/sim/tipos.js';

describe('tipos de dominio', () => {
  it('todo tipo de vía tiene jerarquía y etiqueta', () => {
    for (const tipo of TIPOS_VIA) {
      expect(JERARQUIA[tipo]).toBeGreaterThan(0);
      expect(ETIQUETA_TIPO[tipo]).toBeTruthy();
    }
  });

  it('la jerarquía respeta el orden del spec', () => {
    expect(JERARQUIA.avenida_nacional).toBe(JERARQUIA.variante);
    expect(JERARQUIA.variante).toBeGreaterThan(JERARQUIA.doble_calzada);
    expect(JERARQUIA.doble_calzada).toBeGreaterThan(JERARQUIA.doble_sentido);
    expect(JERARQUIA.doble_sentido).toBeGreaterThan(JERARQUIA.un_sentido);
  });

  it('expone los valores permitidos', () => {
    expect(SENTIDOS).toEqual(['adelante', 'ambos']);
    expect(SUPERFICIES).toEqual(['pavimento', 'adoquin', 'destapado']);
    expect(ESTADOS).toEqual(['bueno', 'regular', 'huecos']);
    expect(CONTROLES).toEqual(['pare', 'prioridad', 'sin_senal', 'semaforo']);
  });
});
import { ETIQUETA_ESTADO, ETIQUETA_SUPERFICIE, ETIQUETA_CONTROL } from '../../src/sim/tipos.js';

describe('etiquetas de edición', () => {
  it('todo estado, superficie y control tiene etiqueta', () => {
    for (const e of ESTADOS) expect(ETIQUETA_ESTADO[e]).toBeTruthy();
    for (const s of SUPERFICIES) expect(ETIQUETA_SUPERFICIE[s]).toBeTruthy();
    for (const c of CONTROLES) expect(ETIQUETA_CONTROL[c]).toBeTruthy();
  });
});
