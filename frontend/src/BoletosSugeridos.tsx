import { useState } from 'react';

type Seleccion = 'local' | 'empate' | 'visitante' | 'over25' | 'ambosAnotan' | 'over8_5Corners' | 'over9_5Corners' | 'over10_5Corners' | 'over20_5Remates' | 'over7_5RematesPuerta' | 'unoX' | 'X2' | 'doce';

type Partido = {
  externoId: string;
  local: string;
  visitante: string;
  estado?: 'programado' | 'en_vivo' | 'finalizado';
  probabilidades: { local: number; empate: number; visitante: number };
  probabilidadOver25: number;
  probabilidadAmbosAnotan: number;
  probabilidadOver8_5Corners: number;
  probabilidadOver9_5Corners: number;
  probabilidadOver10_5Corners: number;
  probabilidadOver20_5Remates: number;
  probabilidadOver7_5RematesPuerta: number;
  probabilidadDobleOportunidad: { unoX: number; X2: number; doce: number };
  cuotas: Array<{ seleccion: Seleccion; cuota: number }>;
  marcador: { local: number; visitante: number } | null;
};

type Candidato = {
  partido: Partido;
  seleccion: Seleccion;
  probabilidad: number;
  cuota: number;
  cuotaPublicada: boolean;
};

const mercados: Seleccion[] = ['local', 'empate', 'visitante', 'over25', 'ambosAnotan', 'over8_5Corners', 'over9_5Corners', 'over10_5Corners', 'over20_5Remates', 'over7_5RematesPuerta', 'unoX', 'X2', 'doce'];

function etiqueta(seleccion: Seleccion, partido: Partido) {
  if (seleccion === 'local') return `Local (${partido.local})`;
  if (seleccion === 'visitante') return `Visitante (${partido.visitante})`;
  if (seleccion === 'unoX') return `1X - ${partido.local} o Empate`;
  if (seleccion === 'X2') return `X2 - Empate o ${partido.visitante}`;
  if (seleccion === 'doce') return `12 - ${partido.local} o ${partido.visitante}`;
  return {
    empate: 'Empate',
    over25: 'Más de 2.5 goles',
    ambosAnotan: 'Ambos anotan (Sí)',
    over8_5Corners: 'Más de 8.5 córners',
    over9_5Corners: 'Más de 9.5 córners',
    over10_5Corners: 'Más de 10.5 córners',
    over20_5Remates: 'Más de 20.5 remates',
    over7_5RematesPuerta: 'Más de 7.5 remates a puerta'
  }[seleccion];
}

function candidatos(partidos: Partido[]): Candidato[] {
  return partidos.flatMap((partido) => mercados.map((seleccion) => {
    const probabilidades: Record<Seleccion, number> = {
      ...partido.probabilidades,
      over25: partido.probabilidadOver25,
      ambosAnotan: partido.probabilidadAmbosAnotan,
      over8_5Corners: partido.probabilidadOver8_5Corners,
      over9_5Corners: partido.probabilidadOver9_5Corners,
      over10_5Corners: partido.probabilidadOver10_5Corners,
      over20_5Remates: partido.probabilidadOver20_5Remates,
      over7_5RematesPuerta: partido.probabilidadOver7_5RematesPuerta,
      unoX: partido.probabilidadDobleOportunidad.unoX,
      X2: partido.probabilidadDobleOportunidad.X2,
      doce: partido.probabilidadDobleOportunidad.doce
    };
    const cuotaMercado = partido.cuotas.find((cuota) => cuota.seleccion === seleccion)?.cuota ?? 1;
    return { partido, seleccion, probabilidad: probabilidades[seleccion], cuota: cuotaMercado, cuotaPublicada: cuotaMercado > 1 };
  })).filter((candidato) => candidato.probabilidad > 0.01);
}

function mejorCercano(opciones: Candidato[], objetivo: number, preferirCuota: number) {
  return [...opciones].sort((a, b) => (Math.abs(a.probabilidad - objetivo) + Math.abs(a.cuota - preferirCuota) * 0.08) - (Math.abs(b.probabilidad - objetivo) + Math.abs(b.cuota - preferirCuota) * 0.08))[0];
}

function nombreClase(tipo: string) {
  return tipo === 'Conservador' ? 'border-emerald-700 bg-emerald-950/60' : tipo === 'Intermedio' ? 'border-cyan-700 bg-cyan-950/60' : 'border-amber-700 bg-amber-950/60';
}

