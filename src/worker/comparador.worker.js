import { crearControladorComparador } from './comparador.js';

const controlador = crearControladorComparador((mensaje) => self.postMessage(mensaje));
self.onmessage = ({ data }) => controlador.recibir(data);
