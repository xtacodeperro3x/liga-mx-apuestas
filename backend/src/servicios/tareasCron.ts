import cron from 'node-cron';
import { guardarEstadisticas, guardarPartidos } from './persistencia.js';
import { obtenerPartidos } from './proveedorDatos.js';
import { obtenerTablaPosiciones } from './tablaPosiciones.js';
import { resolverBoletosPendientes } from './ledgerBoletos.js';
import { LIGAS_DISPONIBLES } from './scraper.js';

let sincronizacionEnCurso = false;

export async function sincronizarJornada() {
  if (sincronizacionEnCurso) {
    console.info('Sincronización omitida: la tarea anterior sigue en curso.');
    return;
  }
  sincronizacionEnCurso = true;
  try {
    let totalPartidos = 0;
    for (const liga of LIGAS_DISPONIBLES) {
      const [partidos, tabla] = await Promise.all([obtenerPartidos(liga), obtenerTablaPosiciones(liga)]);
      await Promise.all([guardarPartidos(partidos), guardarEstadisticas(tabla, new Date(), liga)]);
      totalPartidos += partidos.length;
    }
    await resolverBoletosPendientes();
    console.info(`Cron multiliga: sincronizados ${totalPartidos} partidos y cuotas.`);
  } finally {
    sincronizacionEnCurso = false;
  }
}

export function iniciarTareasCron() {
  cron.schedule('*/5 * * * *', () => {
    sincronizarJornada().catch((error) => console.error('Error en la sincronización automática:', error));
  });
  console.info('Cron multiliga activo: sincronización cada 5 minutos.');
}
