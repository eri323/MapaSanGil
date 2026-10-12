// Contenido de la pestaña "Cómo funciona". Los números salen de las constantes
// del motor: si el código cambia, la explicación cambia con él.

import {
  TIPOS_VEHICULO, ETIQUETA_VEHICULO, PERFILES, FACTOR_ESTADO, FACTOR_SUPERFICIE,
} from '../../sim/vehiculos.js';
import { ETIQUETA_ESTADO, ETIQUETA_SUPERFICIE } from '../../sim/tipos.js';
import { MOBIL } from '../../sim/mobil.js';
import { CICLO_SEMAFORO, ESPERA_CORTESIA } from '../../sim/cruces.js';
import { DEMANDA_BASE, MEZCLA_LOCAL, MEZCLA_PASO, PERFIL_HORARIO } from '../../sim/demanda.js';
import { PESO_NUEVA_MEDIDA } from '../../sim/rutas.js';
import { VENTANA_RECIENTE } from '../../sim/metricas.js';
import { VALORES_POR_DEFECTO } from '../../sim/motor.js';
import { CASCO_URBANO } from '../../escenarios/zonas.js';

const decimal = (x) => String(x).replace('.', ',');
const miles = (x) => Number(x).toLocaleString('es-CO');
const kmh = (ms) => `${Math.round(ms * 3.6)} km/h`;
const pct = (x) => `${Math.round(x * 100)} %`;
const mezcla = (m) => Object.entries(m).map(([tipo, p]) => `${pct(p)} ${ETIQUETA_VEHICULO[tipo].toLowerCase()}`).join(', ');

const NOMBRE_FLUJO = {
  local: 'Local (dentro del municipio)',
  paso: 'De paso (carros y motos)',
  pesado: 'Pesados de paso (camiones)',
  busNacional: 'Buses nacionales a la Terminal',
  busPaso: 'Buses nacionales de paso',
  intermunicipal: 'Buses intermunicipales al Terminalito',
};

