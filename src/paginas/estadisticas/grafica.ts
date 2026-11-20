// Cálculos de la gráfica de reservas por día. Solo organizan lo que la API ya contó.
export interface DiaReservas { fecha: string; reservas: number }

/** Hasta cuántas etiquetas de fecha caben en el eje sin encimarse, incluso a 375 px. */
export const MAX_ETIQUETAS = 7;
/** Hasta cuántas barras llevan su valor encima; con más, solo el pico. */
export const MAX_VALORES = 14;
/** Con más días que esto las barras se juntan (sin separación) para seguir siendo legibles. */
export const MAX_DIAS_SEPARADOS = 31;

export const etiquetaCorta = (fecha: string) => fecha.split('-').reverse().slice(0, 2).join('/');

/** Techo de la escala: el máximo de reservas de un día (nunca menos de 1, para no dividir entre 0). */
export const techoEscala = (porDia: DiaReservas[]) => Math.max(1, ...porDia.map((dia) => dia.reservas));

/** Valores del eje vertical, de arriba abajo: hasta 3 reservas cada una; después cuartos redondeados. */
export function marcasEje(techo: number): number[] {
  if (techo <= 3) return Array.from({ length: techo + 1 }, (_, i) => techo - i);
  return [techo, Math.round(techo * 2 / 3), Math.round(techo / 3), 0];
}

/** Índices de los días que llevan etiqueta en el eje horizontal, repartidos de forma pareja con primero y último. */
export function indicesEtiquetas(dias: number, maximo = MAX_ETIQUETAS): number[] {
  if (dias <= maximo) return Array.from({ length: dias }, (_, i) => i);
  return Array.from({ length: maximo }, (_, i) => Math.round(i * (dias - 1) / (maximo - 1)));
}

/** Índice del primer día con más reservas, o -1 si ningún día tiene. */
export function indicePico(porDia: DiaReservas[]) {
  const mejor = Math.max(0, ...porDia.map((dia) => dia.reservas));
  return mejor > 0 ? porDia.findIndex((dia) => dia.reservas === mejor) : -1;
}

/** Reservas por día sobre los días que muestra la gráfica, con un decimal. */
export const promedioDiario = (porDia: DiaReservas[]) =>
  porDia.length ? Math.round(porDia.reduce((suma, dia) => suma + dia.reservas, 0) / porDia.length * 10) / 10 : 0;

/** Porcentaje entero del total que representa una cantidad; 0 si el total es 0. */
export const porcentaje = (cantidad: number, total: number) => total > 0 ? Math.min(100, Math.round(cantidad / total * 100)) : 0;
