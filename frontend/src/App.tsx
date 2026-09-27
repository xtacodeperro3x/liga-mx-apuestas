import { useEffect, useMemo, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import { ApuestaRecomendada } from './ApuestaRecomendada';
import { TablaGoleadores } from './TablaGoleadores';
import { CreadorParlay } from './CreadorParlay';
import { TablaAsistidores } from './TablaAsistidores';
import { ImportadorBoleto } from './ImportadorBoleto';
import { BoletosSugeridos } from './BoletosSugeridos';

ChartJS.register(ArcElement, Tooltip, Legend);

type Seleccion = 'local' | 'empate' | 'visitante' | 'over25' | 'over8_5Corners' | 'over9_5Corners' | 'over10_5Corners' | 'over20_5Remates' | 'over7_5RematesPuerta' | 'over10_5RematesLocal' | 'over10_5RematesVisitante' | 'over3_5RematesPuertaLocal' | 'over3_5RematesPuertaVisitante' | 'ambosAnotan' | 'unoX' | 'X2' | 'doce';
type Apuesta = { seleccion: Seleccion; cuota: number; valorEsperado: number; esValueBet: boolean; fraccionKelly: number };
type Partido = {
  externoId: string; local: string; visitante: string; jornada: number; estado: 'programado' | 'en_vivo' | 'finalizado'; minuto: number | null;
  marcador: { local: number; visitante: number } | null;
  marcadorEsperado: { local: number; visitante: number } | null;
  ausencias: { local: string[]; visitante: string[] };
  probabilidades: { local: number; empate: number; visitante: number }; probabilidadOver25: number; probabilidadAmbosAnotan: number; probabilidadOver8_5Corners: number; probabilidadOver9_5Corners: number; probabilidadOver10_5Corners: number; probabilidadOver20_5Remates: number; probabilidadOver7_5RematesPuerta: number; probabilidadOver10_5RematesLocal: number; probabilidadOver10_5RematesVisitante: number; probabilidadOver3_5RematesPuertaLocal: number; probabilidadOver3_5RematesPuertaVisitante: number; probabilidadDobleOportunidad: { unoX: number; X2: number; doce: number }; cuotas: Array<{ seleccion: Seleccion; cuota: number }>; apuestas: Apuesta[];
  estadisticas: { local: { forma?: string[] }; visitante: { forma?: string[] } };
};
type Posicion = { posicion: number; equipo: string; puntos: number; jugados: number; diferencia: number; forma?: string[] };
type Boleto = { externoId?: string; partido: string; seleccion: Seleccion; cuota: number; monto: number; probabilidad: number; ev: number; retorno: number };
type Rendimiento = { total: number; resueltos: number; ganados: number; apostado: number; retornoNeto: number; roi: number; yield: number };
type Goleador = { nombre: string; equipo: string; goles: number };
type Asistidor = { nombre: string; equipo: string; asistencias: number };
type DatosLiga = { partidos: Partido[]; tabla: Posicion[]; goleadores: Goleador[]; asistidores: Asistidor[] };
const api = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';
type Liga = 'LIGA_MX' | 'PREMIER_LEAGUE' | 'LA_LIGA' | 'SERIE_A';
const ligas: Array<{ clave: Liga; nombre: string }> = [
  { clave: 'LIGA_MX', nombre: 'Liga MX' },
  { clave: 'PREMIER_LEAGUE', nombre: 'Premier League' },
  { clave: 'LA_LIGA', nombre: 'La Liga' },
  { clave: 'SERIE_A', nombre: 'Serie A' }
];
const porcentaje = (valor: number) => `${(valor * 100).toFixed(1)}%`;

function evaluarBoleto(seleccion: Seleccion, probabilidad: number, cuota: number, monto: number): Boleto | null {
  if (!Number.isFinite(cuota) || cuota <= 1 || !Number.isFinite(monto) || monto <= 0) return null;
  return { partido: '', seleccion, cuota, monto, probabilidad, ev: probabilidad * cuota - 1, retorno: monto * cuota };
}

function Forma({ valores }: { valores?: string[] }) {
  return <span className="ml-2 inline-flex items-center gap-1 align-middle" title="Últimos 5 partidos"><span className="text-[10px] font-normal text-slate-500">5:</span>{(valores ?? []).slice(-5).map((valor, indice) => <i key={`${valor}-${indice}`} title={valor === 'V' ? 'Victoria' : valor === 'E' ? 'Empate' : 'Derrota'} className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black not-italic text-slate-950 ${valor === 'V' ? 'bg-emerald-400' : valor === 'E' ? 'bg-slate-300' : 'bg-rose-400'}`}>{valor}</i>)}</span>;
}

async function exportarLatex(boletos: Boleto[], liga: Liga) {
  const respuesta = await fetch(`${api}/exportar/reporte-latex?liga=${liga}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ boletos })
  });
  if (!respuesta.ok) throw new Error('No se pudo generar el reporte LaTeX desde el backend.');
  const archivo = await respuesta.blob();
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = 'bitacora-liga-mx.tex';
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

