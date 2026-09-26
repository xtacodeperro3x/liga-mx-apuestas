type Asistidor = { nombre: string; equipo: string; asistencias: number };

export function TablaAsistidores({ asistidores }: { asistidores: Asistidor[] }) {
  return <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
    <h2 className="mb-4 text-lg font-bold">Tabla de asistidores</h2>
    {asistidores.length === 0
      ? <p className="text-sm text-slate-400">No hay datos de asistencias disponibles.</p>
      : <div className="space-y-2">{asistidores.slice(0, 10).map((jugador, indice) => <div className="flex items-center gap-3 text-sm" key={`${jugador.nombre}-${jugador.equipo}`}><span className="w-5 text-slate-500">{indice + 1}</span><div className="min-w-0 flex-1"><p className="truncate font-medium">{jugador.nombre}</p><p className="truncate text-xs text-slate-500">{jugador.equipo}</p></div><strong className="text-fuchsia-300">{jugador.asistencias}</strong></div>)}</div>}
  </section>;
}
