type SeleccionRecomendada = 'local' | 'empate' | 'visitante' | 'over25' | 'ambosAnotan' | 'over8_5Corners' | 'over9_5Corners' | 'over10_5Corners' | 'over20_5Remates' | 'over7_5RematesPuerta' | 'over10_5RematesLocal' | 'over10_5RematesVisitante' | 'over3_5RematesPuertaLocal' | 'over3_5RematesPuertaVisitante' | 'unoX' | 'X2' | 'doce';

type PartidoRecomendable = {
  local: string;
  visitante: string;
  probabilidades: { local: number; empate: number; visitante: number };
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
  cuotas: Array<{ seleccion: SeleccionRecomendada; cuota: number }>;
};

type Props = {
  partidos: PartidoRecomendable[];
  onCargar: (partido: PartidoRecomendable, seleccion: SeleccionRecomendada) => void;
};

function nombreSeleccion(seleccion: SeleccionRecomendada, partido: PartidoRecomendable): string {
  if (seleccion === 'local') return `Local (${partido.local})`;
  if (seleccion === 'visitante') return `Visitante (${partido.visitante})`;
  if (seleccion === 'unoX') return `1X - ${partido.local} o Empate`;
  if (seleccion === 'X2') return `X2 - Empate o ${partido.visitante}`;
  if (seleccion === 'doce') return `12 - ${partido.local} o ${partido.visitante}`;
  return {
  empate: 'Empate',
  over25: 'Más de 2.5 Goles',
  ambosAnotan: 'Ambos Anotan (Sí)',
  over8_5Corners: 'Más de 8.5 Córners',
  over9_5Corners: 'Más de 9.5 Córners',
  over10_5Corners: 'Más de 10.5 Córners',
  over20_5Remates: 'Más de 20.5 Remates totales',
  over7_5RematesPuerta: 'Más de 7.5 Remates a puerta'
  ,over10_5RematesLocal: 'Más de 10.5 Remates del local'
  ,over10_5RematesVisitante: 'Más de 10.5 Remates del visitante'
  ,over3_5RematesPuertaLocal: 'Más de 3.5 Remates a puerta del local'
  ,over3_5RematesPuertaVisitante: 'Más de 3.5 Remates a puerta del visitante'
  }[seleccion];
}

export function ApuestaRecomendada({ partidos, onCargar }: Props) {
  const opciones = partidos.flatMap((partido) => {
    const probabilidades: Record<SeleccionRecomendada, number> = {
      ...partido.probabilidades,
      over25: partido.probabilidadOver25,
      ambosAnotan: partido.probabilidadAmbosAnotan,
      over8_5Corners: partido.probabilidadOver8_5Corners,
      over9_5Corners: partido.probabilidadOver9_5Corners,
      over10_5Corners: partido.probabilidadOver10_5Corners,
      over20_5Remates: partido.probabilidadOver20_5Remates,
      over7_5RematesPuerta: partido.probabilidadOver7_5RematesPuerta,
      over10_5RematesLocal: partido.probabilidadOver10_5RematesLocal,
      over10_5RematesVisitante: partido.probabilidadOver10_5RematesVisitante,
      over3_5RematesPuertaLocal: partido.probabilidadOver3_5RematesPuertaLocal,
      over3_5RematesPuertaVisitante: partido.probabilidadOver3_5RematesPuertaVisitante,
      unoX: partido.probabilidadDobleOportunidad.unoX,
      X2: partido.probabilidadDobleOportunidad.X2,
      doce: partido.probabilidadDobleOportunidad.doce
    };
    return Object.entries(probabilidades).map(([seleccion, probabilidad]) => {
      const tipo = seleccion as SeleccionRecomendada;
      const cuota = partido.cuotas.find((item) => item.seleccion === tipo)?.cuota ?? 1;
      return { partido, seleccion: tipo, probabilidad, cuota, ev: probabilidad * cuota - 1 };
    });
  }).filter((opcion) => opcion.cuota > 1).sort((a, b) => b.ev - a.ev);
  const mejor = opciones[0];

  return <section className="mb-6 rounded-2xl border border-cyan-700 bg-cyan-950/40 p-5 shadow-lg">
    <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">Oráculo de apuestas</p>
    <h2 className="mt-1 text-xl font-black">Smart Pick</h2>
    {!mejor || mejor.ev <= 0
      ? <p className="mt-3 text-sm text-slate-300">No se detectó una oportunidad con EV positivo y cuota publicada.</p>
      : <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div><p className="font-semibold">{mejor.partido.local} vs {mejor.partido.visitante}</p><p className="text-sm text-cyan-200">{nombreSeleccion(mejor.seleccion, mejor.partido)} · cuota {mejor.cuota.toFixed(2)} · EV {(mejor.ev * 100).toFixed(1)}%</p></div>
        <button onClick={() => onCargar(mejor.partido, mejor.seleccion)} className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-200">Cargar al analizador</button>
      </div>}
  </section>;
}
