import { describe, it, expect } from 'vitest';
import { construirContenido } from '../../src/ui/comoFunciona/contenido.js';
import { TIPOS_VEHICULO, PERFILES } from '../../src/sim/vehiculos.js';
import { DEMANDA_BASE } from '../../src/sim/demanda.js';

const { secciones } = construirContenido({ vias: 2158, cruces: 1622 });
const seccion = (id) => secciones.find((s) => s.id === id);

describe('contenido de "Cómo funciona"', () => {
  it('cada sección tiene id único, título y texto', () => {
    expect(new Set(secciones.map((s) => s.id)).size).toBe(secciones.length);
    for (const s of secciones) {
      expect(s.titulo).toBeTruthy();
      expect(s.texto.length).toBeGreaterThan(0);
      for (const p of s.texto) expect(p.trim()).not.toBe('');
    }
  });

  it('la red dice cuántas vías y cruces tiene', () => {
    expect(seccion('red').texto.join(' ')).toMatch(/2\.158 vías/);
    expect(seccion('red').texto.join(' ')).toMatch(/1\.622 cruces/);
  });

  it('la tabla de vehículos sale de los perfiles del motor', () => {
    const { tabla } = seccion('vehiculos');
    expect(tabla.filas).toHaveLength(TIPOS_VEHICULO.length);
    const moto = tabla.filas.find((f) => f[0] === 'Moto');
    expect(moto).toContain(`${Math.round(PERFILES.moto.vMax * 3.6)} km/h`);
    expect(moto).toContain(`${String(PERFILES.moto.largo).replace('.', ',')} m`);
  });

  it('el efecto de los huecos y el total de la demanda coinciden con el código', () => {
    expect(seccion('estado').tabla.filas.flat().join(' ')).toMatch(/Con huecos.*×0,5/);
    const total = Object.values(DEMANDA_BASE).reduce((s, x) => s + x, 0);
    expect(seccion('demanda').texto.join(' ')).toContain(total.toLocaleString('es-CO'));
  });

  it('incluye la fórmula del IDM, supuestos, limitaciones y referencias', () => {
    expect(seccion('idm').formula).toMatch(/v\/v0/);
    expect(seccion('supuestos').lista.join(' ')).toMatch(/Carrera 1ª/);
    expect(seccion('limitaciones').lista.join(' ')).toMatch(/calibrado/);
    const refs = seccion('referencias').lista.join(' ');
    for (const autor of ['Treiber', 'Kesting', 'Dijkstra', 'OpenStreetMap']) expect(refs).toContain(autor);
  });
});
