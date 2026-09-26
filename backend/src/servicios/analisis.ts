import { analizarApuesta } from '../modelos/apuestas.js';
import type { PartidoFuente } from './proveedorDatos.js';
import { simularPartidoMonteCarlo } from './simuladorMonteCarlo.js';
import type { PosicionLiga } from './tablaPosiciones.js';

export function construirAnalisis(partido: PartidoFuente, tabla: PosicionLiga[]) {
  const estadisticaLocal = tabla.find((fila) => fila.equipo === partido.local);
  const estadisticaVisitante = tabla.find((fila) => fila.equipo === partido.visitante);
  if (!estadisticaLocal || !estadisticaVisitante) {
    throw new Error(`No hay estadísticas reales para ${partido.local} o ${partido.visitante}`);
  }
  const simulacion = simularPartidoMonteCarlo(estadisticaLocal, estadisticaVisitante, 10_000, partido);
  const { probabilidades } = simulacion;
  const probabilidadesMercado = {
    ...probabilidades,
    over25: simulacion.probabilidadOver25,
    ambosAnotan: simulacion.probabilidadAmbosAnotan,
    over8_5Corners: simulacion.probabilidadOver8_5Corners,
    over9_5Corners: simulacion.probabilidadOver9_5Corners,
    over10_5Corners: simulacion.probabilidadOver10_5Corners,
    over20_5Remates: simulacion.probabilidadOver20_5Remates,
    over7_5RematesPuerta: simulacion.probabilidadOver7_5RematesPuerta,
    over10_5RematesLocal: simulacion.probabilidadOver10_5RematesLocal,
    over10_5RematesVisitante: simulacion.probabilidadOver10_5RematesVisitante,
    over3_5RematesPuertaLocal: simulacion.probabilidadOver3_5RematesPuertaLocal,
    over3_5RematesPuertaVisitante: simulacion.probabilidadOver3_5RematesPuertaVisitante,
    unoX: simulacion.probabilidadDobleOportunidad.unoX,
    X2: simulacion.probabilidadDobleOportunidad.X2,
    doce: simulacion.probabilidadDobleOportunidad.doce
  };
  const apuestas = partido.cuotas.map((cuota) => {
    const probabilidad = probabilidadesMercado[cuota.seleccion as keyof typeof probabilidadesMercado] ?? 0;
    return { ...cuota, ...analizarApuesta(probabilidad, cuota.cuota) };
  });
  return {
    ...partido,
    estadisticas: {
      local: { ...estadisticaLocal, ausencias: partido.ausencias.local },
      visitante: { ...estadisticaVisitante, ausencias: partido.ausencias.visitante }
    },
    mediasGoles: simulacion.mediasGoles,
    marcadorEsperado: partido.estado === 'programado' ? simulacion.marcadorEsperado : null,
    probabilidadOver25: simulacion.probabilidadOver25,
    probabilidadAmbosAnotan: simulacion.probabilidadAmbosAnotan,
    probabilidadOver8_5Corners: simulacion.probabilidadOver8_5Corners,
    probabilidadOver9_5Corners: simulacion.probabilidadOver9_5Corners,
    probabilidadOver10_5Corners: simulacion.probabilidadOver10_5Corners,
    probabilidadDobleOportunidad: simulacion.probabilidadDobleOportunidad,
    iteracionesMonteCarlo: simulacion.iteraciones,
    probabilidades,
    apuestas
  };
}
