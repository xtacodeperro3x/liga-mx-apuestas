import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { configuracion } from './configuracion.js';
import { construirAnalisis } from './servicios/analisis.js';
import { guardarEstadisticas, guardarPartidos, leerPartidos, leerTablaPosiciones } from './servicios/persistencia.js';
import { construirReporteLatex } from './servicios/exportadorLatex.js';
import { obtenerRendimiento, registrarBoleto, resolverBoletosPendientes } from './servicios/ledgerBoletos.js';
import { LIGAS_DISPONIBLES, type Liga } from './servicios/scraper.js';
import { construirReporteCsv } from './servicios/exportadorCsv.js';
import { calcularInterseccionMonteCarlo, simularPartidoMonteCarlo, type SeleccionMercado } from './servicios/simuladorMonteCarlo.js';
import { iniciarTareasCron } from './servicios/tareasCron.js';

const aplicacion = express();
aplicacion.use(cors());
aplicacion.use(express.json());
function ligaDesdeSolicitud(solicitud: express.Request): Liga {
  const valor = String(solicitud.query.liga ?? 'LIGA_MX');
  return (LIGAS_DISPONIBLES.includes(valor as Liga) ? valor : 'LIGA_MX') as Liga;
}

aplicacion.get('/api/salud', (_solicitud, respuesta) => respuesta.json({ estado: 'ok' }));

aplicacion.get('/api/partidos/hoy', async (solicitud, respuesta) => {
  try {
    const liga = ligaDesdeSolicitud(solicitud);
    const [partidos, tabla] = await Promise.all([
      leerPartidos(liga),
      leerTablaPosiciones(liga)
    ]);
    try {
      await Promise.all([guardarPartidos(partidos), guardarEstadisticas(tabla, new Date(), liga)]);
    } catch (error) {
      console.error('No se pudo persistir la jornada raspada; se devuelve el dato en vivo:', error);
    }
    try {
      await resolverBoletosPendientes();
    } catch (error) {
      console.error('No se pudo resolver el ledger; se devuelve la jornada sin actualizar boletos:', error);
    }
    respuesta.json(partidos.map((partido) => ({ ...construirAnalisis(partido, tabla), goleadores: [], asistidores: [] })));
  } catch (error) {
    respuesta.status(502).json({ error: error instanceof Error ? error.message : 'Error de proveedor' });
  }
});

aplicacion.get('/api/partidos', async (solicitud, respuesta) => {
  try {
    const liga = ligaDesdeSolicitud(solicitud);
    respuesta.json(await leerPartidos(liga));
  } catch (error) {
    respuesta.status(502).json({ error: error instanceof Error ? error.message : 'Error de proveedor' });
  }
});

aplicacion.get('/api/goleadores', async (solicitud, respuesta) => {
  try {
    respuesta.json([]);
  } catch (error) {
    respuesta.status(502).json({ error: error instanceof Error ? error.message : 'Error de proveedor' });
  }
});

aplicacion.get('/api/asistidores', async (solicitud, respuesta) => {
  try {
    respuesta.json([]);
  } catch (error) {
    respuesta.status(502).json({ error: error instanceof Error ? error.message : 'Error de proveedor' });
  }
});

aplicacion.post('/api/boletos', async (solicitud, respuesta) => {
  try {
    respuesta.status(201).json(await registrarBoleto(solicitud.body));
  } catch (error) {
    respuesta.status(400).json({ error: error instanceof Error ? error.message : 'No se pudo registrar el boleto' });
  }
});

aplicacion.post('/api/boletos/importar', async (solicitud, respuesta) => {
  try {
    const { externoId, liga, selecciones, cuotaTotal, montoApostado, estado, valorEsperado = 0 } = solicitud.body ?? {};
    if (!externoId || !Array.isArray(selecciones) || selecciones.length === 0 || !Number.isFinite(cuotaTotal) || cuotaTotal < 1 || !Number.isFinite(montoApostado) || montoApostado <= 0) {
      return respuesta.status(400).json({ error: 'El boleto importado requiere partido, selecciones, cuota total y monto apostado.' });
    }
    const estadoNormalizado = estado === 'Ganado' || estado === 'Perdido' ? estado : 'Pendiente';
    const retornoNeto = estadoNormalizado === 'Ganado'
      ? montoApostado * (cuotaTotal - 1)
      : estadoNormalizado === 'Perdido' ? -montoApostado : null;
    const boleto = await registrarBoleto({
      externoId,
      seleccion: `Combinada: ${selecciones.join(' + ')}`,
      cuota: cuotaTotal,
      montoApostado,
      valorEsperado,
      estado: estadoNormalizado,
      retornoNeto,
      liga
    });
    return respuesta.status(201).json(boleto);
  } catch (error) {
    return respuesta.status(400).json({ error: error instanceof Error ? error.message : 'No se pudo importar el boleto' });
  }
});

aplicacion.get('/api/boletos/historial', async (solicitud, respuesta) => {
  try {
    respuesta.json(await obtenerRendimiento(ligaDesdeSolicitud(solicitud)));
  } catch (error) {
    respuesta.status(503).json({ error: error instanceof Error ? error.message : 'No se pudo consultar el historial' });
  }
});

