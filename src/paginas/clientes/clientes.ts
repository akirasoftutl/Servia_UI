// Contrato de Servia_BE#90: totales y estado efectivo calculados por la API (T14, RN-48).
export interface Cliente {
  clienteUid: string;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  totalReservas: number;
  completadas: number;
  canceladas: number;
  ultimaReserva: string;
}
export interface PaginaClientes { items: Cliente[]; siguiente: string | null }
export interface ReservaCliente {
  id: string;
  folio: string;
  servicioNombre: string;
  inicio: string;
  fin: string;
  estado: string;
  motivo: string | null;
}
export interface HistorialCliente { cliente: Cliente; items: ReservaCliente[]; siguiente: string | null }
const zonaHoraria = 'America/Mexico_City';
export const fechaMexico = new Intl.DateTimeFormat('es-MX', { timeZone: zonaHoraria, dateStyle: 'short' });
export const horaMexico = new Intl.DateTimeFormat('es-MX', { timeZone: zonaHoraria, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function fechaHoraMexico(valor: string) {
  return `${fechaMexico.format(new Date(valor))} a las ${horaMexico.format(new Date(valor))}`;
}
const diaCorto = new Intl.DateTimeFormat('es-MX', { timeZone: zonaHoraria, day: '2-digit', month: 'short' });
const diaMedio = new Intl.DateTimeFormat('es-MX', { timeZone: zonaHoraria, dateStyle: 'medium' });
const diaLargo = new Intl.DateTimeFormat('es-MX', { timeZone: zonaHoraria, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
// «04 nov», «3 nov 2030» y «domingo, 3 de noviembre de 2030», siempre en hora de México.
export const diaCortoMexico = (valor: string) => diaCorto.format(new Date(valor)).replace(/[.-]/g, ' ').replace(/\s+/g, ' ').trim();
export const diaMedioMexico = (valor: string) => diaMedio.format(new Date(valor)).replace('.', '');
export const diaLargoMexico = (valor: string) => diaLargo.format(new Date(valor));

// Iniciales del avatar: primera y última palabra del nombre; una sola si solo hay una.
export function iniciales(nombre: string) {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean).map((palabra) => Array.from(palabra)[0]);
  if (!palabras.length) return '?';
  return (palabras.length === 1 ? palabras[0] : palabras[0] + palabras[palabras.length - 1]).toLocaleUpperCase('es-MX');
}
