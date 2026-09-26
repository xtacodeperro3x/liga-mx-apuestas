import cron from 'node-cron';
import { guardarEstadisticas, guardarPartidos } from './persistencia.js';
import { obtenerPartidos } from './proveedorDatos.js';
import { obtenerTablaPosiciones } from './tablaPosiciones.js';
import { resolverBoletosPendientes } from './ledgerBoletos.js';

let sincronizacionEnCurso = false;

export async function sincronizarJornada() {
  if (sincronizacionEnCurso) {
    console.info('Sincronización omitida: la tarea anterior sigue en curso.');
    return;
  }
  sincronizacionEnCurso = true;
  try {
    const [partidos, tabla] = await Promise.all([obtenerPartidos(), obtenerTablaPosiciones()]);
    await Promise.all([guardarPartidos(partidos), guardarEstadisticas(tabla)]);
    await resolverBoletosPendientes();
    console.info(`Cron: sincronizados ${partidos.length} partidos y cuotas.`);
  } finally {
    sincronizacionEnCurso = false;
  }
}

export function iniciarTareasCron() {
  cron.schedule('*/5 * * * *', () => {
    sincronizarJornada().catch((error) => console.error('Error en la sincronización automática:', error));
  });
  console.info('Cron de Liga MX activo: sincronización cada 5 minutos.');
}
