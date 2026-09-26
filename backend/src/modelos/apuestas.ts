export type ResultadoApuesta = {
  probabilidad: number;
  cuota: number;
  valorEsperado: number;
  esValueBet: boolean;
  fraccionKelly: number;
};

export function calcularValorEsperado(probabilidad: number, cuota: number): number {
  if (probabilidad < 0 || probabilidad > 1 || cuota < 1) throw new Error('Probabilidad o cuota invalida');
  return (probabilidad * cuota) - 1;
}

export function calcularKelly(probabilidad: number, cuota: number, fraccion = 0.25): number {
  if (cuota === 1) return 0;
  const b = cuota - 1;
  const kellyCompleto = ((b * probabilidad) - (1 - probabilidad)) / b;
  return Math.max(0, Math.min(1, kellyCompleto * fraccion));
}

export function analizarApuesta(probabilidad: number, cuota: number, fraccion = 0.25): ResultadoApuesta {
  const valorEsperado = calcularValorEsperado(probabilidad, cuota);
  return {
    probabilidad,
    cuota,
    valorEsperado,
    esValueBet: valorEsperado > 0,
    fraccionKelly: calcularKelly(probabilidad, cuota, fraccion)
  };
}
