// Aplica las correcciones de campo sobre los datos de OSM antes de convertirlos
// en red: vías que OSM no tiene, o que tiene mal, según quien conoce San Gil.

export function aplicarCorrecciones(overpass, { viasAgregadas = [] } = {}) {
  const nodos = new Set(overpass.elements.filter((e) => e.type === 'node').map((e) => e.id));
  for (const via of viasAgregadas) {
    const faltan = via.nodes.filter((id) => !nodos.has(id));
    if (faltan.length) {
      throw new Error(`Corrección "${via.tags?.name ?? via.id}": faltan los nodos ${faltan.join(', ')} en los datos de OSM`);
    }
  }
  const reemplazadas = new Set(viasAgregadas.map((v) => v.id));
  return {
    ...overpass,
    elements: [
      ...overpass.elements.filter((e) => !(e.type === 'way' && reemplazadas.has(e.id))),
      ...viasAgregadas.map((v) => ({ type: 'way', ...v })),
    ],
  };
}

// Estado y superficie de las vías según trabajo de campo (OSM casi nunca los trae).
export function aplicarEstadosCampo(vias, reglas = []) {
  return vias.map((v) => {
    const regla = reglas.find((r) => r.nombres.includes(v.nombre));
    if (!regla) return v;
    return {
      ...v,
      ...(regla.estado && { estado: regla.estado }),
      ...(regla.superficie && { superficie: regla.superficie }),
    };
  });
}
