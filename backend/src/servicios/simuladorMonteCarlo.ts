import type { PosicionLiga } from './tablaPosiciones.js';

export type ProbabilidadesMonteCarlo = {
  local: number;
  empate: number;
  visitante: number;
};

export type MediasMonteCarlo = {
  local: number;
  visitante: number;
};

export type ResultadoMonteCarlo = {
  probabilidades: ProbabilidadesMonteCarlo;
  mediasGoles: MediasMonteCarlo;
  iteraciones: number;
  marcadorEsperado: { local: number; visitante: number };
  probabilidadOver25: number;
  probabilidadAmbosAnotan: number;
  probabilidadOver8_5Corners: number;
  probabilidadOver9_5Corners: number;
  probabilidadOver10_5Corners: number;
  probabilidadOver20_5Remates: number;
  probabilidadOver7_5RematesPuerta: number;
  probabilidadOver10_5RematesLocal: number;
  probabilidadOver10_5RematesVisitante: number;
  probabilidadOver3_5RematesPuertaLocal: number;
  probabilidadOver3_5RematesPuertaVisitante: number;
  probabilidadDobleOportunidad: { unoX: number; X2: number; doce: number };
};

export type SeguimientoEnVivo = {
  estado: 'programado' | 'en_vivo' | 'finalizado';
  minuto: number | null;
  marcador: { local: number | null; visitante: number | null } | null;
  ausencias?: { local: string[]; visitante: string[] };
};

export type SeleccionMercado = 'local' | 'empate' | 'visitante' | 'over25' | 'over8_5Corners' | 'over9_5Corners' | 'over10_5Corners' | 'over20_5Remates' | 'over7_5RematesPuerta' | 'over10_5RematesLocal' | 'over10_5RematesVisitante' | 'over3_5RematesPuertaLocal' | 'over3_5RematesPuertaVisitante' | 'ambosAnotan' | 'unoX' | 'X2' | 'doce';

function muestrearPoisson(media: number): number {
  const limite = Math.exp(-media);
  let producto = 1;
  let goles = 0;
  do {
    goles += 1;
    producto *= Math.random();
  } while (producto > limite);
  return goles - 1;
}

function limitarMedia(media: number): number {
  return Math.max(0.05, Math.min(media, 6));
}

function calcularMediaOfensiva(equipo: PosicionLiga, rival: PosicionLiga): number {
  const promedioGoles = (equipo.golesFavor / Math.max(equipo.jugados, 1) + rival.golesContra / Math.max(rival.jugados, 1)) / 2;
  const ajusteXG = equipo.xG === null ? promedioGoles : equipo.xG / Math.max(equipo.jugados, 1);
  const ajustePuntos = 0.85 + Math.min(equipo.puntos / Math.max(equipo.jugados, 1), 4) * 0.05;
  return limitarMedia(((promedioGoles * 0.55) + (ajusteXG * 0.45)) * ajustePuntos);
}

function cumpleSeleccion(seleccion: SeleccionMercado, golesLocal: number, golesVisitante: number, cornersTotales: number, rematesTotales: number, rematesPuertaTotales: number, rematesLocal: number, rematesVisitante: number, rematesPuertaLocal: number, rematesPuertaVisitante: number): boolean {
  switch (seleccion) {
    case 'local': return golesLocal > golesVisitante;
    case 'empate': return golesLocal === golesVisitante;
    case 'visitante': return golesVisitante > golesLocal;
    case 'over25': return golesLocal + golesVisitante > 2.5;
    case 'over8_5Corners': return cornersTotales > 8.5;
    case 'over9_5Corners': return cornersTotales > 9.5;
    case 'over10_5Corners': return cornersTotales > 10.5;
    case 'over20_5Remates': return rematesTotales > 20.5;
    case 'over7_5RematesPuerta': return rematesPuertaTotales > 7.5;
    case 'over10_5RematesLocal': return rematesLocal > 10.5;
    case 'over10_5RematesVisitante': return rematesVisitante > 10.5;
    case 'over3_5RematesPuertaLocal': return rematesPuertaLocal > 3.5;
    case 'over3_5RematesPuertaVisitante': return rematesPuertaVisitante > 3.5;
    case 'ambosAnotan': return golesLocal > 0 && golesVisitante > 0;
    case 'unoX': return golesLocal >= golesVisitante;
    case 'X2': return golesVisitante >= golesLocal;
    case 'doce': return golesLocal !== golesVisitante;
  }
}

