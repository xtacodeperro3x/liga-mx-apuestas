type AnalisisExportable = {
  local: string;
  visitante: string;
  jornada: number;
  estado: string;
  probabilidades: { local: number; empate: number; visitante: number };
  probabilidadOver25: number;
  probabilidadOver8_5Corners: number;
  probabilidadOver9_5Corners: number;
  probabilidadOver10_5Corners: number;
  probabilidadOver20_5Remates?: number;
  probabilidadOver7_5RematesPuerta?: number;
  probabilidadDobleOportunidad: { unoX: number; X2: number; doce: number };
  apuestas: Array<{ seleccion: string; cuota: number; valorEsperado: number; fraccionKelly: number }>;
};

type RendimientoExportable = {
  resumen: { roi: number; yield: number; total: number; resueltos: number; ganados: number };
  boletos: Array<{ fecha: Date | string; seleccion: string; cuota: number; montoApostado: number; estado: string; retornoNeto: number | null }>;
};

function csv(valor: unknown): string {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  if (!/[;"\r\n]/.test(texto)) return texto;
  return `"${texto.replace(/"/g, '""')}"`;
}

function fila(valores: unknown[]): string {
  return valores.map(csv).join(';');
}

export function construirReporteCsv(analisis: AnalisisExportable[], rendimiento: RendimientoExportable, smartPick: { partido: string; seleccion: string; cuota: number; ev: number } | null): string {
  const lineas = [
    fila(['REPORTE CUANTITATIVO LIGA MX']),
    fila(['PARTIDOS']),
    fila(['Local', 'Visitante', 'Jornada', 'Estado', 'P(Local)', 'P(Empate)', 'P(Visitante)', 'P(Over 2.5)', 'P(Over 8.5 Corners)', 'P(Over 9.5 Corners)', 'P(Over 10.5 Corners)', 'P(Over 20.5 Remates)', 'P(Over 7.5 Remates a puerta)', 'P(1X)', 'P(X2)', 'P(12)', 'Mejor selección', 'Cuota', 'EV', 'Kelly']),
    ...analisis.map((partido) => {
      const mejor = partido.apuestas.filter((apuesta) => apuesta.cuota > 1).sort((a, b) => b.valorEsperado - a.valorEsperado)[0];
      return fila([
        partido.local, partido.visitante, partido.jornada, partido.estado,
        partido.probabilidades.local, partido.probabilidades.empate, partido.probabilidades.visitante,
        partido.probabilidadOver25, partido.probabilidadOver8_5Corners, partido.probabilidadOver9_5Corners, partido.probabilidadOver10_5Corners, partido.probabilidadOver20_5Remates ?? '', partido.probabilidadOver7_5RematesPuerta ?? '',
        partido.probabilidadDobleOportunidad.unoX, partido.probabilidadDobleOportunidad.X2, partido.probabilidadDobleOportunidad.doce,
        mejor?.seleccion ?? '', mejor?.cuota ?? '', mejor?.valorEsperado ?? '', mejor?.fraccionKelly ?? ''
      ]);
    }),
    '',
    fila(['HISTORIAL DE BOLETOS']),
    fila(['Fecha', 'Selección', 'Cuota', 'Monto apostado', 'Estado', 'Retorno neto']),
    ...rendimiento.boletos.map((boleto) => fila([boleto.fecha, boleto.seleccion, boleto.cuota, boleto.montoApostado, boleto.estado, boleto.retornoNeto])),
    '',
    fila(['RENDIMIENTO HISTÓRICO']),
    fila(['Total boletos', 'Resueltos', 'Ganados', 'ROI', 'Yield']),
    fila([rendimiento.resumen.total, rendimiento.resumen.resueltos, rendimiento.resumen.ganados, rendimiento.resumen.roi, rendimiento.resumen.yield]),
    '',
    fila(['SMART PICK DEL ORÁCULO']),
    fila(['Partido', 'Selección', 'Cuota', 'EV']),
    fila(smartPick ? [smartPick.partido, smartPick.seleccion, smartPick.cuota, smartPick.ev] : ['', 'Sin oportunidad con cuota publicada', '', ''])
  ];
  return `${lineas.join('\r\n')}\r\n`;
}
