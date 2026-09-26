import { PrismaClient } from '@prisma/client';
import type { PartidoFuente } from './proveedorDatos.js';
import type { PosicionLiga } from './tablaPosiciones.js';

const prisma = new PrismaClient();

export async function guardarPartidos(partidos: PartidoFuente[]) {
  for (const partido of partidos) {
    const local = await prisma.equipo.upsert({
      where: { nombre: partido.local },
      update: {},
      create: { nombre: partido.local }
    });
    const visitante = await prisma.equipo.upsert({
      where: { nombre: partido.visitante },
      update: {},
      create: { nombre: partido.visitante }
    });
    const guardado = await prisma.partido.upsert({
      where: { externoId: partido.externoId },
      update: {
        fecha: new Date(partido.fecha),
        golesLocal: partido.golesLocal,
        golesVisitante: partido.golesVisitante
      },
      create: {
        externoId: partido.externoId,
        fecha: new Date(partido.fecha),
        equipoLocalId: local.id,
        equipoVisitanteId: visitante.id,
        golesLocal: partido.golesLocal,
        golesVisitante: partido.golesVisitante
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

export async function guardarEstadisticas(tabla: PosicionLiga[], fechaCorte = new Date()) {
  for (const fila of tabla) {
    const equipo = await prisma.equipo.upsert({
      where: { nombre: fila.equipo },
      update: {},
      create: { nombre: fila.equipo }
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
