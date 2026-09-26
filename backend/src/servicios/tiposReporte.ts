export type ApuestaAnalizada = {
  seleccion: string;
  cuota: number;
  valorEsperado: number;
};

export type PartidoAnalizado = {
  local: string;
  visitante: string;
  iteracionesMonteCarlo: number;
  probabilidades: {
    local: number;
    empate: number;
    visitante: number;
  };
  apuestas: ApuestaAnalizada[];
};
