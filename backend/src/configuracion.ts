import { config as cargarDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const archivoEnvLocal = resolve(process.cwd(), '.env');
const archivoEnvRaiz = resolve(process.cwd(), '..', '.env');

if (existsSync(archivoEnvRaiz)) {
  cargarDotenv({ path: archivoEnvRaiz, override: true });
}

if (existsSync(archivoEnvLocal)) {
  cargarDotenv({ path: archivoEnvLocal, override: true });
}

export const configuracion = {
  puerto: Number(process.env.PORT ?? 3001),
  temporada: Number(process.env.TEMPORADA ?? new Date().getUTCFullYear()),
  sincronizacionActiva: process.env.SINCRONIZACION_ACTIVA === 'true',
  bankroll: Number(process.env.BANKROLL ?? 1000),
  fraccionKelly: Number(process.env.FRACCION_KELLY ?? 0.25)
};
