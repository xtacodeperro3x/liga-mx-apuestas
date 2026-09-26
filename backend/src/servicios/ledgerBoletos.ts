import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type BoletoEntrada = {
  externoId: string;
  seleccion: string;
  cuota: number;
  montoApostado: number;
  valorEsperado: number;
  estado?: 'Pendiente' | 'Ganado' | 'Perdido';
  retornoNeto?: number | null;
};

function resultadoSeleccion(seleccion: string, golesLocal: number, golesVisitante: number): boolean {
  switch (seleccion) {
    case 'local': return golesLocal > golesVisitante;
    case 'empate': return golesLocal === golesVisitante;
    case 'visitante': return golesVisitante > golesLocal;
    case 'over25': return golesLocal + golesVisitante > 2.5;
    case 'unoX': return golesLocal >= golesVisitante;
    case 'X2': return golesVisitante >= golesLocal;
    case 'doce': return golesLocal !== golesVisitante;
    default: return false;
  }
}

export async function registrarBoleto(entrada: BoletoEntrada) {
  if (!entrada.externoId || !entrada.seleccion || entrada.cuota < 1 || entrada.montoApostado <= 0) {
    throw new Error('Los datos del boleto son inválidos');
  }
  const partido = await prisma.partido.findUnique({ where: { externoId: entrada.externoId } });
  if (!partido) throw new Error('El partido del boleto no está persistido');
  return prisma.boletoHistorico.create({
    data: {
      partidoId: partido.id,
      seleccion: entrada.seleccion,
      cuota: entrada.cuota,
      montoApostado: entrada.montoApostado,
      valorEsperado: entrada.valorEsperado,
      estado: entrada.estado ?? 'Pendiente',
      retornoNeto: entrada.retornoNeto ?? null
    },
    include: { partido: true }
  });
}

export async function resolverBoletosPendientes() {
  const pendientes = await prisma.boletoHistorico.findMany({
    where: { estado: 'Pendiente', partido: { golesLocal: { not: null }, golesVisitante: { not: null } } },
    include: { partido: true }
  });
  for (const boleto of pendientes) {
    const golesLocal = boleto.partido.golesLocal;
    const golesVisitante = boleto.partido.golesVisitante;
    if (golesLocal === null || golesVisitante === null) continue;
    const ganado = resultadoSeleccion(boleto.seleccion, golesLocal, golesVisitante);
    await prisma.boletoHistorico.update({
      where: { id: boleto.id },
      data: {
        estado: ganado ? 'Ganado' : 'Perdido',
        retornoNeto: ganado ? boleto.montoApostado * (boleto.cuota - 1) : -boleto.montoApostado
      }
    });
  }
}

export async function obtenerRendimiento() {
  await resolverBoletosPendientes();
  const boletos = await prisma.boletoHistorico.findMany({ orderBy: { fecha: 'desc' }, include: { partido: true } });
  const resueltos = boletos.filter((boleto) => boleto.estado !== 'Pendiente');
  const apostado = resueltos.reduce((total, boleto) => total + boleto.montoApostado, 0);
  const retornoNeto = boletos.reduce((total, boleto) => total + (boleto.retornoNeto ?? 0), 0);
  const ganados = resueltos.filter((boleto) => boleto.estado === 'Ganado').length;
  return {
    boletos,
    resumen: {
      total: boletos.length,
      resueltos: resueltos.length,
      ganados,
      apostado,
      retornoNeto,
      roi: apostado ? retornoNeto / apostado : 0,
      yield: apostado ? retornoNeto / apostado : 0
    }
  };
}
