import { describe, expect, it } from 'vitest';
import { construirReporteLatex } from './exportadorLatex.js';

describe('exportador LaTeX', () => {
  it('genera artículo, metodología y tablas con EV', () => {
    const reporte = construirReporteLatex([{
      local: 'Toluca',
      visitante: 'Cruz Azul',
      iteracionesMonteCarlo: 10_000,
      probabilidades: { local: 0.5, empate: 0.2, visitante: 0.3 },
      apuestas: [{ seleccion: 'local', cuota: 2, valorEsperado: 0.1 }]
    }], []);
    expect(reporte).toContain('\\documentclass');
    expect(reporte).toContain('\\usepackage{amsmath}');
    expect(reporte).toContain('P(X=k');
    expect(reporte).toContain('f^*');
    expect(reporte).toContain('\\begin{tabular}');
    expect(reporte).toContain('10.00\\%');
  });
});