export function construirContenido({ vias = null, cruces = null } = {}) {
  const { dt, umbralBloqueo, intervaloReruteo } = VALORES_POR_DEFECTO;
  const totalDemanda = Object.values(DEMANDA_BASE).reduce((s, x) => s + x, 0);
  const horaPico = PERFIL_HORARIO.indexOf(Math.max(...PERFIL_HORARIO));

  const secciones = [
    {
      id: 'objetivo',
      titulo: 'Para qué sirve',
      texto: [
        'El simulador muestra cómo funcionaría mejor o peor el tráfico de San Gil con distintos cambios: cerrar un puente, terminar la Variante, arreglar vías, cambiar sentidos o poner pares.',
        'Cada vehículo se simula por separado (modelo microscópico). Los números sirven para comparar escenarios entre sí, con las mismas condiciones, no para predecir tiempos exactos.',
      ],
    },
    {
      id: 'red',
      titulo: 'La red vial',
      texto: [
        `La red sale de OpenStreetMap: ${vias ? `${miles(vias)} vías` : 'las vías'} y ${cruces ? `${miles(cruces)} cruces` : 'los cruces'} de San Gil y sus salidas. Cada vía tiene tipo, sentido, carriles, superficie, estado y velocidad máxima.`,
        'Sobre OpenStreetMap se aplican correcciones de campo (por ejemplo, la Calle 12 entre Carreras 10 y 11 habilitada y los nombres reales de los puentes). San Gil no tiene semáforos: los cruces se controlan con pare, prioridad o la regla de la derecha.',
      ],
    },
    {
      id: 'vehiculos',
      titulo: 'Los vehículos',
      texto: ['Cada tipo tiene su propio comportamiento. Además, cada conductor maneja hasta 10 % más rápido o más lento que el promedio.'],
      tabla: {
        columnas: ['Tipo', 'Largo', 'Velocidad máx.', 'Aceleración', 'Frenado cómodo', 'Tiempo de seguridad', 'Hueco para cruzar'],
        filas: TIPOS_VEHICULO.map((tipo) => {
          const p = PERFILES[tipo];
          return [ETIQUETA_VEHICULO[tipo], `${decimal(p.largo)} m`, kmh(p.vMax), `${decimal(p.a)} m/s²`, `${decimal(p.b)} m/s²`, `${decimal(p.T)} s`, `${decimal(p.hueco)} s`];
        }),
      },
    },
    {
      id: 'idm',
      titulo: 'Cómo se mueve cada vehículo: IDM',
      texto: [
        'Con el Intelligent Driver Model (IDM), cada vehículo acelera hacia la velocidad que quiere y frena según la distancia y la velocidad del de adelante. De ahí salen solas las colas y el efecto acordeón.',
        `La simulación avanza en pasos de ${decimal(dt)} s y nunca frena más de 9 m/s², el límite físico de un frenado de emergencia.`,
      ],
      formula: 'a = a_max · [ 1 − (v/v0)⁴ − (s*/s)² ]\ns* = s0 + v·T + v·Δv / (2·√(a_max·b))\n\nv: velocidad · v0: velocidad deseada · s: distancia al de adelante\nΔv: diferencia de velocidad con el de adelante · s0: distancia mínima parado',
    },
    {
      id: 'estado',
      titulo: 'El estado de la vía',
      texto: [
        'El estado y la superficie multiplican la velocidad deseada. Con huecos, además, cada conductor reacciona distinto (unos esquivan despacio, otros pasan rápido): entre 0,7 y 1,3 veces el efecto.',
        'Por eso, al arreglar una vía, su tiempo de viaje baja y los conductores empiezan a usarla.',
      ],
      tabla: {
        columnas: ['Condición', 'Multiplica la velocidad por'],
        filas: [
          ...Object.entries(FACTOR_ESTADO).map(([k, f]) => [`Estado: ${ETIQUETA_ESTADO[k]}`, `×${decimal(f)}`]),
          ...Object.entries(FACTOR_SUPERFICIE).map(([k, f]) => [`Superficie: ${ETIQUETA_SUPERFICIE[k]}`, `×${decimal(f)}`]),
        ],
      },
    },
    {
      id: 'carriles',
      titulo: 'Cambio de carril: MOBIL',
      texto: [
        `Donde hay más de un carril, un vehículo cambia si gana más de ${decimal(MOBIL.umbral)} m/s² de aceleración, teniendo en cuenta a los demás con un factor de cortesía de ${decimal(MOBIL.cortesia)}, y nunca si obliga al de atrás a frenar más de ${MOBIL.frenadoSeguro} m/s².`,
      ],
    },
    {
      id: 'cruces',
      titulo: 'Los cruces',
      texto: ['En cada cruce, cada vía que llega tiene una regla:'],
      lista: [
        'Pare: el vehículo se detiene por completo y luego espera un hueco suficiente.',
        'Prioridad: la vía de mayor jerarquía (Avenida y Variante, luego doble calzada, doble sentido y un sentido) pasa sin parar; la otra cede.',
        'Glorieta: quien circula en la glorieta tiene prioridad.',
        'Sin señal entre vías iguales: se cede al que viene por la derecha.',
        `Semáforo (solo si se agrega en el editor): ${CICLO_SEMAFORO.verde} s de verde por grupo y ${CICLO_SEMAFORO.todoRojo} s de todo rojo.`,
        `Ceder es aceptar un hueco: se cruza si el próximo vehículo con prelación tarda más que el hueco del tipo (tabla de vehículos). Tras ${ESPERA_CORTESIA} s esperando, se pasa por cortesía si el cruce está libre.`,
      ],
    },
    {
      id: 'rutas',
      titulo: 'Las rutas',
      texto: [
        'Cada viaje escoge la ruta más rápida con el algoritmo de Dijkstra, usando el tiempo de viaje que se está midiendo en cada vía, no solo el teórico.',
        `Cada vez que un vehículo sale de una vía, su tiempo actualiza la medida de esa vía (la nueva pesa ${pct(PESO_NUEVA_MEDIDA)}). Los vehículos recalculan su ruta cada ${intervaloReruteo} s, así que descubren poco a poco una vía arreglada o un puente nuevo.`,
        `Restricción de pesados de paso: con la Variante terminada, camiones y buses de paso solo pueden usar Avenida y Variante por fuera de un círculo de ${miles(CASCO_URBANO.radio)} m alrededor del Parque La Libertad. Si la Variante no conecta, pasan por el centro como hoy.`,
      ],
    },
    {
      id: 'demanda',
      titulo: 'La demanda de viajes',
      texto: [
        `En una hora de referencia se generan ${miles(totalDemanda)} viajes, repartidos así. La cantidad cambia con la hora del día (el pico es a las ${horaPico}:00) y con la temporada (alta = ×1,4).`,
        `Locales: ${mezcla(MEZCLA_LOCAL)}. De paso: ${mezcla(MEZCLA_PASO)}.`,
      ],
      tabla: {
        columnas: ['Flujo', 'Viajes por hora'],
        filas: Object.entries(DEMANDA_BASE).map(([f, v]) => [NOMBRE_FLUJO[f] ?? f, miles(v)]),
      },
    },
    {
      id: 'metricas',
      titulo: 'Las métricas',
      lista: [
        'Tiempo medio de viaje: de la salida a la llegada, de los viajes completados.',
        'Demora: cuánto tardó cada viaje por encima de lo que tardaría con las vías libres.',
        `Demora de los últimos ${VENTANA_RECIENTE / 60} min: la misma demora, solo de los viajes recientes; refleja pronto un cambio hecho en vivo.`,
        `Bloqueo: un vehículo quieto más de ${umbralBloqueo} s se retira y se cuenta. Es un síntoma de colapso (equivale al "teleport" de SUMO).`,
        'Retirados por cambios: vehículos que iban por una vía que se editó en vivo (por ejemplo, se invirtió).',
        'Viajes imposibles: no había ruta entre su origen y su destino.',
      ],
      texto: ['Estas son las métricas que muestran el panel y el comparador:'],
    },
    {
      id: 'comparador',
      titulo: 'Cómo se comparan escenarios',
      texto: [
        'Cada escenario corre sin dibujar, con la misma duración y las mismas semillas (la semilla fija la parte aleatoria). Se reporta el promedio entre semillas y su rango (mínimo–máximo).',
        'Así se responde "¿y si fue suerte?": si los rangos de dos escenarios no se tocan, la diferencia no es casualidad.',
      ],
    },
    {
      id: 'supuestos',
      titulo: 'Supuestos',
      texto: ['Lo que no viene de OpenStreetMap ni de trabajo de campo es un supuesto razonable:'],
      lista: [
        'Los volúmenes de viajes y su reparto por hora (no hay aforos).',
        'La Carrera 1ª destapada y con huecos (la base Python preguntaba si "pavimentada alcanza como vía alterna"); falta la lista real de vías en mal estado.',
        'El trazado de la Variante en los escenarios precargados: une con líneas aproximadas el tramo de OpenStreetMap con la Avenida a cada lado.',
        'La ubicación del puente propuesto: un cruce corto sobre el Fonce, lejos de los puentes existentes.',
        `El casco urbano para la restricción: un círculo de ${miles(CASCO_URBANO.radio)} m.`,
        'Los parámetros de cada tipo de vehículo y el efecto de los huecos.',
      ],
    },
    {
      id: 'limitaciones',
      titulo: 'Limitaciones',
      texto: ['Hay que decirlas antes de citar cualquier número:'],
      lista: [
        'El modelo no está calibrado con aforos reales. Estaría calibrado si los flujos simulados quedaran dentro de ±15 % de conteos reales en al menos 85 % de los puntos (criterio GEH < 5).',
        'OpenStreetMap está incompleto en San Gil: faltan sentidos, pares y el estado de casi todas las vías.',
        'Las motos no se cuelan entre carriles; solo son más cortas y ágiles.',
        'No hay tráfico inducido: si una obra mejora los tiempos, no aparecen viajes nuevos.',
        'No hay peatones, parqueo en vía ni cargue y descargue.',
      ],
    },
    {
      id: 'referencias',
      titulo: 'Referencias',
      texto: ['Modelos y datos usados:'],
      lista: [
        'Treiber, M., Hennecke, A. y Helbing, D. (2000). Congested traffic states in empirical observations and microscopic simulations. Physical Review E, 62, 1805–1824.',
        'Kesting, A., Treiber, M. y Helbing, D. (2007). General lane-changing model MOBIL for car-following models. Transportation Research Record, 1999, 86–94.',
        'Dijkstra, E. W. (1959). A note on two problems in connexion with graphs. Numerische Mathematik, 1, 269–271.',
        'Lopez, P. A. et al. (2018). Microscopic traffic simulation using SUMO. IEEE ITSC. (Base Python original del proyecto.)',
        'Datos de la red: © colaboradores de OpenStreetMap, licencia ODbL.',
      ],
    },
  ];
  return { secciones };
}
