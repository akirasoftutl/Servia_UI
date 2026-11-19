import type { Cliente } from './clientes';
import { fechaHoraMexico } from './clientes';

export function DatosCliente({ cliente }: { cliente: Cliente }) {
  return <div className="clientes-datos panel-item-texto">
    {cliente.telefono && <a href={`tel:${cliente.telefono}`}>{cliente.telefono}</a>}
    {cliente.correo && <a href={`mailto:${cliente.correo}`}>{cliente.correo}</a>}
    <p className="panel-item-texto">Total de reservas: {cliente.totalReservas} · Completadas: {cliente.completadas} · Canceladas: {cliente.canceladas}</p>
    <p className="panel-item-texto">Última reserva: {fechaHoraMexico(cliente.ultimaReserva)}</p>
  </div>;
}
