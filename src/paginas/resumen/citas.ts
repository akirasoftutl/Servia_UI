const zonaHoraria = 'America/Mexico_City';
const diaClave = new Intl.DateTimeFormat('en-CA', { timeZone: zonaHoraria, year: 'numeric', month: '2-digit', day: '2-digit' });
const diaMes = new Intl.DateTimeFormat('es-MX', { timeZone: zonaHoraria, day: '2-digit', month: 'short' });
const diaSemana = new Intl.DateTimeFormat('es-MX', { timeZone: zonaHoraria, weekday: 'short' });

const dias = (valor: Date) => Date.parse(`${diaClave.format(valor)}T00:00:00Z`) / 86400000;

/** «Hoy · 20 nov», «Mañana · 21 nov» o «sáb · 22 nov», contado en días de México desde `referencia`. */
export function etiquetaDia(inicio: string, referencia: string) {
  const cita = new Date(inicio);
  const base = Number.isNaN(Date.parse(referencia)) ? new Date() : new Date(referencia);
  const fecha = diaMes.format(cita).replace(/[.-]/g, ' ').replace(/\s+/g, ' ').trim();
  const diferencia = dias(cita) - dias(base);
  if (diferencia === 0) return { texto: `Hoy · ${fecha}`, hoy: true };
  if (diferencia === 1) return { texto: `Mañana · ${fecha}`, hoy: false };
  return { texto: `${diaSemana.format(cita).replace('.', '')} · ${fecha}`, hoy: false };
}
