type Goleador = { nombre: string; equipo: string; goles: number };

export function TablaGoleadores({ goleadores }: { goleadores: Goleador[] }) {
  return <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
    <h2 className="mb-4 text-lg font-bold">Tabla de goleadores</h2>
    {goleadores.length === 0
      ? <p className="text-sm text-slate-400">No hay datos de goleo disponibles.</p>
      : <div className="space-y-2">{goleadores.slice(0, 10).map((goleador, indice) => <div className="flex items-center gap-3 text-sm" key={`${goleador.nombre}-${goleador.equipo}`}><span className="w-5 text-slate-500">{indice + 1}</span><div className="min-w-0 flex-1"><p className="truncate font-medium">{goleador.nombre}</p><p className="truncate text-xs text-slate-500">{goleador.equipo}</p></div><strong className="text-cyan-300">{goleador.goles}</strong></div>)}</div>}
  </section>;
}
