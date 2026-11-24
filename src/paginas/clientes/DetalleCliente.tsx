import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api, ErrorApi } from '../../servicios/api';
import { mensajeDeError } from '../../servicios/mensajeDeError';
import { ESTADOS_CONFIG } from '../reservas/estados';
import { diaCortoMexico, diaLargoMexico, horaMexico, type HistorialCliente, type ReservaCliente } from './clientes';
import { FichaCliente } from './FichaCliente';
import { EstadoClientes } from './EstadoClientes';
import '../reservas/Reservas.css';
import './Clientes.css';
import { ArrowLeft, ChevronRight, Users } from 'lucide-react';
import { EncabezadoPanel } from '../../componentes/panel/EncabezadoPanel';
import { TarjetaPanel } from '../../componentes/panel/TarjetaPanel';
import { BotonPanel } from '../../componentes/panel/BotonPanel';
import { EtiquetaEstado } from '../../componentes/panel/EtiquetaEstado';

// La clave reinicia el historial al navegar a otro cliente sin desmontar la ruta.
export function DetalleCliente() {
  const { clienteUid = '' } = useParams();
  return <Historial key={clienteUid} clienteUid={clienteUid} />;
}

function Historial({ clienteUid }: { clienteUid: string }) {
  const [datos, setDatos] = useState<HistorialCliente | null>(null);
  const [cursor, setCursor] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let vigente = true;
    const parametros = new URLSearchParams();
    if (cursor) parametros.set('cursor', cursor);
    // RN-46: la API determina el negocio por la sesión; no recibimos un negocioId del router.
    api<HistorialCliente>(`/negocios/mio/clientes/${encodeURIComponent(clienteUid)}/reservas?${parametros}`)
      .then((respuesta) => {
        if (vigente) setDatos((anterior) => ({ ...respuesta, items: cursor && anterior ? [...anterior.items, ...respuesta.items] : respuesta.items }));
      })
      .catch((fallo: unknown) => {
        if (vigente) setError(fallo instanceof ErrorApi && fallo.estado === 404
          ? 'No encontramos a este cliente en tu negocio.' : mensajeDeError(fallo, 'No pudimos cargar el historial. Intenta de nuevo.'));
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [clienteUid, cursor, revision]);

  return <div className="panel-pagina"><div className="panel-contenedor">
    <EncabezadoPanel
      grupo="operacion"
      icono={Users}
      titulo="Detalle del cliente"
      subtitulo="Su historial de reservas con tu negocio."
      acciones={<BotonPanel variante="secundario" tamano="sm" className="clientes-volver" to="/clientes"><ArrowLeft aria-hidden="true" />Volver a clientes</BotonPanel>}
    />
    {datos && <TarjetaPanel ariaLabel="Datos del cliente">
      <FichaCliente cliente={datos.cliente} />
    </TarjetaPanel>}
    <TarjetaPanel
      ariaLabel="Historial de reservas"
      titulo="Historial de reservas"
      subtitulo="De la reserva más reciente a la más antigua."
      derecha={datos && datos.items.length > 0 ? <span className="panel-contador">{datos.items.length}{datos.siguiente ? '+' : ''} {datos.items.length === 1 && !datos.siguiente ? 'reserva' : 'reservas'}</span> : undefined}
    >
      <div aria-busy={cargando}>
        <EstadoClientes carga="historial" titulo="Sin reservas todavía" cargando={cargando} error={error} vacio={datos && !datos.items.length ? 'No hay reservas en este historial.' : ''}
          reintentar={() => { setCargando(true); setError(''); setRevision((r) => r + 1); }} />
        <div className="panel-lista">
          {datos?.items.map((reserva) => <ItemReserva reserva={reserva} key={reserva.id} />)}
        </div>
        {!cargando && !error && datos?.siguiente && <BotonPanel variante="secundario" tamano="sm" className="clientes-mas" onClick={() => {
          setCursor(datos.siguiente!); setCargando(true); setError('');
        }}>Cargar más</BotonPanel>}
      </div>
    </TarjetaPanel>
  </div></div>;
}

function ItemReserva({ reserva }: { reserva: ReservaCliente }) {
  const estado = ESTADOS_CONFIG[reserva.estado];
  const minutos = Math.round((new Date(reserva.fin).getTime() - new Date(reserva.inicio).getTime()) / 60000);
  return <article className="panel-item cliente-reserva-item">
    <div className="cliente-reserva-principal">
      <div className="cliente-reserva-fecha">
        <span className="cliente-reserva-dia">{diaCortoMexico(reserva.inicio)}</span>
        <span className="cliente-reserva-hora">{horaMexico.format(new Date(reserva.inicio))} – {horaMexico.format(new Date(reserva.fin))}</span>
      </div>
      <div className="cliente-reserva-info">
        <h3 className="cliente-reserva-titulo-fila">
          <Link className="cliente-reserva-servicio" to={`/reservas/${encodeURIComponent(reserva.id)}`} aria-label={`${reserva.servicioNombre} · ${reserva.folio}`}>
            {reserva.servicioNombre}<span className="cliente-reserva-folio">{reserva.folio}</span>
          </Link>
        </h3>
        <p className="panel-item-texto">{diaLargoMexico(reserva.inicio)}{minutos > 0 ? ` · ${minutos} min` : ''}</p>
        {reserva.motivo && <p className="cliente-reserva-motivo">Motivo: {reserva.motivo}</p>}
      </div>
    </div>
    <div className="cliente-reserva-estado">
      <EtiquetaEstado
        texto={estado?.label ?? reserva.estado}
        tono={estado?.tono ?? 'neutro'}
        className={`reserva-badge ${estado?.className ?? ''}`.trim()}
      />
      <ChevronRight className="cliente-reserva-chevron" aria-hidden="true" />
    </div>
  </article>;
}
