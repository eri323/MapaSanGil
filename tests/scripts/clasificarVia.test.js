import { describe, it, expect } from 'vitest';
import { clasificarVia, esViaVehicular } from '../../scripts/lib/clasificarVia.js';

describe('esViaVehicular', () => {
  it('acepta calles y rechaza peatonales', () => {
    expect(esViaVehicular({ highway: 'residential' })).toBe(true);
    expect(esViaVehicular({ highway: 'primary_link' })).toBe(true);
    expect(esViaVehicular({ highway: 'footway' })).toBe(false);
    expect(esViaVehicular({ highway: 'service' })).toBe(false);
    expect(esViaVehicular(undefined)).toBe(false);
  });

  it('acepta obras viales vehiculares y la Variante', () => {
    expect(esViaVehicular({ highway: 'construction', construction: 'trunk' })).toBe(true);
    expect(esViaVehicular({ highway: 'construction', name: 'Variante San Gil' })).toBe(true);
    expect(esViaVehicular({ highway: 'construction', construction: 'footway' })).toBe(false);
  });
});

describe('clasificarVia', () => {
  it('calle residencial sin etiquetas extra es doble sentido, pavimentada y en buen estado', () => {
    expect(clasificarVia({ highway: 'residential' })).toEqual({
      nombre: '',
      tipo: 'doble_sentido',
      sentido: 'ambos',
      carrilesPorSentido: 1,
      superficie: 'pavimento',
      estado: 'bueno',
      velocidadMax: 30,
      enConstruccion: false,
      esPuente: false,
    });
  });

  it('oneway=yes es un sentido; oneway=-1 queda marcado como inverso', () => {
    expect(clasificarVia({ highway: 'residential', oneway: 'yes' })).toMatchObject({
      tipo: 'un_sentido', sentido: 'adelante',
    });
    expect(clasificarVia({ highway: 'residential', oneway: '-1' })).toMatchObject({
      tipo: 'un_sentido', sentido: 'inverso',
    });
  });

  it('trunk y primary son Avenida Nacional', () => {
    expect(clasificarVia({ highway: 'trunk' }).tipo).toBe('avenida_nacional');
    expect(clasificarVia({ highway: 'primary', oneway: 'yes' })).toMatchObject({
      tipo: 'avenida_nacional', sentido: 'adelante',
    });
  });

  it('glorieta es de un sentido aunque no tenga oneway', () => {
    expect(clasificarVia({ highway: 'tertiary', junction: 'roundabout' })).toMatchObject({
      tipo: 'glorieta', sentido: 'adelante', velocidadMax: 20,
    });
  });

  it('la Variante en obra se reconoce por el nombre', () => {
    expect(clasificarVia({ highway: 'construction', construction: 'trunk', name: 'Variante San Gil' }))
      .toMatchObject({ tipo: 'variante', enConstruccion: true, velocidadMax: 60 });
  });

  it('doble calzada explícita', () => {
    expect(clasificarVia({ highway: 'secondary', oneway: 'yes', dual_carriageway: 'yes' }).tipo)
      .toBe('doble_calzada');
  });

  it('carriles: en doble sentido se reparten, en un sentido van todos', () => {
    expect(clasificarVia({ highway: 'secondary', lanes: '4' }).carrilesPorSentido).toBe(2);
    expect(clasificarVia({ highway: 'secondary', lanes: '3' }).carrilesPorSentido).toBe(1);
    expect(clasificarVia({ highway: 'secondary', lanes: '2', oneway: 'yes' }).carrilesPorSentido).toBe(2);
    expect(clasificarVia({ highway: 'secondary', lanes: 'x' }).carrilesPorSentido).toBe(1);
  });

  it('superficie y estado salen de surface y smoothness', () => {
    expect(clasificarVia({ highway: 'residential', surface: 'unpaved' }).superficie).toBe('destapado');
    expect(clasificarVia({ highway: 'residential', surface: 'paving_stones' }).superficie).toBe('adoquin');
    expect(clasificarVia({ highway: 'residential', smoothness: 'bad' }).estado).toBe('huecos');
    expect(clasificarVia({ highway: 'residential', smoothness: 'intermediate' }).estado).toBe('regular');
  });

  it('maxspeed: números, mph y valores raros', () => {
    expect(clasificarVia({ highway: 'residential', maxspeed: '40' }).velocidadMax).toBe(40);
    expect(clasificarVia({ highway: 'residential', maxspeed: '20 mph' }).velocidadMax).toBe(32);
    expect(clasificarVia({ highway: 'residential', maxspeed: 'none' }).velocidadMax).toBe(30);
    expect(clasificarVia({ highway: 'residential', maxspeed: 'signals' }).velocidadMax).toBe(30);
  });

  it('puentes', () => {
    expect(clasificarVia({ highway: 'trunk', bridge: 'yes' }).esPuente).toBe(true);
    expect(clasificarVia({ highway: 'trunk', bridge: 'viaduct' }).esPuente).toBe(true);
    expect(clasificarVia({ highway: 'trunk', bridge: 'no' }).esPuente).toBe(false);
  });
});

describe('clasificarVia · casos de la revisión', () => {
  it('maxspeed 0 o negativo se ignora: ninguna vía nace con velocidad 0', () => {
    expect(clasificarVia({ highway: 'residential', maxspeed: '0' }).velocidadMax).toBe(30);
    expect(clasificarVia({ highway: 'trunk', maxspeed: '0 mph' }).velocidadMax).toBe(50);
  });

  it('glorieta con oneway=no se respeta como doble sentido', () => {
    expect(clasificarVia({ highway: 'tertiary', junction: 'roundabout', oneway: 'no' }).sentido).toBe('ambos');
  });
});