async function exportarCsv(liga: Liga) {
  const respuesta = await fetch(`${api}/exportar/csv?liga=${liga}`);
  if (!respuesta.ok) throw new Error('No se pudo generar el reporte CSV desde el backend.');
  const archivo = await respuesta.blob();
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = 'reporte-cuantitativo.csv';
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

function TarjetaPartido({ partido }: { partido: Partido }) {
  const datos = {
    labels: [`Local (${partido.local})`, 'Empate', `Visitante (${partido.visitante})`],
    datasets: [{ data: Object.values(partido.probabilidades).map((valor) => valor * 100), backgroundColor: ['#38bdf8', '#a78bfa', '#f472b6'], borderWidth: 0 }]
  };
  return <article className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-5 text-white shadow-xl">
    <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
      <span>Jornada {partido.jornada}</span>
      {partido.estado === 'en_vivo' ? <span className="flex items-center gap-2 font-semibold text-red-400"><i className="live-dot" /> EN VIVO</span> : <span>{partido.estado === 'finalizado' ? 'FINALIZADO' : 'PROGRAMADO'}</span>}
    </div>
    {partido.estado === 'en_vivo' && <div className="mb-4 rounded-lg border border-emerald-800 bg-emerald-950/60 px-3 py-2 text-center text-xs font-bold text-emerald-300 animate-pulse">EN VIVO - Minuto {partido.minuto ?? '—'}</div>}
    <div className="mb-4 flex items-center justify-between"><div><p className="font-semibold">{partido.local}<Forma valores={partido.estadisticas.local.forma} /></p>{partido.ausencias.local.length > 0 && <span className="mt-1 inline-block rounded border border-red-500 px-2 py-1 text-[10px] font-bold text-red-300">Bajas importantes detectadas</span>}<p className="text-sm text-slate-400">vs {partido.visitante}<Forma valores={partido.estadisticas.visitante.forma} /></p>{partido.ausencias.visitante.length > 0 && <span className="mt-1 inline-block rounded border border-red-500 px-2 py-1 text-[10px] font-bold text-red-300">Bajas importantes detectadas</span>}{partido.estado !== 'programado' && partido.marcador && <p className="mt-2 text-3xl font-black">{partido.marcador.local} <span className="text-base text-slate-500">-</span> {partido.marcador.visitante}</p>}{partido.estado === 'programado' && partido.marcadorEsperado && <div className="mt-2 text-sm text-slate-400"><p className="text-[10px] uppercase tracking-wide text-slate-500">Resultado más probable (Monte Carlo)</p><strong className="text-lg text-cyan-300">{partido.marcadorEsperado.local} - {partido.marcadorEsperado.visitante}</strong></div>}</div><div className="h-32 w-32"><Doughnut data={datos} options={{ plugins: { legend: { display: false } }, cutout: '68%' }} /></div></div>
    <div className="grid grid-cols-3 gap-2 text-center text-xs">{(['local', 'empate', 'visitante'] as const).map((seleccion) => <div key={seleccion} className="rounded-lg bg-slate-800 p-2"><p className="text-slate-400">{seleccion === 'local' ? `Local (${partido.local})` : seleccion === 'visitante' ? `Visitante (${partido.visitante})` : 'Empate'}</p><strong>{porcentaje(partido.probabilidades[seleccion])}</strong></div>)}</div>
    <div className="mt-4 space-y-2">{partido.apuestas.map((apuesta) => <div className={`flex items-center justify-between rounded-lg border p-2 text-xs ${apuesta.esValueBet ? 'neon-value' : 'border-slate-700 bg-slate-800'}`} key={apuesta.seleccion}><span className="capitalize">{apuesta.seleccion} · cuota {apuesta.cuota.toFixed(2)}</span><strong>EV {porcentaje(apuesta.valorEsperado)}</strong></div>)}</div>
  </article>;
}

export function App() {
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [tabla, setTabla] = useState<Posicion[]>([]);
  const [boletos, setBoletos] = useState<Boleto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [seleccionPartido, setSeleccionPartido] = useState('');
  const [seleccion, setSeleccion] = useState<Seleccion>('local');
  const [monto, setMonto] = useState('100');
  const [error, setError] = useState('');
  const [goleadores, setGoleadores] = useState<Goleador[]>([]);
  const [asistidores, setAsistidores] = useState<Asistidor[]>([]);
  const [rendimiento, setRendimiento] = useState<{ boletos: Array<{ id: number; seleccion: string; cuota: number; montoApostado: number; estado: string; retornoNeto: number | null }>; resumen: Rendimiento }>({ boletos: [], resumen: { total: 0, resueltos: 0, ganados: 0, apostado: 0, retornoNeto: 0, roi: 0, yield: 0 } });
  const [liga, setLiga] = useState<Liga>('LIGA_MX');
  const [cacheLigas, setCacheLigas] = useState<Partial<Record<Liga, DatosLiga>>>({});

  const cargarRendimiento = async () => {
    const respuesta = await fetch(`${api}/boletos/historial?liga=${liga}`);
    if (respuesta.ok) setRendimiento(await respuesta.json() as typeof rendimiento);
  };

  useEffect(() => {
    let montado = true;
    const cargarDatos = async () => {
      setIsLoading(true);
      setError('');
      const cache = cacheLigas[liga];
      if (cache) {
        setPartidos(cache.partidos);
        setTabla(cache.tabla);
        setGoleadores(cache.goleadores);
        setAsistidores(cache.asistidores);
        setIsLoading(false);
        return;
      }
      try {
        const [respuestaPartidos, respuestaTabla] = await Promise.all([
          fetch(`${api}/partidos/hoy?liga=${liga}`),
          fetch(`${api}/tabla-posiciones?liga=${liga}`)
        ]);
        const datosPartidos: unknown = await respuestaPartidos.json();
        const datosTabla: unknown = await respuestaTabla.json();
        if (!respuestaPartidos.ok || !respuestaTabla.ok) {
          const detalle = [datosPartidos, datosTabla].find((dato) => typeof dato === 'object' && dato !== null && 'error' in dato);
          const mensaje = detalle && typeof detalle === 'object' && 'error' in detalle && typeof detalle.error === 'string'
            ? detalle.error
            : 'El servicio de datos no está disponible temporalmente.';
          throw new Error(mensaje);
        }
        if (!Array.isArray(datosPartidos) || !Array.isArray(datosTabla)) {
          throw new Error('El servicio devolvió un formato de datos inesperado.');
        }
        if (!montado) return;
        setPartidos(datosPartidos as Partido[]);
        setGoleadores(((datosPartidos[0] as Partido & { goleadores?: Goleador[] })?.goleadores ?? []));
        setAsistidores(((datosPartidos[0] as Partido & { asistidores?: Asistidor[] })?.asistidores ?? []));
        setTabla(datosTabla as Posicion[]);
        const datosLiga = {
          partidos: datosPartidos as Partido[],
          tabla: datosTabla as Posicion[],
          goleadores: (datosPartidos[0] as Partido & { goleadores?: Goleador[] })?.goleadores ?? [],
          asistidores: (datosPartidos[0] as Partido & { asistidores?: Asistidor[] })?.asistidores ?? []
        };
        setCacheLigas((actual) => ({ ...actual, [liga]: datosLiga }));
        const primerPartido = datosPartidos[0] as Partido | undefined;
        if (primerPartido) setSeleccionPartido(`${primerPartido.local} vs ${primerPartido.visitante}`);
      } catch (fallo) {
        if (montado) {
          setPartidos([]);
          setTabla([]);
          setError(fallo instanceof Error ? fallo.message : 'No se pudieron cargar los datos de la jornada.');
        }
      } finally {
        if (montado) setIsLoading(false);
      }
    };
    void cargarDatos();
    void cargarRendimiento();
    return () => { montado = false; };
  }, [liga, cacheLigas]);

  const partidoSeleccionado = Array.isArray(partidos)
    ? partidos.find((partido) => `${partido.local} vs ${partido.visitante}` === seleccionPartido)
    : undefined;
  const probabilidadSeleccion = partidoSeleccionado
    ? seleccion === 'over25' ? partidoSeleccionado.probabilidadOver25
      : seleccion === 'over8_5Corners' ? partidoSeleccionado.probabilidadOver8_5Corners
        : seleccion === 'over9_5Corners' ? partidoSeleccionado.probabilidadOver9_5Corners
          : seleccion === 'over10_5Corners' ? partidoSeleccionado.probabilidadOver10_5Corners
            : seleccion === 'over20_5Remates' ? partidoSeleccionado.probabilidadOver20_5Remates
              : seleccion === 'over7_5RematesPuerta' ? partidoSeleccionado.probabilidadOver7_5RematesPuerta
              : seleccion === 'over10_5RematesLocal' ? partidoSeleccionado.probabilidadOver10_5RematesLocal
              : seleccion === 'over10_5RematesVisitante' ? partidoSeleccionado.probabilidadOver10_5RematesVisitante
              : seleccion === 'over3_5RematesPuertaLocal' ? partidoSeleccionado.probabilidadOver3_5RematesPuertaLocal
              : seleccion === 'over3_5RematesPuertaVisitante' ? partidoSeleccionado.probabilidadOver3_5RematesPuertaVisitante
            : seleccion === 'ambosAnotan' ? partidoSeleccionado.probabilidadAmbosAnotan
      : seleccion === 'unoX' ? partidoSeleccionado.probabilidadDobleOportunidad.unoX
        : seleccion === 'X2' ? partidoSeleccionado.probabilidadDobleOportunidad.X2
          : seleccion === 'doce' ? partidoSeleccionado.probabilidadDobleOportunidad.doce
            : partidoSeleccionado.probabilidades[seleccion as 'local' | 'empate' | 'visitante']
    : 0;
  const cuotaMercado = partidoSeleccionado?.cuotas?.find((cuota) => cuota.seleccion === seleccion)?.cuota ?? 1;
  const evaluacion = useMemo(() => partidoSeleccionado ? evaluarBoleto(seleccion, probabilidadSeleccion, cuotaMercado, Number(monto)) : null, [partidoSeleccionado, seleccion, probabilidadSeleccion, cuotaMercado, monto]);
  const registrarBoleto = async () => {
    if (!evaluacion || !partidoSeleccionado) return;
    setBoletos((actuales) => [...actuales, { ...evaluacion, externoId: partidoSeleccionado.externoId, partido: seleccionPartido, seleccion }]);
    const respuesta = await fetch(`${api}/boletos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ externoId: partidoSeleccionado.externoId, liga, seleccion, cuota: evaluacion.cuota, montoApostado: evaluacion.monto, valorEsperado: evaluacion.ev }) });
    if (respuesta.ok) await cargarRendimiento();
    else setError('No se pudo guardar el boleto en el historial.');
  };
  const cargarRecomendacion = (partido: { local: string; visitante: string }, seleccionRecomendada: Seleccion) => {
    setSeleccionPartido(`${partido.local} vs ${partido.visitante}`);
    setSeleccion(seleccionRecomendada);
  };
  const partidosActuales = partidos.filter((partido) => partido.estado !== 'finalizado');
  const partidosPasados = partidos.filter((partido) => partido.estado === 'finalizado');

  return <main className="min-h-screen bg-slate-950 text-slate-100"><div className="mx-auto max-w-7xl p-6">
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">{ligas.find((opcion) => opcion.clave === liga)?.nombre} · Dashboard cuantitativo</p><h1 className="mt-2 text-4xl font-black tracking-tight">Radar de valor</h1><p className="mt-2 text-slate-400">Jornada actual · Monte Carlo + cuotas de mercado</p></div><div className="flex flex-wrap gap-3"><button onClick={() => void exportarLatex(boletos, liga).catch((fallo: Error) => setError(fallo.message))} className="rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-300">Exportar reporte LaTeX</button><button onClick={() => void exportarCsv(liga).catch((fallo: Error) => setError(fallo.message))} className="rounded-xl bg-emerald-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-emerald-300">Descargar Excel (CSV)</button></div></header>
    <nav className="mb-8 flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-2" aria-label="Seleccionar liga">{ligas.map((opcion) => <button key={opcion.clave} onClick={() => setLiga(opcion.clave)} className={`rounded-xl px-4 py-2 text-sm font-bold transition ${liga === opcion.clave ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}>{opcion.nombre}</button>)}</nav>
    {isLoading && <p className="mb-5 rounded-xl bg-slate-900 p-4 text-slate-300">Cargando datos reales de la jornada...</p>}
    {error && <div className="mb-5 rounded-xl border border-red-800 bg-red-950 p-4 text-red-200"><p className="font-semibold">No pudimos cargar la jornada</p><p className="mt-1 text-sm">{error}</p><p className="mt-2 text-xs text-red-300">Verifica la conexión del backend y la configuración de la API deportiva.</p></div>}
    <ApuestaRecomendada partidos={partidosActuales} onCargar={cargarRecomendacion} />
    <BoletosSugeridos partidos={partidosActuales} />
    <CreadorParlay partidos={partidosActuales} api={api} liga={liga} />
    <div className="grid gap-6 lg:grid-cols-[1fr_330px]">
      <section>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">Partidos analizados</h2><span className="text-sm text-slate-400">{partidosActuales.length} encuentros</span></div>
        {!isLoading && !error && partidosActuales.length === 0 && <p className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-slate-400">No hay partidos programados o en vivo.</p>}
        <div className="grid gap-5 md:grid-cols-2">{partidosActuales.map((partido) => <TarjetaPartido key={`${partido.local}-${partido.visitante}`} partido={partido} />)}</div>
        {partidosPasados.length > 0 && <div className="mt-10"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Histórico</p><h2 className="text-xl font-bold">Partidos pasados</h2></div><span className="text-sm text-slate-400">{partidosPasados.length} finalizados</span></div><div className="grid gap-5 md:grid-cols-2">{partidosPasados.map((partido) => <TarjetaPartido key={`${partido.local}-${partido.visitante}`} partido={partido} />)}</div></div>}
      </section>
      <aside className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="mb-4 text-lg font-bold">Analizador de boleto</h2><div className="space-y-3"><label className="block text-sm text-slate-400">Partido<select value={seleccionPartido} onChange={(evento) => setSeleccionPartido(evento.target.value)} className="field">{partidos.map((partido) => <option key={partido.local} value={`${partido.local} vs ${partido.visitante}`}>{partido.local} vs {partido.visitante}</option>)}</select></label><label className="block text-sm text-slate-400">Selección<select value={seleccion} onChange={(evento) => setSeleccion(evento.target.value as Seleccion)} className="field"><option value="local">Local ({partidoSeleccionado?.local ?? '—'})</option><option value="empate">Empate</option><option value="visitante">Visitante ({partidoSeleccionado?.visitante ?? '—'})</option><option value="over25">Más de 2.5 Goles</option><option value="ambosAnotan">Ambos Anotan (Sí)</option><option value="over8_5Corners">Más de 8.5 Córners</option><option value="over9_5Corners">Más de 9.5 Córners</option><option value="over10_5Corners">Más de 10.5 Córners</option><option value="over20_5Remates">Más de 20.5 Remates totales</option><option value="over7_5RematesPuerta">Más de 7.5 Remates a puerta</option><option value="unoX">1X - {partidoSeleccionado?.local ?? 'Local'} o Empate</option><option value="X2">X2 - Empate o {partidoSeleccionado?.visitante ?? 'Visitante'}</option><option value="doce">12 - {partidoSeleccionado?.local ?? 'Local'} o {partidoSeleccionado?.visitante ?? 'Visitante'}</option></select></label><div className="rounded-lg border border-cyan-900 bg-slate-800 p-3 text-sm text-slate-300"><span>Cuota de mercado</span><strong className="ml-2 text-cyan-300">{cuotaMercado.toFixed(2)}</strong>{cuotaMercado === 1 && <p className="mt-1 text-xs text-amber-300">Cuota aún no publicada; se usa 1.00 temporalmente.</p>}</div><label className="block text-sm text-slate-400">Monto apostado<input type="number" min="1" step="1" value={monto} onChange={(evento) => setMonto(evento.target.value)} className="field" /></label></div>{evaluacion && <div className={`mt-4 rounded-xl p-4 ${evaluacion.ev > 0 ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'}`}><p className="text-lg font-bold">{evaluacion.ev > 0 ? '✓ Ventaja matemática' : '✕ Sin ventaja matemática'}</p><p className="mt-1 text-sm">Probabilidad modelo: {porcentaje(evaluacion.probabilidad)}</p><p className="text-sm">EV: {porcentaje(evaluacion.ev)} · Retorno: ${evaluacion.retorno.toFixed(2)}</p></div>}<button disabled={!evaluacion} onClick={() => void registrarBoleto()} className="mt-4 w-full rounded-xl bg-white px-4 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">Guardar boleto</button></section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="mb-4 text-lg font-bold">Rendimiento histórico</h2><div className="grid grid-cols-2 gap-2 text-sm"><span>ROI: <strong className="text-cyan-300">{porcentaje(rendimiento.resumen.roi)}</strong></span><span>Yield: <strong className="text-cyan-300">{porcentaje(rendimiento.resumen.yield)}</strong></span><span>Resueltos: {rendimiento.resumen.resueltos}</span><span>Ganados: {rendimiento.resumen.ganados}</span></div><div className="mt-3 space-y-1 text-xs">{rendimiento.boletos.slice(0, 5).map((boleto) => <div className="flex justify-between rounded bg-slate-800 p-2" key={boleto.id}><span>{boleto.seleccion} · {boleto.cuota.toFixed(2)}</span><strong className={boleto.estado === 'Ganado' ? 'text-emerald-300' : boleto.estado === 'Perdido' ? 'text-red-300' : 'text-amber-300'}>{boleto.estado}</strong></div>)}</div></section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="mb-4 text-lg font-bold">Tabla general</h2><div className="space-y-2">{Array.isArray(tabla) && tabla.map((fila) => <div className="flex items-center gap-3 text-sm" key={fila.equipo}><span className="w-5 text-slate-500">{fila.posicion}</span><span className="flex-1 font-medium">{fila.equipo}<Forma valores={fila.forma} /></span><span className="font-bold text-cyan-300">{fila.puntos} pts</span></div>)}</div></section>
        <TablaGoleadores goleadores={goleadores} />
        <TablaAsistidores asistidores={asistidores} />
        <ImportadorBoleto partidos={partidos} api={api} liga={liga} onGuardado={() => void cargarRendimiento()} />
      </aside>
    </div>
  </div></main>;
}
