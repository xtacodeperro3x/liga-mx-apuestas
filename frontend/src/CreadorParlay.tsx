import { useEffect, useMemo, useState } from 'react';

export type SeleccionParlay = 'local' | 'empate' | 'visitante' | 'over25' | 'ambosAnotan' | 'over8_5Corners' | 'over9_5Corners' | 'over10_5Corners' | 'over20_5Remates' | 'over7_5RematesPuerta' | 'over10_5RematesLocal' | 'over10_5RematesVisitante' | 'over3_5RematesPuertaLocal' | 'over3_5RematesPuertaVisitante' | 'unoX' | 'X2' | 'doce';

type PartidoParlay = {
  externoId: string;
  local: string;
  visitante: string;
  cuotas: Array<{ seleccion: SeleccionParlay; cuota: number }>;
};

type SeleccionCarrito = {
  id: string;
  externoId: string;
  partido: string;
  seleccion: SeleccionParlay;
  cuota: number;
};

type ResultadoParlay = {
  probabilidad: number;
  cuotaTotal: number;
  valorEsperado: number;
  selecciones: number;
  iteraciones: number;
};

function nombreSeleccion(seleccion: SeleccionParlay, partido?: PartidoParlay): string {
  if (seleccion === 'local') return partido ? `Local (${partido.local})` : 'Local';
  if (seleccion === 'visitante') return partido ? `Visitante (${partido.visitante})` : 'Visitante';
  if (seleccion === 'unoX') return partido ? `1X - ${partido.local} o Empate` : '1X';
  if (seleccion === 'X2') return partido ? `X2 - Empate o ${partido.visitante}` : 'X2';
  if (seleccion === 'doce') return partido ? `12 - ${partido.local} o ${partido.visitante}` : '12';
  return {
  empate: 'Empate',
  over25: 'Más de 2.5 goles',
  ambosAnotan: 'Ambos Anotan (Sí)',
  over8_5Corners: 'Más de 8.5 córners',
  over9_5Corners: 'Más de 9.5 córners',
  over10_5Corners: 'Más de 10.5 córners',
  over20_5Remates: 'Más de 20.5 remates totales',
  over7_5RematesPuerta: 'Más de 7.5 remates a puerta'
  ,over10_5RematesLocal: 'Más de 10.5 remates del local'
  ,over10_5RematesVisitante: 'Más de 10.5 remates del visitante'
  ,over3_5RematesPuertaLocal: 'Más de 3.5 remates a puerta del local'
  ,over3_5RematesPuertaVisitante: 'Más de 3.5 remates a puerta del visitante'
  }[seleccion];
}

