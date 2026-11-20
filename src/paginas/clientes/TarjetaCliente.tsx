import { Link } from 'react-router';
import { ChevronRight, Clock, Mail, Phone } from 'lucide-react';
import type { Cliente } from './clientes';
import { fechaHoraMexico, iniciales } from './clientes';

// Tarjeta del directorio: el nombre es el enlace principal y se extiende a toda la tarjeta;
// teléfono y correo quedan por encima para seguir siendo enlaces propios (tel: y mailto:).
export function TarjetaCliente({ cliente }: { cliente: Cliente }) {
  const nombre = cliente.nombre || 'Cliente sin nombre';
  return <article className="panel-item clientes-tarjeta">
    <div className="clientes-tarjeta-identidad">
      <div className="clientes-avatar" aria-hidden="true">{iniciales(cliente.nombre)}</div>
      <div className="clientes-info">
        <h3 className="clientes-nombre"><Link to={`/clientes/${encodeURIComponent(cliente.clienteUid)}`}>{nombre}</Link></h3>
        {(cliente.telefono || cliente.correo) && <div className="clientes-contacto">
          {cliente.telefono && <a className="clientes-dato-linea" href={`tel:${cliente.telefono}`}><Phone aria-hidden="true" />{cliente.telefono}</a>}
          {cliente.correo && <a className="clientes-dato-linea" href={`mailto:${cliente.correo}`}><Mail aria-hidden="true" />{cliente.correo}</a>}
        </div>}
        <span className="clientes-ultima-visita"><Clock aria-hidden="true" />Última visita: {fechaHoraMexico(cliente.ultimaReserva)}</span>
      </div>
    </div>
    <div className="clientes-derecha">
      <dl className="clientes-kpis" aria-label={`Resumen de reservas de ${nombre}`}>
        <div className="clientes-kpi"><dt>Reservas</dt><dd>{cliente.totalReservas}</dd></div>
        <div className="clientes-kpi clientes-kpi--exito"><dt>Completadas</dt><dd>{cliente.completadas}</dd></div>
        <div className={`clientes-kpi${cliente.canceladas > 0 ? ' clientes-kpi--peligro' : ''}`}><dt>Canceladas</dt><dd>{cliente.canceladas}</dd></div>
      </dl>
      <span className="clientes-flecha" aria-hidden="true"><ChevronRight /></span>
    </div>
  </article>;
}
