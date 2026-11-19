// src/paginas/reservas/estados.ts
export const ESTADOS_CONFIG: Record<string, { label: string; className: string }> = {
  pendiente: { label: 'Pendiente', className: 'pendiente' },
  confirmada: { label: 'Confirmada', className: 'confirmada' },
  cancelada: { label: 'Cancelada', className: 'cancelada' },
  completada: { label: 'Completada', className: 'completada' },
  rechazada: { label: 'Rechazada', className: 'rechazada' },
  rechazada_vencimiento: { label: 'Rechazada por vencimiento', className: 'rechazada_vencimiento' },
};

export const formatearFecha = (fechaISO: string) => {
  if (!fechaISO) return '';
  return new Date(fechaISO).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatearHora = (fechaISO: string) => {
  if (!fechaISO) return '';
  return new Date(fechaISO).toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' });
};

export const calcularTiempoRestante = (segundos: number | null) => {
  if (segundos === null) return '';
  if (segundos <= 0) return 'Vencida';
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  if (horas > 0) return `${horas}h ${minutos}m restantes`;
  return `${minutos}m restantes`;
};