import { CalendarDays, CircleCheck, CircleX, Clock, Mail, Phone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Cliente } from './clientes';
import { diaMedioMexico, horaMexico, iniciales } from './clientes';

function Indicador({ etiqueta, valor, icono: Icono, tono, nota, fecha }: {
  etiqueta: string; valor: string | number; icono: LucideIcon; tono?: 'exito' | 'peligro' | 'info'; nota?: string; fecha?: boolean;
}) {
  return <div className={`cliente-stat${fecha ? ' cliente-stat--fecha' : ''}`}>
    <div className="cliente-stat-cabecera">
      <dt>{etiqueta}</dt>
      <span className={`cliente-stat-icono${tono ? ` cliente-stat-icono--${tono}` : ''}`} aria-hidden="true"><Icono /></span>
    </div>
    <dd>{valor}</dd>
    {nota && <span className="cliente-stat-sub">{nota}</span>}
  </div>;
}

// Ficha superior del detalle: avatar, contacto y cuatro indicadores. Las cifras llegan de la API.
export function FichaCliente({ cliente }: { cliente: Cliente }) {
  return <>
    <div className="cliente-perfil-cabecera">
      <div className="cliente-perfil-identidad">
        <div className="cliente-perfil-avatar" aria-hidden="true">{iniciales(cliente.nombre)}</div>
        <div>
          <h2 className="cliente-perfil-nombre">{cliente.nombre || 'Cliente sin nombre'}</h2>
          <p className="panel-tarjeta-subtitulo">Cliente de tu negocio</p>
        </div>
      </div>
      {(cliente.telefono || cliente.correo) && <div className="cliente-perfil-contacto">
        {cliente.telefono && <a className="cliente-contacto-chip" href={`tel:${cliente.telefono}`}><Phone aria-hidden="true" />{cliente.telefono}</a>}
        {cliente.correo && <a className="cliente-contacto-chip" href={`mailto:${cliente.correo}`}><Mail aria-hidden="true" />{cliente.correo}</a>}
      </div>}
    </div>
    <dl className="cliente-resumen-grid" aria-label="Indicadores del cliente">
      <Indicador etiqueta="Total de reservas" valor={cliente.totalReservas} icono={CalendarDays} nota="Historial acumulado" />
      <Indicador etiqueta="Completadas" valor={cliente.completadas} icono={CircleCheck} tono="exito" />
      <Indicador etiqueta="Canceladas" valor={cliente.canceladas} icono={CircleX} tono="peligro" />
      <Indicador etiqueta="Última visita" valor={diaMedioMexico(cliente.ultimaReserva)} icono={Clock} tono="info" fecha
        nota={`A las ${horaMexico.format(new Date(cliente.ultimaReserva))} h`} />
    </dl>
  </>;
}
