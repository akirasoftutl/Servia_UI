import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api, ErrorApi } from '../../servicios/api';
import { ESTADOS_CONFIG } from '../reservas/estados';
import { fechaHoraMexico, horaMexico, type HistorialCliente } from './clientes';
import { DatosCliente } from './DatosCliente';
import { EstadoClientes } from './EstadoClientes';
import './Clientes.css';

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
          ? 'No encontramos a este cliente en tu negocio.' : 'No pudimos cargar el historial. Intenta de nuevo.');
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [clienteUid, cursor, revision]);

  return <div className="panel-pagina"><div className="panel-contenedor">
    <header className="panel-encabezado"><div>
      <span className="panel-eyebrow">PRINCIPAL</span>
      <h1 className="panel-titulo">Detalle del cliente</h1>
      <p className="panel-subtitulo">Su historial de reservas con tu negocio.</p>
    </div><Link className="btn-servia-secondary btn-servia-sm clientes-volver" to="/clientes">Volver a clientes</Link></header>
    {datos && <section className="panel-tarjeta" aria-label="Datos del cliente">
      <h2 className="panel-tarjeta-titulo">{datos.cliente.nombre || 'Cliente sin nombre'}</h2>
      <DatosCliente cliente={datos.cliente} />
    </section>}
    <section className="panel-tarjeta" aria-label="Historial de reservas">
      <h2 className="panel-tarjeta-titulo">Historial de reservas</h2>
      <div aria-busy={cargando}>
        <EstadoClientes carga="historial" cargando={cargando} error={error} vacio={datos && !datos.items.length ? 'No hay reservas en este historial.' : ''}
          reintentar={() => { setCargando(true); setError(''); setRevision((r) => r + 1); }} />
        <div className="panel-lista">
          {datos?.items.map((reserva) => <article className="panel-item clientes-item" key={reserva.id}>
            <h3 className="panel-item-titulo"><Link to={`/reservas/${encodeURIComponent(reserva.id)}`}>{reserva.servicioNombre} · {reserva.folio}</Link></h3>
            <div className="clientes-datos">
              <p className="panel-item-texto">{fechaHoraMexico(reserva.inicio)} a {horaMexico.format(new Date(reserva.fin))}</p>
              <p className="panel-item-texto">{ESTADOS_CONFIG[reserva.estado]?.label ?? reserva.estado}</p>
              {reserva.motivo && <p className="panel-item-texto">Motivo: {reserva.motivo}</p>}
            </div>
          </article>)}
        </div>
        {!cargando && !error && datos?.siguiente && <button className="btn-servia-secondary btn-servia-sm clientes-mas" onClick={() => {
          setCursor(datos.siguiente!); setCargando(true); setError('');
        }}>Cargar más</button>}
      </div>
    </section>
  </div></div>;
}
