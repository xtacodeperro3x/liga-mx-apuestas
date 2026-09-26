import { describe, expect, it } from 'vitest';
import { construirReporteCsv } from './exportadorCsv.js';

describe('exportador CSV', () => {
  it('usa punto y coma y solo cita los campos que lo necesitan', () => {
    const reporte = construirReporteCsv([{
      local: 'Pumas',
      visitante: 'León',
      jornada: 1,
      estado: 'programado',
      probabilidades: { local: 0.4, empate: 0.3, visitante: 0.3 },
      probabilidadOver25: 0.5,
      probabilidadOver8_5Corners: 0.5,
      probabilidadOver9_5Corners: 0.4,
      probabilidadOver10_5Corners: 0.3,
      probabilidadDobleOportunidad: { unoX: 0.7, X2: 0.6, doce: 0.7 },
      apuestas: []
    }], {
      resumen: { roi: 0, yield: 0, total: 0, resueltos: 0, ganados: 0 },
      boletos: []
    }, null);
    expect(reporte).toContain('Local;Visitante;Jornada');
    expect(reporte).toContain('Pumas;León');
    expect(reporte).not.toContain('"Pumas"');
  });
});
