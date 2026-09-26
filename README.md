# Liga MX Apuestas

Esqueleto full-stack para análisis estadístico y modelado de apuestas de la Liga MX.

## Inicio rápido

1. Copia `.env.example` a `.env`.
2. Ejecuta `docker compose up -d`.
3. Ejecuta `npm install`.
4. Ejecuta `npm run db:push --workspace backend`.
5. Ejecuta `npm run dev --workspace backend` y `npm run dev --workspace frontend`.

El backend raspa la tabla y el calendario públicos de ESPN Deportes mediante `axios` + `cheerio`; no requiere una clave de API. Las URLs se pueden ajustar con `LIGA_MX_POSICIONES_URL` y `LIGA_MX_CALENDARIO_URL`. La sincronización diaria se activa con `SINCRONIZACION_ACTIVA=true` y persiste tabla, estadísticas y calendario en Prisma.

## Publicar como página web

El repositorio incluye `render.yaml` para desplegar el backend, PostgreSQL y el frontend como servicios separados en Render. Después de conectar el repositorio en Render, selecciona **Blueprint** y confirma el archivo; el frontend quedará disponible en una URL pública y consumirá automáticamente el backend.

No subas `.env`: contiene configuración local. En producción configura `DATABASE_URL`, `SINCRONIZACION_ACTIVA=true` y las URLs de ESPN como variables de entorno del servicio backend.
