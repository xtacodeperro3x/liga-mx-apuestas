import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';

const URL_POSICIONES_POR_DEFECTO = 'https://www.espn.com.mx/futbol/posiciones/_/liga/MEX.1';
const URL_CALENDARIO_POR_DEFECTO = 'https://www.espn.com.mx/futbol/calendario/_/liga/MEX.1';
const URL_FBREF_POR_DEFECTO = 'https://fbref.com/en/comps/31/standard/Liga-MX-Stats';
const URL_ESTADISTICAS_POR_DEFECTO = 'https://www.espn.com.mx/futbol/estadisticas/_/liga/MEX.1';
const CABECERAS = {
  'User-Agent': 'Mozilla/5.0 (compatible; LigaMXAnalizador/1.0; +https://www.espn.com.mx/)',
  Accept: 'text/html,application/xhtml+xml'
};

export type PosicionRaspada = {
  posicion: number;
  equipo: string;
  puntos: number;
  jugados: number;
  diferencia: number;
  golesFavor: number;
  golesContra: number;
  xG: number | null;
  posesion: number | null;
  tirosAPuerta: number | null;
  promedioCorners?: number | null;
  promedioRemates?: number | null;
  forma?: string[];
};

export type GoleadorRaspado = {
  nombre: string;
  equipo: string;
  goles: number;
};

export type AsistidorRaspado = {
  nombre: string;
  equipo: string;
  asistencias: number;
};

export type PartidoRaspado = {
  externoId: string;
  fecha: string;
  jornada: number;
  estado: 'programado' | 'en_vivo' | 'finalizado';
  minuto: number | null;
  marcador: { local: number; visitante: number } | null;
  ausencias: { local: string[]; visitante: string[] };
  local: string;
  visitante: string;
  golesLocal: number | null;
  golesVisitante: number | null;
  cuotas: Array<{ casa: string; mercado: string; seleccion: 'local' | 'empate' | 'visitante' | 'ambosAnotan' | 'over10_5RematesLocal' | 'over10_5RematesVisitante' | 'over3_5RematesPuertaLocal' | 'over3_5RematesPuertaVisitante'; cuota: number }>;
};

function numero(texto: string): number | null {
  const limpio = texto.replace(/\u00a0/g, ' ').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return limpio ? Number(limpio[0]) : null;
}