export function calcularInterseccionMonteCarlo(
  local: PosicionLiga,
  visitante: PosicionLiga,
  selecciones: SeleccionMercado[],
  iteraciones = 10_000,
  seguimiento?: SeguimientoEnVivo
): number {
  if (!Number.isInteger(iteraciones) || iteraciones <= 0) throw new Error('El número de iteraciones debe ser un entero positivo');
  if (selecciones.length === 0) return 1;
  const mediasBase = {
    local: calcularMediaOfensiva(local, visitante) * 1.08 * (seguimiento?.ausencias?.local.length ? 0.85 : 1),
    visitante: calcularMediaOfensiva(visitante, local) * (seguimiento?.ausencias?.visitante.length ? 0.85 : 1)
  };
  const enVivo = seguimiento?.estado === 'en_vivo';
  const minuto = enVivo ? Math.max(0, Math.min(90, seguimiento?.minuto ?? 0)) : 0;
  const proporcionRestante = enVivo ? Math.max(0, (90 - minuto) / 90) : 1;
  const marcadorLocal = enVivo ? Math.max(0, seguimiento?.marcador?.local ?? 0) : 0;
  const marcadorVisitante = enVivo ? Math.max(0, seguimiento?.marcador?.visitante ?? 0) : 0;
  const mediaCornersLocal = Math.max(0.05, local.promedioCorners ?? 4.5) * proporcionRestante;
  const mediaCornersVisitante = Math.max(0.05, visitante.promedioCorners ?? 4.5) * proporcionRestante;
  const mediaRematesLocal = Math.max(0.05, local.promedioRemates ?? 11) * proporcionRestante;
  const mediaRematesVisitante = Math.max(0.05, visitante.promedioRemates ?? 11) * proporcionRestante;
  const mediaRematesPuertaLocal = Math.max(0.05, local.tirosAPuerta ?? 3.5) * proporcionRestante;
  const mediaRematesPuertaVisitante = Math.max(0.05, visitante.tirosAPuerta ?? 3.5) * proporcionRestante;
  let favorables = 0;
  for (let iteracion = 0; iteracion < iteraciones; iteracion += 1) {
    const golesLocal = marcadorLocal + muestrearPoisson(mediasBase.local * proporcionRestante);
    const golesVisitante = marcadorVisitante + muestrearPoisson(mediasBase.visitante * proporcionRestante);
    const cornersTotales = muestrearPoisson(mediaCornersLocal) + muestrearPoisson(mediaCornersVisitante);
    const rematesPuertaLocal = muestrearPoisson(mediaRematesPuertaLocal);
    const rematesPuertaVisitante = muestrearPoisson(mediaRematesPuertaVisitante);
    const rematesPuertaTotales = rematesPuertaLocal + rematesPuertaVisitante;
    const rematesLocal = muestrearPoisson(mediaRematesLocal);
    const rematesVisitante = muestrearPoisson(mediaRematesVisitante);
    const rematesTotales = rematesLocal + rematesVisitante;
    if (selecciones.every((seleccion) => cumpleSeleccion(seleccion, golesLocal, golesVisitante, cornersTotales, rematesTotales, rematesPuertaTotales, rematesLocal, rematesVisitante, rematesPuertaLocal, rematesPuertaVisitante))) favorables += 1;
  }
  return favorables / iteraciones;
}