export function BoletosSugeridos({ partidos }: { partidos: Partido[] }) {
  const [partidoId, setPartidoId] = useState(partidos[0]?.externoId ?? '');
  const partidoSeleccionado = partidos.find((partido) => partido.externoId === partidoId) ?? partidos[0];
  const opciones = candidatos(partidoSeleccionado ? [partidoSeleccionado] : []);
  const conservador = mejorCercano(opciones.filter((opcion) => opcion.probabilidad >= 0.7), 0.8, 1.5);
  const intermedio = mejorCercano(opciones.filter((opcion) => opcion.probabilidad >= 0.35 && opcion.probabilidad <= 0.7 && ['unoX', 'X2', 'doce'].includes(opcion.seleccion)), 0.5, 2);
  const arriesgadas = opciones.filter((opcion) => opcion.probabilidad >= 0.62);
  const combinada = arriesgadas.slice(0, 3);
  const boletos = [
    conservador ? { tipo: 'Conservador', objetivo: '≈80%', selecciones: [conservador], cuotaObjetivo: 1.5 } : null,
    intermedio ? { tipo: 'Intermedio', objetivo: '≈50%', selecciones: [intermedio], cuotaObjetivo: 2 } : null,
    combinada.length >= 3 ? { tipo: 'Arriesgado', objetivo: '≥30% conjunta', selecciones: combinada, cuotaObjetivo: combinada.reduce((total) => total * 1.5, 1) } : null
  ].filter((boleto): boleto is NonNullable<typeof boleto> => Boolean(boleto));

  if (!partidoSeleccionado) return null;
  return <section className="mb-6 rounded-2xl border border-fuchsia-700 bg-slate-900 p-5 shadow-xl">
    <p className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-300">Oráculo de boletos</p>
    <h2 className="mt-1 text-2xl font-black">Tres rutas para tu apuesta</h2>
    <p className="mt-1 text-sm text-slate-400">Selecciona un partido para comparar sus tres rutas. La probabilidad es del modelo; el momio debe confirmarse en la casa.</p>
    <select value={partidoSeleccionado.externoId} onChange={(evento) => setPartidoId(evento.target.value)} className="field mt-4 max-w-xl">
      {partidos.map((partido) => <option key={partido.externoId} value={partido.externoId}>{partido.local} vs {partido.visitante}{partido.estado === 'finalizado' ? ' · Finalizado' : ''}</option>)}
    </select>
    {partidoSeleccionado.estado === 'finalizado' && partidoSeleccionado.marcador && <div className="mt-3 rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm text-slate-300">Este partido ya terminó: <strong className="text-white">{partidoSeleccionado.local} {partidoSeleccionado.marcador.local} - {partidoSeleccionado.marcador.visitante} {partidoSeleccionado.visitante}</strong>. Las rutas son retrospectivas.</div>}
    <div className="mt-5 grid gap-4 lg:grid-cols-3">
      {boletos.map((boleto) => {
        const probabilidad = boleto.selecciones.reduce((total, seleccion) => total * seleccion.probabilidad, 1);
        const cuotaPublicada = boleto.selecciones.every((seleccion) => seleccion.cuotaPublicada);
        const cuota = boleto.selecciones.reduce((total, seleccion) => total * (seleccion.cuotaPublicada ? seleccion.cuota : 1.5), 1);
        const ev = probabilidad * cuota - 1;
        return <article key={boleto.tipo} className={`rounded-xl border p-4 ${nombreClase(boleto.tipo)}`}>
          <div className="flex items-center justify-between"><h3 className="font-black">{boleto.tipo}</h3><span className="text-xs font-bold">{boleto.objetivo}</span></div>
          <div className="my-3 text-2xl font-black text-white">{(probabilidad * 100).toFixed(1)}% <span className="text-xs font-normal text-slate-400">probabilidad</span></div>
          <div className="space-y-2 text-sm">{boleto.selecciones.map((seleccion) => <div key={`${seleccion.partido.externoId}-${seleccion.seleccion}`} className="rounded-lg bg-black/20 p-2"><p className="font-semibold">{etiqueta(seleccion.seleccion, seleccion.partido)}</p><p className="text-xs text-slate-400">{seleccion.partido.local} vs {seleccion.partido.visitante} · modelo {(seleccion.probabilidad * 100).toFixed(1)}%</p></div>)}</div>
          <p className="mt-3 text-sm">Momio {cuota.toFixed(2)} · EV {(ev * 100).toFixed(1)}%</p>
          <p className="mt-1 text-[11px] text-slate-400">{cuotaPublicada ? 'Cuotas publicadas' : 'Cuota de referencia: confirma el momio en Novibet'}</p>
        </article>;
      })}
    </div>
    {boletos.length < 3 && <p className="mt-4 rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-xs text-amber-200">No hay suficientes cuotas o partidos con probabilidad compatible para construir las tres rutas. El sistema evita inventar una recomendación.</p>}
  </section>;
}