export function CreadorParlay({ partidos, api }: { partidos: PartidoParlay[]; api: string }) {
  const [partidoId, setPartidoId] = useState('');
  const [seleccion, setSeleccion] = useState<SeleccionParlay>('local');
  const [carrito, setCarrito] = useState<SeleccionCarrito[]>([]);
  const [resultado, setResultado] = useState<ResultadoParlay | null>(null);
  const [error, setError] = useState('');
  const partido = partidos.find((item) => item.externoId === partidoId);
  const cuota = partido?.cuotas.find((item) => item.seleccion === seleccion)?.cuota ?? 1;

  useEffect(() => {
    if (partidos.length > 0 && !partidos.some((partidoActual) => partidoActual.externoId === partidoId)) {
      setPartidoId(partidos[0].externoId);
    }
  }, [partidos, partidoId]);

  useEffect(() => {
    if (carrito.length === 0) {
      setResultado(null);
      setError('');
      return;
    }
    const controlador = new AbortController();
    void fetch(`${api}/apuestas-combinadas/calcular`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selecciones: carrito.map(({ externoId, seleccion, cuota }) => ({ externoId, seleccion, cuota })) }),
      signal: controlador.signal
    }).then(async (respuesta) => {
      const datos = await respuesta.json() as ResultadoParlay & { error?: string };
      if (!respuesta.ok) throw new Error(datos.error ?? 'No se pudo calcular la combinada.');
      setResultado(datos);
      setError('');
    }).catch((fallo: unknown) => {
      if (!controlador.signal.aborted) setError(fallo instanceof Error ? fallo.message : 'No se pudo calcular la combinada.');
    });
    return () => controlador.abort();
  }, [api, carrito]);

  const porcentaje = useMemo(() => (resultado?.probabilidad ?? 0) * 100, [resultado]);
  const agregar = () => {
    if (!partido) return;
    const id = `${partido.externoId}-${seleccion}`;
    if (carrito.some((item) => item.id === id)) return;
    setCarrito((actual) => [...actual, { id, externoId: partido.externoId, partido: `${partido.local} vs ${partido.visitante}`, seleccion, cuota }]);
  };

  return <section className="mb-6 rounded-2xl border border-fuchsia-700 bg-slate-900 p-5 shadow-xl">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-300">Bet Builder</p><h2 className="mt-1 text-2xl font-black">Creador de apuestas combinadas</h2><p className="mt-1 text-sm text-slate-400">Combina selecciones del mismo o de distintos partidos.</p></div>
      <button onClick={() => setCarrito([])} disabled={carrito.length === 0} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-40">Vaciar carrito</button>
    </div>
    <div className="mt-5 grid gap-3 md:grid-cols-[1.2fr_1fr_auto]">
      <select value={partidoId} onChange={(evento) => setPartidoId(evento.target.value)} className="field">{partidos.map((item) => <option key={item.externoId} value={item.externoId}>{item.local} vs {item.visitante}</option>)}</select>
      <select value={seleccion} onChange={(evento) => setSeleccion(evento.target.value as SeleccionParlay)} className="field">{(['local', 'empate', 'visitante', 'over25', 'ambosAnotan', 'over8_5Corners', 'over9_5Corners', 'over10_5Corners', 'over20_5Remates', 'over7_5RematesPuerta', 'unoX', 'X2', 'doce'] as SeleccionParlay[]).map((valor) => <option key={valor} value={valor}>{nombreSeleccion(valor, partido)}</option>)}</select>
      <button onClick={agregar} disabled={!partido || carrito.some((item) => item.id === `${partidoId}-${seleccion}`)} className="rounded-lg bg-fuchsia-400 px-4 py-2 font-bold text-slate-950 disabled:opacity-40">Agregar · {cuota.toFixed(2)}</button>
    </div>
    {carrito.length > 0 && <div className="mt-4 grid gap-2 md:grid-cols-2">{carrito.map((item) => { const partidoItem = partidos.find((itemPartido) => itemPartido.externoId === item.externoId); return <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"><div><p className="font-semibold">{nombreSeleccion(item.seleccion, partidoItem)}</p><p className="text-xs text-slate-400">{item.partido}</p></div><div className="flex items-center gap-3"><strong className="text-fuchsia-300">{item.cuota.toFixed(2)}</strong><button onClick={() => setCarrito((actual) => actual.filter((seleccionActual) => seleccionActual.id !== item.id))} className="text-slate-400 hover:text-white" aria-label={`Eliminar ${nombreSeleccion(item.seleccion, partidoItem)}`}>×</button></div></div>; })}</div>}
    {resultado && <div className="mt-5 grid items-center gap-5 md:grid-cols-[150px_1fr]">
      <div className="relative mx-auto h-36 w-36 rounded-full p-3" style={{ background: `conic-gradient(#e879f9 ${porcentaje}%, #1e293b 0)` }}><div className="flex h-full w-full items-center justify-center rounded-full bg-slate-900 text-center"><div><strong className="block text-2xl font-black text-fuchsia-300">{porcentaje.toFixed(2)}%</strong><span className="text-[10px] uppercase text-slate-400">probabilidad</span></div></div></div>
      <div className={`rounded-xl border p-4 ${resultado.valorEsperado >= 0 ? 'border-emerald-700 bg-emerald-950/60 text-emerald-300' : 'border-rose-700 bg-rose-950/60 text-rose-300'}`}><p className="text-lg font-bold">{resultado.valorEsperado >= 0 ? 'Ventaja matemática' : 'EV negativo'}</p><p className="mt-1 text-sm">Cuota total: <strong>{resultado.cuotaTotal.toFixed(2)}</strong> · EV: <strong>{(resultado.valorEsperado * 100).toFixed(2)}%</strong></p><p className="text-xs text-slate-400">Intersección Monte Carlo: {resultado.iteraciones.toLocaleString()} iteraciones por partido · {resultado.selecciones} selecciones</p></div>
    </div>}
    {error && <p className="mt-3 rounded-lg border border-red-800 bg-red-950 p-3 text-sm text-red-300">{error}</p>}
  </section>;
}
