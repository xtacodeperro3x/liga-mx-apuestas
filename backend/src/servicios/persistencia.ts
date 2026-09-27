import { PrismaClient } from '@prisma/client';
import type { PartidoFuente } from './proveedorDatos.js';
import type { PosicionLiga } from './tablaPosiciones.js';
import type { Liga } from './scraper.js';
import type { SeleccionMercado } from './simuladorMonteCarlo.js';

const prisma = new PrismaClient();

export async function leerPartidos(liga: Liga): Promise<PartidoFuente[]> {
  const registros = await prisma.partido.findMany({
    where: { liga },
    orderBy: { fecha: 'asc' },
    include: { equipoLocal: true, equipoVisitante: true, cuotas: true }
  });
  return registros.map((partido) => {
    const finalizado = partido.golesLocal !== null && partido.golesVisitante !== null;
    return {
      liga,
      externoId: partido.externoId,
      fecha: partido.fecha.toISOString(),
      jornada: 0,
      estado: finalizado ? 'finalizado' : 'programado',
      minuto: finalizado ? 90 : null,
      marcador: finalizado ? { local: partido.golesLocal!, visitante: partido.golesVisitante! } : null,
      ausencias: { local: [], visitante: [] },
      local: partido.equipoLocal.nombre,
      visitante: partido.equipoVisitante.nombre,
      golesLocal: partido.golesLocal,
      golesVisitante: partido.golesVisitante,
      cuotas: partido.cuotas.map((cuota) => ({
        casa: cuota.casa,
        mercado: cuota.mercado,
        seleccion: cuota.seleccion as SeleccionMercado,
        cuota: cuota.cuota
      }))
    };
  });
}

export async function leerTablaPosiciones(liga: Liga): Promise<PosicionLiga[]> {
  const registros = await prisma.estadisticaEquipo.findMany({
    where: { equipo: { liga } },
    orderBy: { fechaCorte: 'desc' },
    include: { equipo: true }
  });
  const unicos = new Map<string, typeof registros[number]>();
  for (const registro of registros) if (!unicos.has(registro.equipo.nombre)) unicos.set(registro.equipo.nombre, registro);
  return [...unicos.values()].map((registro, indice) => ({
    posicion: indice + 1,
    equipo: registro.equipo.nombre,
    puntos: 0,
    jugados: registro.partidos,
    diferencia: registro.golesFavor - registro.golesContra,
    golesFavor: registro.golesFavor,
    golesContra: registro.golesContra,
    xG: registro.xG,
    posesion: registro.posesion,
    tirosAPuerta: registro.tirosAPuerta,
    promedioCorners: registro.promedioCorners,
    promedioRemates: registro.promedioRemates,
    forma: []
  }));
}

export async function guardarPartidos(partidos: PartidoFuente[]) {
  for (const partido of partidos) {
    const local = await prisma.equipo.upsert({
      where: { nombre_liga: { nombre: partido.local, liga: partido.liga } },
      update: {},
      create: { nombre: partido.local, liga: partido.liga }
    });
    const visitante = await prisma.equipo.upsert({
      where: { nombre_liga: { nombre: partido.visitante, liga: partido.liga } },
      update: {},
      create: { nombre: partido.visitante, liga: partido.liga }
    });
    const guardado = await prisma.partido.upsert({
      where: { externoId: partido.externoId },
      update: {
        fecha: new Date(partido.fecha),
        golesLocal: partido.golesLocal,
        golesVisitante: partido.golesVisitante
        ,liga: partido.liga
      },
      create: {
        externoId: partido.externoId,
        fecha: new Date(partido.fecha),
        equipoLocalId: local.id,
        equipoVisitanteId: visitante.id,
        golesLocal: partido.golesLocal,
        golesVisitante: partido.golesVisitante
        ,liga: partido.liga
      }
    });
    await prisma.cuota.deleteMany({ where: { partidoId: guardado.id } });
    if (partido.cuotas.length > 0) {
      await prisma.cuota.createMany({
        data: partido.cuotas.map((cuota) => ({ ...cuota, partidoId: guardado.id }))
      });
    }
  }
}

export async function guardarEstadisticas(tabla: PosicionLiga[], fechaCorte = new Date(), liga = 'LIGA_MX') {
  for (const fila of tabla) {
    const equipo = await prisma.equipo.upsert({
      where: { nombre_liga: { nombre: fila.equipo, liga } },
      update: {},
      create: { nombre: fila.equipo, liga }
    });
    await prisma.estadisticaEquipo.upsert({
      where: { equipoId_fechaCorte: { equipoId: equipo.id, fechaCorte } },
      update: {
        golesFavor: fila.golesFavor,
        golesContra: fila.golesContra,
        partidos: fila.jugados,
        xG: fila.xG,
        posesion: fila.posesion,
        tirosAPuerta: fila.tirosAPuerta,
        promedioCorners: fila.promedioCorners,
        promedioRemates: fila.promedioRemates
      },
      create: {
        equipoId: equipo.id,
        fechaCorte,
        golesFavor: fila.golesFavor,
        golesContra: fila.golesContra,
        partidos: fila.jugados,
        xG: fila.xG,
        posesion: fila.posesion,
        tirosAPuerta: fila.tirosAPuerta,
        promedioCorners: fila.promedioCorners,
        promedioRemates: fila.promedioRemates
      }
    });
  }
}
