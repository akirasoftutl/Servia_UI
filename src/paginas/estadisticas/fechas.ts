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
  if (!desde || !hasta) return 'Ingresa la fecha inicial y la fecha final.';
  const calendario = (valor: string) => /^\d{4}-\d{2}-\d{2}$/.test(valor) &&
    Number.isFinite(Date.parse(`${valor}T00:00:00Z`)) &&
    new Date(`${valor}T00:00:00Z`).toISOString().slice(0, 10) === valor;
  if (!calendario(desde) || !calendario(hasta)) return 'Ingresa fechas válidas con formato AAAA-MM-DD.';
  if (desde > hasta) return 'La fecha inicial no puede ser posterior a la fecha final.';
  if ((Date.parse(hasta) - Date.parse(desde)) / 86400000 + 1 > 366) return 'El periodo no puede pasar de 366 días.';
  return '';
}
