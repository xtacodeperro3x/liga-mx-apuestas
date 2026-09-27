import { useMemo, useState } from 'react';

type PartidoImportable = { externoId: string; local: string; visitante: string };

export function ImportadorBoleto({ partidos, api, liga, onGuardado }: { partidos: PartidoImportable[]; api: string; liga: string; onGuardado: () => void }) {
  const [partidoId, setPartidoId] = useState('');
  const [selecciones, setSelecciones] = useState('Ambos Anotan (Sí) + Más de 8.5 córners');
  const [cuotaTotal, setCuotaTotal] = useState('2.45');
  const [monto, setMonto] = useState('20.70');
  const [estado, setEstado] = useState<'Ganado' | 'Perdido' | 'Pendiente'>('Ganado');
  const [imagen, setImagen] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState('');
  const partido = useMemo(() => partidos.find((item) => item.externoId === partidoId) ?? partidos[0], [partidos, partidoId]);

  const importar = async () => {
    if (!partido) return;
    const lista = selecciones.split('+').map((valor) => valor.trim()).filter(Boolean);
    const cuota = Number(cuotaTotal);
    const apuesta = Number(monto);
    if (!lista.length || cuota < 1 || apuesta <= 0) {
      setMensaje('Completa selecciones, cuota y monto con valores válidos.');
      return;
    }
    const respuesta = await fetch(`${api}/boletos/importar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ externoId: partido.externoId, liga, selecciones: lista, cuotaTotal: cuota, montoApostado: apuesta, estado })
    });
    const datos = await respuesta.json() as { error?: string };
    if (!respuesta.ok) {
      setMensaje(datos.error ?? 'No se pudo importar el boleto.');
      return;
    }
    setMensaje('Boleto importado al historial. Sus datos ya cuentan para ROI y Yield.');
    onGuardado();
  };

  return <section className="rounded-2xl border border-amber-700 bg-slate-900 p-5">
    <h2 className="mb-1 text-lg font-bold">Importar boleto real</h2>
    <p className="mb-4 text-xs text-slate-400">Adjunta la captura y registra sus datos para que el historial aprenda de tus mercados.</p>
    <div className="space-y-3">
      <input type="file" accept="image/*" onChange={(evento) => {
        const archivo = evento.target.files?.[0];
        if (!archivo) return;
        const lector = new FileReader();
        lector.onload = () => setImagen(typeof lector.result === 'string' ? lector.result : null);
        lector.readAsDataURL(archivo);
      }} className="field text-xs" />
      {imagen && <img src={imagen} alt="Captura del boleto importado" className="max-h-40 w-full rounded-lg object-contain" />}
      <select value={partido?.externoId ?? ''} onChange={(evento) => setPartidoId(evento.target.value)} className="field">{partidos.map((item) => <option key={item.externoId} value={item.externoId}>{item.local} vs {item.visitante}</option>)}</select>
      <input value={selecciones} onChange={(evento) => setSelecciones(evento.target.value)} className="field" placeholder="Ej. Ambos Anotan (Sí) + Más de 8.5 córners" />
      <div className="grid grid-cols-2 gap-2"><input type="number" min="1" step="0.01" value={cuotaTotal} onChange={(evento) => setCuotaTotal(evento.target.value)} className="field" placeholder="Cuota total" /><input type="number" min="1" step="0.01" value={monto} onChange={(evento) => setMonto(evento.target.value)} className="field" placeholder="Monto" /></div>
      <select value={estado} onChange={(evento) => setEstado(evento.target.value as typeof estado)} className="field"><option>Ganado</option><option>Perdido</option><option>Pendiente</option></select>
      <button onClick={() => void importar()} className="w-full rounded-xl bg-amber-300 px-4 py-3 font-bold text-slate-950">Importar boleto al historial</button>
      {mensaje && <p className="text-xs text-amber-200">{mensaje}</p>}
    </div>
  </section>;
}