async function enriquecerFormaDesdeCalendario(tabla: PosicionRaspada[]) {
  try {
    const formaPorEquipo = new Map<string, string[]>();
    const hoy = new Date();
    const fechas = Array.from({ length: 45 }, (_valor, indice) => {
      const fecha = new Date(hoy);
      fecha.setDate(hoy.getDate() - indice);
      return `${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, '0')}${String(fecha.getDate()).padStart(2, '0')}`;
    });
    const respuestas = await Promise.allSettled(fechas.map((fecha) => axios.get<{ events?: Array<{ date?: string; status?: { type?: { completed?: boolean } }; competitions?: Array<{ competitors?: Array<{ homeAway?: string; score?: string; team?: { displayName?: string } }> }> }> }>(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/mex.1/scoreboard?dates=${fecha}&limit=100`,
      { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, timeout: 8_000 }
    )));
    const resultados: Array<{ fecha: string; equipo: string; resultado: string }> = [];
    for (const respuesta of respuestas) {
      if (respuesta.status !== 'fulfilled') continue;
      for (const evento of respuesta.value.data.events ?? []) {
        const competidores = evento.competitions?.[0]?.competitors ?? [];
        if (!evento.status?.type?.completed || competidores.length < 2) continue;
        const local = competidores.find((equipo) => equipo.homeAway === 'home');
        const visitante = competidores.find((equipo) => equipo.homeAway === 'away');
        const golesLocal = Number(local?.score);
        const golesVisitante = Number(visitante?.score);
        if (!local?.team?.displayName || !visitante?.team?.displayName || !Number.isFinite(golesLocal) || !Number.isFinite(golesVisitante)) continue;
        resultados.push(
          { fecha: evento.date ?? '', equipo: local.team.displayName, resultado: golesLocal > golesVisitante ? 'V' : golesLocal === golesVisitante ? 'E' : 'D' },
          { fecha: evento.date ?? '', equipo: visitante.team.displayName, resultado: golesVisitante > golesLocal ? 'V' : golesVisitante === golesLocal ? 'E' : 'D' }
        );
      }
    }
    for (const resultado of resultados.sort((a, b) => a.fecha.localeCompare(b.fecha))) {
      const clave = normalizarNombre(resultado.equipo);
      formaPorEquipo.set(clave, [...(formaPorEquipo.get(clave) ?? []), resultado.resultado].slice(-5));
    }
    for (const fila of tabla) fila.forma = formaPorEquipo.get(normalizarNombre(fila.equipo)) ?? fila.forma ?? [];
  } catch (error) {
    console.warn('No se pudo construir la forma desde el calendario:', error instanceof Error ? error.message : error);
  }
}

function texto(elemento: cheerio.Cheerio<AnyNode>): string {
  return elemento.text().replace(/\s+/g, ' ').trim();
}

async function descargarHtml(url: string): Promise<cheerio.CheerioAPI> {
  let ultimoError: unknown;
  for (let intento = 1; intento <= 2; intento += 1) {
    try {
      const respuesta = await axios.get<string>(url, {
        headers: CABECERAS,
        timeout: 20_000,
        responseType: 'text',
        validateStatus: (estado) => estado >= 200 && estado < 300
      });
      if (!respuesta.data || typeof respuesta.data !== 'string') {
        throw new Error(`ESPN devolvió una respuesta HTML vacía para ${url}`);
      }
      return cheerio.load(respuesta.data);
    } catch (error) {
      ultimoError = error;
      if (intento < 2) await new Promise((resolver) => setTimeout(resolver, 500));
    }
  }
  if (axios.isAxiosError(ultimoError)) {
    throw new Error(`No se pudo descargar ESPN (${ultimoError.response?.status ?? ultimoError.code ?? ultimoError.message})`);
  }
  throw ultimoError instanceof Error ? ultimoError : new Error('No se pudo descargar la fuente de Liga MX');
}

function indiceCabecera(cabeceras: string[], patrones: RegExp[]): number {
  return cabeceras.findIndex((cabecera) => patrones.some((patron) => patron.test(cabecera)));
}

function filaBase(
  posicion: number,
  equipo: string,
  puntos: number,
  jugados: number,
  golesFavor: number,
  golesContra: number,
  diferencia: number
): PosicionRaspada {
  return { posicion, equipo, puntos, jugados, diferencia, golesFavor, golesContra, xG: null, posesion: null, tirosAPuerta: null, promedioCorners: null, promedioRemates: null, forma: [] };
}

function extraerForma(celdas: string[]): string[] {
  const valores = celdas.join(' ').match(/\b[VED]\b/gi) ?? [];
  return valores.map((valor) => valor.toUpperCase()).slice(-5);
}

export async function rasparGoleadores(): Promise<GoleadorRaspado[]> {
  try {
    const $ = await descargarHtml(process.env.LIGA_MX_ESTADISTICAS_URL ?? URL_ESTADISTICAS_POR_DEFECTO);
    const goleadores: GoleadorRaspado[] = [];
    $('table').each((_indice, tabla) => {
    const filas = $(tabla).find('tr');
    const cabeceras = filas.first().find('th, td').toArray().map((celda) => texto($(celda)).toUpperCase());
    const indiceNombre = indiceCabecera(cabeceras, [/PLAYER|JUGADOR|NOMBRE/]);
    const indiceEquipo = indiceCabecera(cabeceras, [/TEAM|EQUIPO|SQUAD/]);
    const indiceGoles = indiceCabecera(cabeceras, [/^G$|GOALS|GOLES/]);
    if (indiceNombre < 0 || indiceEquipo < 0 || indiceGoles < 0) return;
    filas.slice(1).each((_filaIndice, fila) => {
      const celdas = $(fila).find('th, td').toArray().map((celda) => texto($(celda)));
      const nombre = celdas[indiceNombre];
      const equipo = celdas[indiceEquipo];
      const goles = numero(celdas[indiceGoles] ?? '');
      if (nombre && equipo && goles !== null) goleadores.push({ nombre, equipo, goles });
    });
    });
    return [...new Map(goleadores.map((goleador) => [`${goleador.nombre}-${goleador.equipo}`, goleador])).values()]
      .sort((a, b) => b.goles - a.goles);
  } catch (error) {
    console.warn('No se pudo obtener la tabla de goleadores; se devuelve una lista vacía:', error instanceof Error ? error.message : error);
    return [];
  }
}

export async function rasparAsistidores(): Promise<AsistidorRaspado[]> {
    try {
      const $ = await descargarHtml(process.env.LIGA_MX_ESTADISTICAS_URL ?? URL_ESTADISTICAS_POR_DEFECTO);
      const asistidores: AsistidorRaspado[] = [];
      $('table').each((_indice, tabla) => {
        const filas = $(tabla).find('tr');
        const cabeceras = filas.first().find('th, td').toArray().map((celda) => texto($(celda)).toUpperCase());
        const indiceNombre = indiceCabecera(cabeceras, [/PLAYER|JUGADOR|NOMBRE/]);
        const indiceEquipo = indiceCabecera(cabeceras, [/TEAM|EQUIPO|SQUAD/]);
        const indiceAsistencias = indiceCabecera(cabeceras, [/^A$|^PA$|ASSISTS|ASISTENCIAS|ASIST/]);
        if (indiceNombre < 0 || indiceEquipo < 0 || indiceAsistencias < 0) return;
        filas.slice(1).each((_filaIndice, fila) => {
          const celdas = $(fila).find('th, td').toArray().map((celda) => texto($(celda)));
          const nombre = celdas[indiceNombre];
          const equipo = celdas[indiceEquipo];
          const asistencias = numero(celdas[indiceAsistencias] ?? '');
          if (nombre && equipo && asistencias !== null) asistidores.push({ nombre, equipo, asistencias });
        });
      });
      return [...new Map(asistidores.map((jugador) => [`${jugador.nombre}-${jugador.equipo}`, jugador])).values()]
        .sort((a, b) => b.asistencias - a.asistencias);
    } catch (error) {
      console.warn('No se pudo obtener la tabla de asistidores; se devuelve una lista vacía:', error instanceof Error ? error.message : error);
      return [];
    }
  }

function agregarTablaSeparada($: cheerio.CheerioAPI, resultados: PosicionRaspada[]) {
  const tablaEquipos = $('.standings__table .Table--fixed-left').first();
  const tablaEstadisticas = $('.standings__table table').filter((_indice, tabla) => !$(tabla).hasClass('Table--fixed-left')).first();
  const equipos = tablaEquipos.find('tbody tr').toArray().map((fila) => {
    const nombre = $(fila).find('.hide-mobile a, [href*="/futbol/equipo/"]').last().text().trim();
    const posicion = numero($(fila).find('.team-position').text()) ?? 0;
    return { nombre, posicion };
  }).filter((fila) => fila.nombre);
  const filas = tablaEstadisticas.find('tbody tr').toArray();
  filas.forEach((fila, indice) => {
    const celdas = $(fila).find('td').toArray().map((celda) => numero($(celda).text()));
    const equipo = equipos[indice];
    if (!equipo || celdas.length < 8) return;
    const [jugados, , , , golesFavor, golesContra, diferencia, puntos] = celdas;
    if ([jugados, golesFavor, golesContra, puntos].some((valor) => valor === null)) return;
    resultados.push(filaBase(
      equipo.posicion,
      equipo.nombre,
      puntos as number,
      jugados as number,
      golesFavor as number,
      golesContra as number,
      diferencia ?? (golesFavor as number) - (golesContra as number)
    ));
  });
}

export async function rasparTabla(): Promise<PosicionRaspada[]> {
  const $ = await descargarHtml(process.env.LIGA_MX_POSICIONES_URL ?? URL_POSICIONES_POR_DEFECTO);
  const resultados: PosicionRaspada[] = [];

  $('table').each((_indice, tabla) => {
    const filas = $(tabla).find('tr');
    const cabeceras = filas.first().find('th, td').toArray().map((celda) => texto($(celda)).toUpperCase());
    const indiceEquipo = indiceCabecera(cabeceras, [/TEAM|EQUIPO/]);
    const indicePuntos = indiceCabecera(cabeceras, [/^PTS?$|POINTS|PUNTOS/]);
    const indiceGF = indiceCabecera(cabeceras, [/^GF$|GOALS FOR|FAVOR/]);
    const indiceGC = indiceCabecera(cabeceras, [/^GC$|GOALS AGAINST|CONTRA/]);
    const indicePJ = indiceCabecera(cabeceras, [/^PJ$|PLAYED|JUG/]);
    if (indiceEquipo < 0 || indicePuntos < 0 || indiceGF < 0 || indiceGC < 0) return;

    filas.slice(1).each((filaIndice, fila) => {
      const celdas = $(fila).find('th, td').toArray().map((celda) => texto($(celda)));
      const equipo = celdas[indiceEquipo]?.trim();
      const puntos = numero(celdas[indicePuntos] ?? '');
      const golesFavor = numero(celdas[indiceGF] ?? '');
      const golesContra = numero(celdas[indiceGC] ?? '');
      if (!equipo || puntos === null || golesFavor === null || golesContra === null) return;
      const filaResultado = filaBase(
        numero(celdas[0] ?? '') ?? resultados.length + 1,
        equipo,
        puntos,
        numero(celdas[indicePJ] ?? '') ?? 0,
        golesFavor,
        golesContra,
        golesFavor - golesContra
      );
      filaResultado.forma = extraerForma(celdas);
      resultados.push(filaResultado);
    });
  });

  if (!resultados.length) agregarTablaSeparada($, resultados);
  const unicos = [...new Map(resultados.map((fila) => [fila.equipo, fila])).values()];
  if (!unicos.length) throw new Error('ESPN no devolvió una tabla de posiciones compatible.');
  await enriquecerMetricasAvanzadas(unicos);
  await enriquecerFormaDesdeCalendario(unicos);
  return unicos.sort((a, b) => a.posicion - b.posicion);
}

function normalizarEquipo(nombre: string): string {
  return nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/fc | club | cf | de /g, '').replace(/[^a-z0-9]/g, '');
}

async function enriquecerMetricasAvanzadas(tabla: PosicionRaspada[]) {
  try {
    const $ = await descargarHtml(process.env.LIGA_MX_XG_URL ?? URL_FBREF_POR_DEFECTO);
    const avanzadas = new Map<string, Partial<PosicionRaspada>>();
    const procesarTablaAvanzada = (tablaHtml: cheerio.Cheerio<AnyNode>) => {
      const filas = $(tablaHtml).find('tr');
      const cabeceras = filas.filter(':first-child').find('th, td').toArray().map((celda) => texto($(celda)).toUpperCase());
      const indiceEquipo = indiceCabecera(cabeceras, [/SQUAD|TEAM|EQUIPO/]);
      const indiceXG = indiceCabecera(cabeceras, [/^XG$|EXPECTED GOALS/]);
      const indicePosesion = indiceCabecera(cabeceras, [/^POSS$|POSSESSION/]);
      const indiceTiros = indiceCabecera(cabeceras, [/SOT|SHOTS ON TARGET|TIROS.*PUERTA/]);
      if (indiceEquipo < 0 || (indiceXG < 0 && indicePosesion < 0 && indiceTiros < 0)) return;
      filas.slice(1).each((_filaIndice, fila) => {
        const celdas = $(fila).find('th, td').toArray().map((celda) => texto($(celda)));
        const equipo = celdas[indiceEquipo];
        if (!equipo) return;
        const metrica: Partial<PosicionRaspada> = {};
        if (indiceXG >= 0) metrica.xG = numero(celdas[indiceXG] ?? '');
        if (indicePosesion >= 0) metrica.posesion = numero(celdas[indicePosesion] ?? '');
        if (indiceTiros >= 0) metrica.tirosAPuerta = numero(celdas[indiceTiros] ?? '');
        const indiceCorners = indiceCabecera(cabeceras, [/CORNERS|CORNER|TIROS DE ESQUINA/]);
        const indiceRemates = indiceCabecera(cabeceras, [/SHOTS|REMATES|DISPAROS/]);
        if (indiceCorners >= 0) metrica.promedioCorners = numero(celdas[indiceCorners] ?? '');
        if (indiceRemates >= 0) metrica.promedioRemates = numero(celdas[indiceRemates] ?? '');
        avanzadas.set(normalizarEquipo(equipo), { ...avanzadas.get(normalizarEquipo(equipo)), ...metrica });
      });
      filas.filter(':not(:first-child)').each((_filaIndice, fila) => {
        const equipo = $(fila).find('[data-stat="team"], [data-stat="squad"]').first().text().trim();
        if (!equipo) return;
        const metrica: Partial<PosicionRaspada> = {};
        const valor = (estadisticas: string[]) => {
          const celda = estadisticas.map((estadistica) => $(fila).find(`[data-stat="${estadistica}"]`).first().text().trim()).find(Boolean);
          return celda ? numero(celda) : null;
        };
        metrica.xG = valor(['xg']);
        metrica.posesion = valor(['poss']);
        metrica.tirosAPuerta = valor(['sot', 'shots_on_target']);
        metrica.promedioCorners = valor(['corner_kicks', 'corners']);
        metrica.promedioRemates = valor(['shots', 'total_shots']);
        if (metrica.xG !== null || metrica.posesion !== null || metrica.tirosAPuerta !== null) {
          avanzadas.set(normalizarEquipo(equipo), { ...avanzadas.get(normalizarEquipo(equipo)), ...metrica });
        }
      });
    };
    $('table').each((_indice, tablaHtml) => procesarTablaAvanzada($(tablaHtml)));
    $('body').contents().filter((_indice, nodo) => nodo.type === 'comment').each((_indice, comentario) => {
      const contenido = $(comentario).text();
      if (/<table[\s>]/i.test(contenido)) {
        const documentoComentario = cheerio.load(contenido);
        documentoComentario('table').each((_indiceTabla, tablaHtml) => procesarTablaAvanzada(documentoComentario(tablaHtml) as cheerio.Cheerio<AnyNode>));
      }
    });
    for (const fila of tabla) {
      const metrica = avanzadas.get(normalizarEquipo(fila.equipo));
      if (metrica) Object.assign(fila, metrica);
    }
  } catch (error) {
    console.warn('No se pudieron obtener métricas avanzadas de FBref; se conservan como null:', error instanceof Error ? error.message : error);
  }
}

function estadoDesdeTexto(valor: string): PartidoRaspado['estado'] {
  const normalizado = valor.toLowerCase();
  if (/live|en vivo|en directo|half|medio tiempo/.test(normalizado)) return 'en_vivo';
  if (/final|terminado|ft/.test(normalizado)) return 'finalizado';
  return 'programado';
}

function minutoDesdeTexto(valor: string): number | null {
  const coincidencia = valor.match(/\b(\d{1,3})(?:\+\d{1,2})?\s*(?:['′]|min(?:uto)?s?\b)/i);
  if (!coincidencia) return null;
  return Math.min(90, Number(coincidencia[1]));
}

function marcadorDesdeElemento($: cheerio.CheerioAPI, elemento: AnyNode): { local: number | null; visitante: number | null } {
  const nodo = $(elemento);
  const marcadores = nodo.find('.ScoreCell__Score, .ScoreboardScoreCell__Score, [class*="Score"]').toArray()
    .map((marcador) => numero(texto($(marcador))))
    .filter((marcador): marcador is number => marcador !== null);
  return { local: marcadores[0] ?? null, visitante: marcadores[1] ?? null };
}

function fechaDesdeElemento($: cheerio.CheerioAPI, elemento: AnyNode): Date | null {
  const nodo = $(elemento);
  const valor = nodo.attr('data-date') ?? nodo.find('time').attr('datetime') ?? nodo.find('time').attr('data-date');
  if (valor) {
    const fecha = new Date(valor);
    if (!Number.isNaN(fecha.getTime())) return fecha;
  }
  const fechaEnTexto = texto(nodo).match(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/);
  if (!fechaEnTexto) return null;
  const [dia, mes, anio = '2026'] = fechaEnTexto[0].split(/[/-]/);
  const fecha = new Date(Number(anio.length === 2 ? `20${anio}` : anio), Number(mes) - 1, Number(dia));
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function fechaEnEspanol(valor: string): Date | null {
  const meses: Record<string, number> = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
  };
  const coincidencia = valor.toLowerCase().match(/(\d{1,2})\s+de\s+([a-záéíóú]+),\s+(\d{4})/);
  if (!coincidencia || meses[coincidencia[2]] === undefined) return null;
  return new Date(Number(coincidencia[3]), meses[coincidencia[2]], Number(coincidencia[1]));
}

function combinarFechaHora(fecha: Date, hora: string): Date {
  const coincidencia = hora.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!coincidencia) return fecha;
  let horas = Number(coincidencia[1]);
  if (coincidencia[3]?.toUpperCase() === 'PM' && horas < 12) horas += 12;
  if (coincidencia[3]?.toUpperCase() === 'AM' && horas === 12) horas = 0;
  fecha.setHours(horas, Number(coincidencia[2]), 0, 0);
  return fecha;
}

function normalizarNombre(nombre: string): string {
  return nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function nombresAlternativos(equipo: string): string[] {
  const nombre = normalizarNombre(equipo);
  const alias: Record<string, string[]> = {
    monterrey: ['mty', 'rayados'],
    atlante: ['atl'],
    atlas: ['ats'],
    tijuana: ['xolos', 'tij'],
    toluca: ['tolu'],
    cruzazul: ['caz', 'cruz'],
    queretaro: ['qro'],
    guadalajara: ['chivas', 'gua'],
    pumas: ['unam', 'pum'],
    america: ['ame'],
    leon: ['leo'],
    necaxa: ['nec'],
    pachuca: ['pac'],
    puebla: ['pue'],
    santoslaguna: ['santos', 'san'],
    juarez: ['jua'],
    tigres: ['tig'],
    mas: ['maz']
  };
  return [nombre, ...(alias[nombre] ?? [])];
}

function cuotaAmericanaADecimal(valor: string): number | null {
  const numeroAmericano = Number(valor);
  if (!Number.isFinite(numeroAmericano) || numeroAmericano === 0) return null;
  return numeroAmericano > 0 ? 1 + numeroAmericano / 100 : 1 + 100 / Math.abs(numeroAmericano);
}

function extraerCuotas($: cheerio.CheerioAPI, fila: AnyNode, local: string, visitante: string) {
  const textoCuotas = texto($(fila).find('.odds__col, .Odds__HomeAwayOdds'));
  const encontrados = [...textoCuotas.matchAll(/([^:|]+):\s*([+-]\d{2,4})/g)]
    .map((coincidencia) => ({ etiqueta: coincidencia[1].trim(), cuota: cuotaAmericanaADecimal(coincidencia[2]) }))
    .filter((cuota): cuota is { etiqueta: string; cuota: number } => cuota.cuota !== null);
  const coincideEquipo = (equipo: string, etiqueta: string) => {
    const etiquetaNormalizada = normalizarNombre(etiqueta);
    return nombresAlternativos(equipo).some((alias) => alias === etiquetaNormalizada || alias.includes(etiquetaNormalizada) || etiquetaNormalizada.includes(alias));
  };
  const cuotaLocal = encontrados.find((cuota) => coincideEquipo(local, cuota.etiqueta))?.cuota;
  const cuotaVisitante = encontrados.find((cuota) => coincideEquipo(visitante, cuota.etiqueta))?.cuota;
  return [
    { casa: 'ESPN/mercado publicado', mercado: '1X2', seleccion: 'local' as const, cuota: cuotaLocal ?? 1.0 },
    { casa: 'ESPN/mercado publicado', mercado: '1X2', seleccion: 'empate' as const, cuota: 1.0 },
    { casa: 'ESPN/mercado publicado', mercado: '1X2', seleccion: 'visitante' as const, cuota: cuotaVisitante ?? 1.0 }
  ];
}

async function extraerSeguimientoDetalle(url: string, local: string, visitante: string): Promise<Pick<PartidoRaspado, 'estado' | 'minuto' | 'marcador' | 'ausencias'>> {
  const $ = await descargarHtml(url);
  const html = $.html();
  const estadoJson = html.match(/"statusState":"(pre|in|post)"/)?.[1];
  const textoEstado = html.match(/"statusPrimary":"([^"]+)"/)?.[1] ?? texto($('body'));
  const estado = estadoJson === 'in'
    ? 'en_vivo'
    : estadoJson === 'post' || /final|terminado|ft/i.test(textoEstado)
      ? 'finalizado'
      : estadoDesdeTexto(textoEstado);
  const minutoCoincidencia = html.match(/"statusPrimary":"(\d{1,3})(?:\+\d{1,2})?['′]?"/);
  const minutoTexto = minutoCoincidencia ? Number(minutoCoincidencia[1]) : minutoDesdeTexto(textoEstado);
  const scores = [...html.matchAll(/"score":"(\d+)"/g)].map((coincidencia) => Number(coincidencia[1])).slice(0, 2);
  const bloquesBajas = $('[class*="injur"], [class*="absence"], [class*="suspens"], [data-testid*="injur"], [data-testid*="absence"]').toArray();
  const ausencias = { local: [] as string[], visitante: [] as string[] };
  for (const bloque of bloquesBajas) {
    const contenido = texto($(bloque));
    if (!/(lesion|baja|suspens|ausen)/i.test(contenido)) continue;
    const nombres = contenido.split(/\s*[•|]\s*|\n/).map((nombre) => nombre.trim()).filter((nombre) => nombre.length > 2);
    const destino = new RegExp(normalizarNombre(local), 'i').test(normalizarNombre(contenido))
      ? ausencias.local
      : new RegExp(normalizarNombre(visitante), 'i').test(normalizarNombre(contenido)) ? ausencias.visitante : null;
    if (destino) destino.push(...nombres.filter((nombre) => !/(lesion|baja|suspens|ausen)/i.test(nombre)));
  }
  return {
    estado,
    minuto: estado === 'en_vivo' ? (typeof minutoTexto === 'number' ? Math.min(90, minutoTexto) : null) : estado === 'finalizado' ? 90 : null,
    marcador: scores.length >= 2 ? { local: scores[0], visitante: scores[1] } : null,
    ausencias: { local: [...new Set(ausencias.local)], visitante: [...new Set(ausencias.visitante)] }
  };
}

export async function rasparCalendario(): Promise<PartidoRaspado[]> {
  const $ = await descargarHtml(process.env.LIGA_MX_CALENDARIO_URL ?? URL_CALENDARIO_POR_DEFECTO);
  const partidos: PartidoRaspado[] = [];
  const enlacesDetalle: Array<{ partido: PartidoRaspado; enlace: string }> = [];
  $('.ScheduleTables').each((_indiceJornada, contenedorJornada) => {
    $(contenedorJornada).find('.Table__Title').each((_indiceFecha, titulo) => {
      const fechaBase = fechaEnEspanol(texto($(titulo)));
      const tabla = $(titulo).closest('.ResponsiveTable');
      if (!fechaBase) return;
      tabla.find('tbody tr').each((filaIndice, fila) => {
      const equipos = $(fila).find('.Table__Team a[href*="/futbol/equipo/"]').toArray()
        .map((equipo) => texto($(equipo))).filter(Boolean);
      const unicos = [...new Set(equipos)];
      if (unicos.length < 2) return;
      const hora = texto($(fila).find('.date__col'));
      const fecha = combinarFechaHora(new Date(fechaBase), hora);
      const enlace = $(fila).find('a[href*="/futbol/partido/"]').first().attr('href') ?? '';
      const externoId = enlace.match(/juegoId\/(\d+)/)?.[1] ?? `espn-${fecha.getTime()}-${filaIndice}`;
      const contenido = texto($(fila));
      const marcador = marcadorDesdeElemento($, fila);
      const partido: PartidoRaspado = {
        externoId,
        fecha: fecha.toISOString(),
        jornada: Number(contenido.match(/(?:jornada|fecha|week)\s*(\d+)/i)?.[1] ?? 0),
        estado: estadoDesdeTexto(contenido),
        minuto: minutoDesdeTexto(contenido),
        local: unicos[1],
        visitante: unicos[0],
        golesLocal: marcador?.local ?? null,
        golesVisitante: marcador?.visitante ?? null,
        marcador: null,
        ausencias: { local: [], visitante: [] },
        cuotas: extraerCuotas($, fila, unicos[1], unicos[0])
      };
        partidos.push(partido);
        if (enlace && (partido.estado !== 'programado' || fecha.getTime() < Date.now() - 2 * 60 * 60 * 1000)) enlacesDetalle.push({ partido, enlace });
      });
    });
  });

  for (const { partido, enlace } of enlacesDetalle) {
    try {
      const seguimiento = await extraerSeguimientoDetalle(new URL(enlace, 'https://www.espn.com.mx').toString(), partido.local, partido.visitante);
      Object.assign(partido, seguimiento, {
        golesLocal: seguimiento.marcador?.local ?? null,
        golesVisitante: seguimiento.marcador?.visitante ?? null
      });
    } catch (error) {
      console.warn(`No se pudo actualizar el marcador en vivo de ${partido.local} vs ${partido.visitante}:`, error instanceof Error ? error.message : error);
    }
  }

  const candidatos = $('.Schedule__Game, [data-date].Scoreboard, [data-date].Schedule__Game, article')
    .filter((_indice, elemento) => !$(elemento).closest('.ScheduleTables').length)
    .toArray();

  for (const [indice, elemento] of candidatos.entries()) {
    const nodo = $(elemento);
    const equipos = nodo.find('.ScoreCell__TeamName, .ScoreboardScoreCell__TeamName, [class*="TeamName"]').toArray()
      .map((equipo) => texto($(equipo))).filter(Boolean);
    const unicos = [...new Set(equipos)];
    if (unicos.length < 2) continue;
    const fecha = fechaDesdeElemento($, elemento);
    if (!fecha) continue;
    const contenido = texto(nodo);
    const marcador = marcadorDesdeElemento($, elemento);
    const ronda = contenido.match(/(?:jornada|fecha|week)\s*(\d+)/i);
    const externoId = nodo.attr('data-id') ?? nodo.attr('id') ?? `espn-${fecha.getTime()}-${indice}`;
    partidos.push({
      externoId,
      fecha: fecha.toISOString(),
      jornada: ronda ? Number(ronda[1]) : 0,
      estado: estadoDesdeTexto(contenido),
      minuto: minutoDesdeTexto(contenido),
      local: unicos[0],
      visitante: unicos[1],
      golesLocal: marcador.local,
      golesVisitante: marcador.visitante,
      marcador: marcador.local !== null && marcador.visitante !== null
        ? { local: marcador.local, visitante: marcador.visitante }
        : null,
      cuotas: [
        { casa: 'ESPN/mercado publicado', mercado: '1X2', seleccion: 'local', cuota: 1.0 },
        { casa: 'ESPN/mercado publicado', mercado: '1X2', seleccion: 'empate', cuota: 1.0 },
        { casa: 'ESPN/mercado publicado', mercado: '1X2', seleccion: 'visitante', cuota: 1.0 }
      ],
      ausencias: { local: [], visitante: [] }
    });
  }

  if (!partidos.length) throw new Error('ESPN no devolvió partidos compatibles en su calendario.');
  const unicos = [...new Map(partidos.map((partido) => [partido.externoId, partido])).values()]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((partido) => {
      if (partido.estado === 'programado' && new Date(partido.fecha).getTime() < Date.now() - 2 * 60 * 60 * 1000) {
        return { ...partido, estado: 'finalizado' as const, minuto: 90 };
      }
      return partido;
    });
  console.log('Equipos extraídos del calendario Liga MX:', unicos.flatMap((partido) => [partido.local, partido.visitante]));
  return unicos;
}
