// Generador pseudoaleatorio con semilla (mulberry32). Con la misma semilla
// la simulación da exactamente el mismo resultado: así se comparan escenarios.

export function crearAleatorio(semilla) {
  let estado = semilla >>> 0;

  const siguiente = () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let x = estado;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };

  return {
    siguiente,
    entre: (min, max) => min + (max - min) * siguiente(),
    entero: (n) => Math.floor(siguiente() * n),
    elegir: (lista) => lista[Math.floor(siguiente() * lista.length)],
    elegirPonderado(pesos) {
      const entradas = Object.entries(pesos);
      const total = entradas.reduce((suma, [, p]) => suma + p, 0);
      let r = siguiente() * total;
      for (const [clave, peso] of entradas) {
        r -= peso;
        if (r < 0) return clave;
      }
      return entradas.filter(([, p]) => p > 0).at(-1)[0];
    },
    exponencial: (tasa) => -Math.log(1 - siguiente()) / tasa,
  };
}
