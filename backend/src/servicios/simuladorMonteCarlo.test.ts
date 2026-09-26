import { describe, expect, it } from 'vitest';
import { calcularInterseccionMonteCarlo, simularPartidoMonteCarlo } from './simuladorMonteCarlo.js';
import type { PosicionLiga } from './tablaPosiciones.js';

const equipo: PosicionLiga = {
  posicion: 1,
  equipo: 'Equipo A',
  puntos: 20,
  jugados: 10,
  diferencia: 10,
  golesFavor: 20,
  golesContra: 10,
  xG: 18,
  posesion: null,
  tirosAPuerta: null
};

describe('simulador Monte Carlo', () => {
  it('ejecuta 10,000 iteraciones y conserva probabilidades válidas', () => {
    const resultado = simularPartidoMonteCarlo(equipo, { ...equipo, equipo: 'Equipo B', puntos: 10 }, 10_000);
    const suma = resultado.probabilidades.local + resultado.probabilidades.empate + resultado.probabilidades.visitante;
    expect(resultado.iteraciones).toBe(10_000);
    expect(suma).toBe(1);
    expect(resultado.probabilidades.local).toBeGreaterThan(0);
  });

  it('usa marcador y tiempo restante cuando el partido está en vivo', () => {
    const resultado = simularPartidoMonteCarlo(equipo, { ...equipo, equipo: 'Equipo B' }, 10_000, {
      estado: 'en_vivo',
      minuto: 90,
      marcador: { local: 2, visitante: 0 }
    });
    expect(resultado.probabilidades.local).toBe(1);
    expect(resultado.probabilidades.empate).toBe(0);
    expect(resultado.probabilidades.visitante).toBe(0);
    expect(resultado.mediasGoles.local).toBe(0);
    expect(resultado.mediasGoles.visitante).toBe(0);
  });

  it('penaliza el xG del equipo que tiene ausencias', () => {
    const base = simularPartidoMonteCarlo(equipo, { ...equipo, equipo: 'Equipo B' }, 100, {
      estado: 'programado',
      minuto: null,
      marcador: { local: null, visitante: null }
    });
    const conBaja = simularPartidoMonteCarlo(equipo, { ...equipo, equipo: 'Equipo B' }, 100, {
      estado: 'programado',
      minuto: null,
      marcador: { local: null, visitante: null },
      ausencias: { local: ['Delantero titular'], visitante: [] }
    });
    expect(conBaja.mediasGoles.local).toBeCloseTo(base.mediasGoles.local * 0.85);
    expect(conBaja.mediasGoles.visitante).toBe(base.mediasGoles.visitante);
  });

  it('calcula las probabilidades de doble oportunidad con las mismas iteraciones', () => {
    const resultado = simularPartidoMonteCarlo(equipo, { ...equipo, equipo: 'Equipo B' }, 10_000);
    expect(resultado.probabilidadDobleOportunidad.unoX).toBeCloseTo(
      resultado.probabilidades.local + resultado.probabilidades.empate,
      10
    );
    expect(resultado.probabilidadDobleOportunidad.X2).toBeCloseTo(
      resultado.probabilidades.empate + resultado.probabilidades.visitante,
      10
    );
    expect(resultado.probabilidadDobleOportunidad.doce).toBeCloseTo(
      resultado.probabilidades.local + resultado.probabilidades.visitante,
      10
    );
  });

  it('simula mercados de córners con fallback y umbrales correctos', () => {
    const resultado = simularPartidoMonteCarlo(
      { ...equipo, promedioCorners: null },
      { ...equipo, equipo: 'Equipo B', promedioCorners: null },
      10_000
    );
    expect(resultado.probabilidadOver8_5Corners).toBeGreaterThanOrEqual(resultado.probabilidadOver9_5Corners);
    expect(resultado.probabilidadOver9_5Corners).toBeGreaterThanOrEqual(resultado.probabilidadOver10_5Corners);
    expect(resultado.probabilidadOver10_5Corners).toBeGreaterThanOrEqual(0);
    expect(resultado.probabilidadOver8_5Corners).toBeLessThanOrEqual(1);
  });

  it('calcula cero para selecciones contradictorias del mismo partido', () => {
    const probabilidad = calcularInterseccionMonteCarlo(equipo, { ...equipo, equipo: 'Equipo B' }, ['local', 'visitante'], 10_000);
    expect(probabilidad).toBe(0);
  });

  it('calcula ambos anotan solo cuando los dos equipos marcan', () => {
    const resultado = simularPartidoMonteCarlo(equipo, { ...equipo, equipo: 'Equipo B' }, 10_000);
    expect(resultado.probabilidadAmbosAnotan).toBeGreaterThanOrEqual(0);
    expect(resultado.probabilidadAmbosAnotan).toBeLessThanOrEqual(1);
  });

  it('calcula mercados de remates totales y a puerta', () => {
    const resultado = simularPartidoMonteCarlo(
      { ...equipo, promedioRemates: 12, tirosAPuerta: 4 },
      { ...equipo, equipo: 'Equipo B', promedioRemates: 10, tirosAPuerta: 3 },
      10_000
    );
    expect(resultado.probabilidadOver20_5Remates).toBeGreaterThanOrEqual(0);
    expect(resultado.probabilidadOver20_5Remates).toBeLessThanOrEqual(1);
    expect(resultado.probabilidadOver7_5RematesPuerta).toBeGreaterThanOrEqual(0);
    expect(resultado.probabilidadOver7_5RematesPuerta).toBeLessThanOrEqual(1);
  });
});