aplicacion.get('/api/tabla-posiciones', async (solicitud, respuesta) => {
  try {
    const liga = ligaDesdeSolicitud(solicitud);
    const tabla = await leerTablaPosiciones(liga);
    respuesta.json(tabla);
  } catch (error) {
    respuesta.status(502).json({ error: error instanceof Error ? error.message : 'Error de proveedor' });
  }
});

aplicacion.post('/api/exportar/reporte-latex', async (solicitud, respuesta) => {
  try {
    const liga = ligaDesdeSolicitud(solicitud);
    const [partidos, tabla] = await Promise.all([leerPartidos(liga), leerTablaPosiciones(liga)]);
    const analisis = partidos.map((partido) => construirAnalisis(partido, tabla));
    const boletos = Array.isArray(solicitud.body?.boletos) ? solicitud.body.boletos : [];
    const rendimiento = await obtenerRendimiento().catch(() => undefined);
    const documento = construirReporteLatex(analisis, boletos, rendimiento?.resumen);
    respuesta.setHeader('Content-Type', 'application/x-tex; charset=utf-8');
    respuesta.setHeader('Content-Disposition', 'attachment; filename="bitacora-liga-mx.tex"');
    respuesta.send(documento);
  } catch (error) {
    respuesta.status(502).json({ error: error instanceof Error ? error.message : 'No se pudo generar el reporte LaTeX' });
  }
});

aplicacion.get('/api/exportar/csv', async (solicitud, respuesta) => {
  try {
    const liga = ligaDesdeSolicitud(solicitud);
    const [partidos, tabla, rendimiento] = await Promise.all([
      leerPartidos(liga),
      leerTablaPosiciones(liga),
      obtenerRendimiento()
    ]);
    const analisis = partidos.map((partido) => construirAnalisis(partido, tabla));
    const opciones = analisis.flatMap((partido) => partido.apuestas
      .filter((apuesta) => apuesta.cuota > 1)
      .map((apuesta) => ({ partido: `${partido.local} vs ${partido.visitante}`, seleccion: apuesta.seleccion, cuota: apuesta.cuota, ev: apuesta.valorEsperado })))
      .sort((a, b) => b.ev - a.ev);
    const documento = construirReporteCsv(analisis, rendimiento, opciones[0] ?? null);
    respuesta.setHeader('Content-Type', 'text/csv; charset=utf-8');
    respuesta.setHeader('Content-Disposition', 'attachment; filename="reporte-cuantitativo.csv"');
    respuesta.send(`\uFEFF${documento}`);
  } catch (error) {
    respuesta.status(502).json({ error: error instanceof Error ? error.message : 'No se pudo generar el reporte CSV' });
  }
});

aplicacion.post('/api/apuestas-combinadas/calcular', async (solicitud, respuesta) => {
  try {
    const entradas: Array<{ externoId: string; seleccion: SeleccionMercado; cuota: number }> = Array.isArray(solicitud.body?.selecciones)
      ? solicitud.body.selecciones
      : [];
    if (entradas.length === 0 || entradas.some((entrada) => !entrada.externoId || !entrada.seleccion || !Number.isFinite(entrada.cuota) || entrada.cuota < 1)) {
      return respuesta.status(400).json({ error: 'El Bet Builder requiere selecciones válidas.' });
    }
    const liga = ligaDesdeSolicitud(solicitud);
    const [partidos, tabla] = await Promise.all([leerPartidos(liga), leerTablaPosiciones(liga)]);
    const partidosPorId = new Map(partidos.map((partido) => [partido.externoId, partido]));
    const grupos = new Map<string, typeof entradas>();
    for (const entrada of entradas) grupos.set(entrada.externoId, [...(grupos.get(entrada.externoId) ?? []), entrada]);
    let probabilidad = 1;
    for (const [externoId, grupo] of grupos) {
      const partido = partidosPorId.get(externoId);
      if (!partido) return respuesta.status(404).json({ error: `No se encontró el partido ${externoId}.` });
      const local = tabla.find((fila) => fila.equipo === partido.local);
      const visitante = tabla.find((fila) => fila.equipo === partido.visitante);
      if (!local || !visitante) throw new Error(`No hay estadísticas para ${partido.local} o ${partido.visitante}`);
      if (grupo.length > 1) {
        probabilidad *= calcularInterseccionMonteCarlo(local, visitante, grupo.map((entrada) => entrada.seleccion), 10_000, partido);
      } else {
        const simulacion = simularPartidoMonteCarlo(local, visitante, 10_000, partido);
        const seleccion = grupo[0].seleccion;
        const probabilidades: Record<string, number> = {
          ...simulacion.probabilidades,
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
        probabilidad *= probabilidades[seleccion] ?? 0;
      }
    }
    const cuotaTotal = entradas.reduce((total, entrada) => total * entrada.cuota, 1);
    return respuesta.json({ probabilidad, cuotaTotal, valorEsperado: probabilidad * cuotaTotal - 1, selecciones: entradas.length, iteraciones: 10_000 });
  } catch (error) {
    return respuesta.status(502).json({ error: error instanceof Error ? error.message : 'No se pudo calcular la apuesta combinada' });
  }
});

aplicacion.listen(configuracion.puerto, () => {
  console.info(`Backend escuchando en http://localhost:${configuracion.puerto}`);
  if (configuracion.sincronizacionActiva) iniciarTareasCron();
});
