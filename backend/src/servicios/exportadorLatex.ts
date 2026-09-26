import type { ApuestaAnalizada, PartidoAnalizado } from './tiposReporte.js';

type BoletoManual = {
  partido: string;
  seleccion: string;
  cuota: number;
  monto: number;
  probabilidad: number;
  ev: number;
  retorno: number;
};
type ResumenRendimiento = { total: number; resueltos: number; ganados: number; apostado: number; retornoNeto: number; roi: number; yield: number };

function escaparLatex(valor: string): string {
  return valor
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([{}%&#_$])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

function porcentaje(valor: number): string {
  return `${(valor * 100).toFixed(2)}\\%`;
}

function filaPartido(partido: PartidoAnalizado): string {
  const nombre = escaparLatex(`${partido.local} vs ${partido.visitante}`);
  const apuestas = partido.apuestas.length ? partido.apuestas : [{ seleccion: 'Sin cuotas', cuota: 0, valorEsperado: 0 }];
  return apuestas.map((apuesta: ApuestaAnalizada) =>
    `${nombre} & ${porcentaje(partido.probabilidades.local)} & ${porcentaje(partido.probabilidades.empate)} & ${porcentaje(partido.probabilidades.visitante)} & ${escaparLatex(apuesta.seleccion)} & ${apuesta.cuota ? apuesta.cuota.toFixed(2) : '--'} & ${apuesta.cuota ? `${(apuesta.valorEsperado * 100).toFixed(2)}\\%` : '--'} \\\\`
  ).join('\n');
}

export function construirReporteLatex(partidos: PartidoAnalizado[], boletos: BoletoManual[], rendimiento?: ResumenRendimiento): string {
  const filasPartidos = partidos.length
    ? partidos.map(filaPartido).join('\n')
    : 'No hay partidos disponibles. \\\\';
  const filasBoletos = boletos.length
    ? boletos.map((boleto) =>
      `${escaparLatex(boleto.partido)} & ${escaparLatex(boleto.seleccion)} & ${boleto.cuota.toFixed(2)} & ${porcentaje(boleto.probabilidad)} & ${(boleto.ev * 100).toFixed(2)}\\% & ${boleto.monto.toFixed(2)} \\\\`
    ).join('\n')
    : 'No se registraron boletos manuales. \\\\';
  const iteraciones = partidos[0]?.iteracionesMonteCarlo ?? 10_000;
  const resumen = rendimiento ?? { total: 0, resueltos: 0, ganados: 0, apostado: 0, retornoNeto: 0, roi: 0, yield: 0 };

  return `\\documentclass[11pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage[margin=2.2cm]{geometry}
\\usepackage{booktabs}
\\title{Bitácora cuantitativa de Liga MX}
\\author{Motor de análisis estadístico}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Metodología}
Las probabilidades se estiman mediante ${iteraciones.toLocaleString('es-MX')} iteraciones de Monte Carlo por partido. En cada iteración se muestrean los goles local y visitante de distribuciones de Poisson:
\\[
P(X=k\\mid\\lambda)=\\frac{e^{-\\lambda}\\lambda^k}{k!}, \\qquad k\\in\\{0,1,2,\\ldots\\}.
\\]
Las medias ${String.raw`\\lambda`} se obtienen de la combinación de goles a favor, goles en contra, puntos y goles esperados ($xG$) de cada equipo. Las probabilidades finales son las frecuencias relativas:
\\[
\\widehat{P}_{L}=\\frac{N_L}{N}, \\qquad
\\widehat{P}_{E}=\\frac{N_E}{N}, \\qquad
\\widehat{P}_{V}=\\frac{N_V}{N},
\\]
donde $N=${iteraciones.toLocaleString('es-MX')} es el número de simulaciones.

Para una cuota decimal $c$ y una probabilidad estimada $p$, el valor esperado se calcula como:
\\[
EV=p\\,c-1.
\\]
La fracción recomendada mediante el Criterio de Kelly, usando una fracción conservadora $\\alpha$, es:
\\[
f^*=\\alpha\\,\\max\\left(0,\\frac{(c-1)p-(1-p)}{c-1}\\right).
\\]

\\section{Matriz de probabilidades y mercado}
\\begin{center}
\\small
\\begin{tabular}{p{3.5cm}rrrlrr}
\\toprule
\\textbf{Partido} & \\textbf{Local} & \\textbf{Empate} & \\textbf{Visitante} & \\textbf{Selección} & \\textbf{Cuota} & \\textbf{EV} \\\\
\\midrule
${filasPartidos}
\\bottomrule
\\end{tabular}
\\end{center}

\\section{Boletos manuales}
\\begin{center}
\\small
\\begin{tabular}{p{4.1cm}lrrrr}
\\toprule
\\textbf{Partido} & \\textbf{Selección} & \\textbf{Cuota} & \\textbf{Prob.} & \\textbf{EV} & \\textbf{Monto} \\\\
\\midrule
${filasBoletos}
\\bottomrule
\\end{tabular}
\\end{center}

\\section{Rendimiento histórico}
\\begin{center}
\\begin{tabular}{lr}
\\toprule
\\textbf{Métrica} & \\textbf{Valor} \\\\
\\midrule
Boletos registrados & ${resumen.total} \\\\
Boletos resueltos & ${resumen.resueltos} \\\\
Boletos ganados & ${resumen.ganados} \\\\
Capital apostado & ${resumen.apostado.toFixed(2)} \\\\
Retorno neto & ${resumen.retornoNeto.toFixed(2)} \\\\
ROI & ${porcentaje(resumen.roi)} \\\\
Yield de aciertos & ${porcentaje(resumen.yield)} \\\\
\\bottomrule
\\end{tabular}
\\end{center}

\\end{document}
`;
}
