import { rasparCalendario, type Liga } from './scraper.js';
import type { SeleccionMercado } from './simuladorMonteCarlo.js';

export type PartidoFuente = {
  liga: Liga;
  id?: number;
  externoId: string;
  fecha: string;
  jornada: number;
  estado: 'programado' | 'en_vivo' | 'finalizado';
  minuto: number | null;
  marcador: { local: number; visitante: number } | null;
  ausencias: { local: string[]; visitante: string[] };
  local: string;
  visitante: string;
  golesLocal: number | null;
  golesVisitante: number | null;
  cuotas: Array<{ casa: string; mercado: string; seleccion: SeleccionMercado; cuota: number }>;
};

export async function obtenerPartidos(liga: Liga = 'LIGA_MX'): Promise<PartidoFuente[]> {
  const partidos = await rasparCalendario(liga);
  const jornadasConNumero = partidos.map((partido) => partido.jornada).filter((jornada) => jornada > 0);
  const jornadaActual = jornadasConNumero[0];
  const matchweekSinNumeroCompleto = partidos.some((partido) => partido.jornada === 0);
  const seleccionados = jornadaActual && !matchweekSinNumeroCompleto
    ? partidos.filter((partido) => partido.jornada === jornadaActual)
    : partidos;
  return seleccionados.map((partido) => ({
    ...partido,
    liga,
    cuotas: [
      ...partido.cuotas,
      { casa: 'ESPN/mercado publicado', mercado: 'over_under', seleccion: 'over25', cuota: 1.0 },
      { casa: 'ESPN/mercado publicado', mercado: 'ambos_anotan', seleccion: 'ambosAnotan', cuota: 1.0 },
      { casa: 'ESPN/mercado publicado', mercado: 'corners', seleccion: 'over8_5Corners', cuota: 1.0 },
      { casa: 'ESPN/mercado publicado', mercado: 'corners', seleccion: 'over9_5Corners', cuota: 1.0 },
      { casa: 'ESPN/mercado publicado', mercado: 'corners', seleccion: 'over10_5Corners', cuota: 1.0 },
      { casa: 'ESPN/mercado publicado', mercado: 'remates', seleccion: 'over20_5Remates', cuota: 1.0 },
      { casa: 'ESPN/mercado publicado', mercado: 'remates_puerta', seleccion: 'over7_5RematesPuerta', cuota: 1.0 },
      { casa: 'ESPN/mercado publicado', mercado: 'remates_local', seleccion: 'over10_5RematesLocal', cuota: 1.0 },
      { casa: 'ESPN/mercado publicado', mercado: 'remates_visitante', seleccion: 'over10_5RematesVisitante', cuota: 1.0 },
      { casa: 'ESPN/mercado publicado', mercado: 'remates_puerta_local', seleccion: 'over3_5RematesPuertaLocal', cuota: 1.0 },
      { casa: 'ESPN/mercado publicado', mercado: 'remates_puerta_visitante', seleccion: 'over3_5RematesPuertaVisitante', cuota: 1.0 },
      { casa: 'ESPN/mercado publicado', mercado: 'doble_oportunidad', seleccion: 'unoX', cuota: 1.0 },
      { casa: 'ESPN/mercado publicado', mercado: 'doble_oportunidad', seleccion: 'X2', cuota: 1.0 },
      { casa: 'ESPN/mercado publicado', mercado: 'doble_oportunidad', seleccion: 'doce', cuota: 1.0 }
    ]
  }));
}
