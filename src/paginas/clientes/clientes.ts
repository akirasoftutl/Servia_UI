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
