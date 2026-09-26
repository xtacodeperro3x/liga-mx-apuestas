export type ProbabilidadesPartido = {
  local: number;
  empate: number;
  visitante: number;
};

function factorial(numero: number): number {
  if (numero < 0 || !Number.isInteger(numero)) throw new Error('El factorial requiere un entero no negativo');
  let resultado = 1;
  for (let i = 2; i <= numero; i += 1) resultado *= i;
  return resultado;
}

function probabilidadGoles(media: number, goles: number): number {
  return Math.exp(-media) * (media ** goles) / factorial(goles);
}

export function calcularProbabilidadesPoisson(
  mediaLocal: number,
  mediaVisitante: number,
  maximoGoles = 10
): ProbabilidadesPartido {
  if (mediaLocal < 0 || mediaVisitante < 0) throw new Error('Las medias de goles no pueden ser negativas');
  let local = 0;
  let empate = 0;
  let visitante = 0;
  for (let golesLocal = 0; golesLocal <= maximoGoles; golesLocal += 1) {
    for (let golesVisitante = 0; golesVisitante <= maximoGoles; golesVisitante += 1) {
      const probabilidad = probabilidadGoles(mediaLocal, golesLocal) * probabilidadGoles(mediaVisitante, golesVisitante);
      if (golesLocal > golesVisitante) local += probabilidad;
      else if (golesLocal === golesVisitante) empate += probabilidad;
      else visitante += probabilidad;
    }
  }
  const total = local + empate + visitante;
  return { local: local / total, empate: empate / total, visitante: visitante / total };
}
