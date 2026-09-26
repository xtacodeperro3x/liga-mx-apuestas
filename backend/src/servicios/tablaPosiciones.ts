import { rasparTabla, type PosicionRaspada } from './scraperLigaMx.js';

export type PosicionLiga = PosicionRaspada;

export async function obtenerTablaPosiciones(): Promise<PosicionLiga[]> {
  return rasparTabla();
}
