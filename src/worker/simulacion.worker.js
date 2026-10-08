import { crearControlador } from './controlador.js';

const TICK_MS = 50;
const controlador = crearControlador((mensaje, transferibles) => self.postMessage(mensaje, transferibles ?? []));

self.onmessage = ({ data }) => controlador.recibir(data);
setInterval(() => controlador.tick(TICK_MS), TICK_MS);
