import { describe, expect, it } from 'vitest';
import { analizarApuesta, calcularKelly, calcularValorEsperado } from './apuestas.js';

describe('modelos de apuestas', () => {
  it('calcula EV y detecta una apuesta de valor', () => {
    expect(calcularValorEsperado(0.6, 2)).toBeCloseTo(0.2);
    expect(analizarApuesta(0.6, 2).esValueBet).toBe(true);
  });
  it('nunca recomienda Kelly negativo', () => {
    expect(calcularKelly(0.2, 2)).toBe(0);
  });
});
