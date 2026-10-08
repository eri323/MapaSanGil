// MOBIL (Kesting, Treiber y Helbing, 2007): cambiar de carril si la ganancia
// propia, más una fracción de lo que ganan o pierden los demás, supera un
// umbral, y nunca si obliga al nuevo seguidor a frenar más de lo seguro.

export const MOBIL = { cortesia: 0.3, umbral: 0.2, frenadoSeguro: 4 };

export function convieneCambiar({ aActual, aNueva, seguidorNuevo = null, seguidorViejo = null }, parametros = MOBIL) {
  if (seguidorNuevo && seguidorNuevo.despues < -parametros.frenadoSeguro) return false;
  const ganancia = aNueva - aActual;
  const efectoEnOtros = (seguidorNuevo ? seguidorNuevo.despues - seguidorNuevo.antes : 0)
    + (seguidorViejo ? seguidorViejo.despues - seguidorViejo.antes : 0);
  return ganancia + parametros.cortesia * efectoEnOtros > parametros.umbral;
}
