# Simulador de tráfico · San Gil

Proyecto universitario: mapa de San Gil (Santander) con tráfico simulado y
editable, para ver cómo funcionaría **mejor o peor** el tráfico con ciertos
cambios (puentes, Variante, arreglo de vías, sentidos, pares). Se presenta en
vivo en clase y se sustenta.

- Spec: `docs/superpowers/specs/2026-10-08-simulador-trafico-sangil-design.md`
- Planes por etapa: `docs/superpowers/plans/`
- Base Python original (referencia, no se ejecuta): `python-original/`

## Estado y decisiones

@.claude/contexto/estado.md
@.claude/contexto/decisiones.md

La bitácora de sesiones está en `.claude/contexto/bitacora.md`; léela si
necesitas el detalle de qué se hizo y cuándo.

## Comandos

- `npm run dev` — app en local
- `npm test` — pruebas del motor
- `npm run build` — build de producción
- `npm run red` — vuelve a descargar la red de OSM (solo si cambia el área)

## Convenciones

- JavaScript, no TypeScript.
- `src/sim/` es JavaScript puro: nada de React ni APIs del navegador.
- Nombres de código y textos de la interfaz en español.
- TDD en el motor: test que falla, implementación, test que pasa, commit.

## Al cerrar cada sesión

1. Actualizar `.claude/contexto/estado.md` (etapa, qué sigue, bloqueos).
2. Agregar una entrada corta a `.claude/contexto/bitacora.md`.
3. Si se tomó una decisión nueva, agregarla a `.claude/contexto/decisiones.md`.
