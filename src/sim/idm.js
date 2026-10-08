// Intelligent Driver Model (Treiber, Hennecke y Helbing, 2000).
//   a_IDM = a · [ 1 − (v/v0)^4 − (s*/s)^2 ]
//   s*    = s0 + v·T + v·Δv / (2·√(a·b))
// gap = metros libres hasta la cola del vehículo de adelante (o el obstáculo).

const FRENADO_MAXIMO = -9; // m/s², límite físico de un frenado de emergencia

export function aceleracionIDM(perfil, v, v0, gap, vLider) {
  // Si va más rápido de lo que quiere (entró a una vía más lenta), el término
  // libre se vuelve enorme; se limita al frenado cómodo, como hace un conductor.
  const libre = Math.max(-perfil.b, perfil.a * (1 - (v / v0) ** 4));
  if (!Number.isFinite(gap)) return libre;
  const deseada = perfil.s0
    + Math.max(0, v * perfil.T + (v * (v - vLider)) / (2 * Math.sqrt(perfil.a * perfil.b)));
  const s = Math.max(gap, 0.01);
  return Math.max(FRENADO_MAXIMO, libre - perfil.a * (deseada / s) ** 2);
}

// Avance de un paso con aceleración constante. Si el frenado lo detiene antes
// de terminar el paso, se detiene ahí: los vehículos nunca retroceden.
export function avanzar(v, a, dt) {
  const vNueva = v + a * dt;
  if (vNueva < 0) return { v: 0, dx: a < 0 ? (v * v) / (-2 * a) : 0 };
  return { v: vNueva, dx: v * dt + 0.5 * a * dt * dt };
}
