import { rasparTabla, type PosicionRaspada, type Liga } from './scraper.js';

export type PosicionLiga = PosicionRaspada;

export async function obtenerTablaPosiciones(liga: Liga = 'LIGA_MX'): Promise<PosicionLiga[]> {
  return rasparTabla(liga);
}