export function simularPartidoMonteCarlo(
  local: PosicionLiga,
  visitante: PosicionLiga,
  iteraciones = 10_000,
  seguimiento?: SeguimientoEnVivo
): ResultadoMonteCarlo {
  if (!Number.isInteger(iteraciones) || iteraciones <= 0) {
    throw new Error('El número de iteraciones debe ser un entero positivo');
  }

  const mediasBase = {
    local: calcularMediaOfensiva(local, visitante) * 1.08 * (seguimiento?.ausencias?.local.length ? 0.85 : 1),
    visitante: calcularMediaOfensiva(visitante, local) * (seguimiento?.ausencias?.visitante.length ? 0.85 : 1)
  };
  const enVivo = seguimiento?.estado === 'en_vivo';
  const minuto = enVivo ? Math.max(0, Math.min(90, seguimiento?.minuto ?? 0)) : 0;
  const proporcionRestante = enVivo ? Math.max(0, (90 - minuto) / 90) : 1;
  const marcador = {
    local: enVivo ? Math.max(0, seguimiento?.marcador?.local ?? 0) : 0,
    visitante: enVivo ? Math.max(0, seguimiento?.marcador?.visitante ?? 0) : 0
  };
  const mediasGoles = {
    local: mediasBase.local * proporcionRestante,
    visitante: mediasBase.visitante * proporcionRestante
  };
  let victoriasLocal = 0;
  let empates = 0;
  let victoriasVisitante = 0;
  const marcadores: Record<string, number> = {};
  let over25 = 0;
  let ambosAnotan = 0;
  let over8_5Corners = 0;
  let over9_5Corners = 0;
  let over10_5Corners = 0;
  let over20_5Remates = 0;
  let over7_5RematesPuerta = 0;
  let over10_5RematesLocal = 0;
  let over10_5RematesVisitante = 0;
  let over3_5RematesPuertaLocal = 0;
  let over3_5RematesPuertaVisitante = 0;
  const mediaCornersLocal = Math.max(0.05, local.promedioCorners ?? 4.5) * proporcionRestante;
  const mediaCornersVisitante = Math.max(0.05, visitante.promedioCorners ?? 4.5) * proporcionRestante;
  const mediaRematesLocal = Math.max(0.05, local.promedioRemates ?? 11) * proporcionRestante;
  const mediaRematesVisitante = Math.max(0.05, visitante.promedioRemates ?? 11) * proporcionRestante;
  const mediaRematesPuertaLocal = Math.max(0.05, local.tirosAPuerta ?? 3.5) * proporcionRestante;
  const mediaRematesPuertaVisitante = Math.max(0.05, visitante.tirosAPuerta ?? 3.5) * proporcionRestante;

  for (let iteracion = 0; iteracion < iteraciones; iteracion += 1) {
    const golesLocal = marcador.local + muestrearPoisson(mediasGoles.local);
    const golesVisitante = marcador.visitante + muestrearPoisson(mediasGoles.visitante);
    const claveMarcador = `${golesLocal}-${golesVisitante}`;
    marcadores[claveMarcador] = (marcadores[claveMarcador] ?? 0) + 1;
    if (golesLocal + golesVisitante > 2.5) over25 += 1;
    if (golesLocal > 0 && golesVisitante > 0) ambosAnotan += 1;
    const cornersTotales = muestrearPoisson(mediaCornersLocal) + muestrearPoisson(mediaCornersVisitante);
    if (cornersTotales > 8.5) over8_5Corners += 1;
    if (cornersTotales > 9.5) over9_5Corners += 1;
    if (cornersTotales > 10.5) over10_5Corners += 1;
    const rematesLocal = muestrearPoisson(mediaRematesLocal);
    const rematesVisitante = muestrearPoisson(mediaRematesVisitante);
    const rematesTotales = rematesLocal + rematesVisitante;
    const rematesPuertaLocal = muestrearPoisson(mediaRematesPuertaLocal);
    const rematesPuertaVisitante = muestrearPoisson(mediaRematesPuertaVisitante);
    const rematesPuertaTotales = rematesPuertaLocal + rematesPuertaVisitante;
    if (rematesTotales > 20.5) over20_5Remates += 1;
    if (rematesPuertaTotales > 7.5) over7_5RematesPuerta += 1;
    if (rematesLocal > 10.5) over10_5RematesLocal += 1;
    if (rematesVisitante > 10.5) over10_5RematesVisitante += 1;
    if (rematesPuertaLocal > 3.5) over3_5RematesPuertaLocal += 1;
    if (rematesPuertaVisitante > 3.5) over3_5RematesPuertaVisitante += 1;
    if (golesLocal > golesVisitante) victoriasLocal += 1;
    else if (golesLocal === golesVisitante) empates += 1;
    else victoriasVisitante += 1;
  }

  const marcadorEsperado = Object.entries(marcadores)
    .sort(([, cantidadA], [, cantidadB]) => cantidadB - cantidadA)[0]?.[0].split('-').map(Number) ?? [0, 0];
  return {
    probabilidades: {
      local: victoriasLocal / iteraciones,
      empate: empates / iteraciones,
      visitante: victoriasVisitante / iteraciones
    },
    mediasGoles,
    iteraciones,
    marcadorEsperado: { local: marcadorEsperado[0], visitante: marcadorEsperado[1] },
    probabilidadOver25: over25 / iteraciones,
    probabilidadAmbosAnotan: ambosAnotan / iteraciones,
    probabilidadOver8_5Corners: over8_5Corners / iteraciones,
    probabilidadOver9_5Corners: over9_5Corners / iteraciones,
    probabilidadOver10_5Corners: over10_5Corners / iteraciones,
    probabilidadOver20_5Remates: over20_5Remates / iteraciones,
    probabilidadOver7_5RematesPuerta: over7_5RematesPuerta / iteraciones,
    probabilidadOver10_5RematesLocal: over10_5RematesLocal / iteraciones,
    probabilidadOver10_5RematesVisitante: over10_5RematesVisitante / iteraciones,
    probabilidadOver3_5RematesPuertaLocal: over3_5RematesPuertaLocal / iteraciones,
    probabilidadOver3_5RematesPuertaVisitante: over3_5RematesPuertaVisitante / iteraciones,
    probabilidadDobleOportunidad: {
      unoX: (victoriasLocal + empates) / iteraciones,
      X2: (empates + victoriasVisitante) / iteraciones,
      doce: (victoriasLocal + victoriasVisitante) / iteraciones
    }
  };
}
