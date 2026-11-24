import { validarRangoFechas } from '../../utilidades/validacion';

export interface Periodo { desde: string; hasta: string }

export function periodoPredefinido(dias: number, ahora = new Date()): Periodo {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(ahora);
  const parte = (tipo: string) => partes.find(p => p.type === tipo)!.value;
  const hasta = `${parte('year')}-${parte('month')}-${parte('day')}`;
  const inicio = new Date(`${hasta}T00:00:00Z`);
  inicio.setUTCDate(inicio.getUTCDate() - dias + 1);
  return { desde: inicio.toISOString().slice(0, 10), hasta };
}

export function validarPeriodo({ desde, hasta }: Periodo): string {
  return validarRangoFechas(desde, hasta, { maxDias: 366 });
}
