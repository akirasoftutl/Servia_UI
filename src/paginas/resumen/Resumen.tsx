import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../servicios/api';
import './Resumen.css';
import { LayoutDashboard } from 'lucide-react';
import { EyebrowPanel } from '../../componentes/panel/EyebrowPanel';

// Contrato de GET /negocios/mio/resumen (Servia_BE#89). Los números se calculan en la API
// (T14); aquí solo se muestran, sin recalcular.
interface ProximaCita {
  id: string;
  folio: string;
  clienteNombre: string;
  servicioNombre: string;
  inicio: string;
  fin: string;
}
interface DatosResumen {
  pendientes: number;
  hoy: number;
  proximos7Dias: number;
  serviciosPublicados: number;
  clientesAtendidos: number;
  proximas: ProximaCita[];
  generadoEn: string;
}
// El aviso de pausa y de visibilidad sale del perfil (D2), no del resumen.
interface PerfilAvisos { aceptaReservas?: boolean; visible?: boolean }

const zonaHoraria = 'America/Mexico_City';
const fecha = new Intl.DateTimeFormat('es-MX', { timeZone: zonaHoraria, dateStyle: 'short' });
const hora = new Intl.DateTimeFormat('es-MX', { timeZone: zonaHoraria, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

function esResumen(datos: unknown): datos is DatosResumen {
  const d = datos as DatosResumen | null;
  return !!d && typeof d.pendientes === 'number' && Array.isArray(d.proximas);
}

function Tarjeta({ numero, etiqueta, ruta }: { numero: number; etiqueta: string; ruta?: string }) {
  const contenido = <>
    <span className="resumen-numero">{numero}</span>
    <span className="resumen-etiqueta">{etiqueta}</span>
  </>;
  return (
    <li className="resumen-tarjeta">
      {ruta ? <Link to={ruta} className="resumen-tarjeta-cuerpo resumen-tarjeta-enlace">{contenido}</Link>
        : <div className="resumen-tarjeta-cuerpo">{contenido}</div>}
    </li>
  );
}

export function Resumen() {
  const [datos, setDatos] = useState<DatosResumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [perfil, setPerfil] = useState<PerfilAvisos | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let vigente = true;
    api<unknown>('/negocios/mio/resumen')
      .then((respuesta) => {
        if (!vigente) return;
        if (!esResumen(respuesta)) throw new Error('Respuesta inesperada');
        setDatos(respuesta);
      })
      .catch(() => {
        if (vigente) setError('No pudimos cargar el resumen. Intenta de nuevo.');
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    // En paralelo: si falla, el resumen se muestra igual, sin aviso.
    api<PerfilAvisos>('/negocios/mio')
      .then((respuesta) => { if (vigente) setPerfil(respuesta); })
      .catch(() => { if (vigente) setPerfil(null); });
    return () => { vigente = false; };
  }, [revision]);

  const reintentar = () => {
    setCargando(true);
    setError('');
    setRevision((r) => r + 1);
  };

  const sinReservas = !!datos && datos.pendientes === 0 && datos.hoy === 0 && datos.proximos7Dias === 0
    && datos.clientesAtendidos === 0 && datos.proximas.length === 0;

  return (
    <div className="panel-pagina"><div className="panel-contenedor">
      <header className="panel-encabezado">
        <div>
          <EyebrowPanel grupo="operacion" icono={LayoutDashboard} />
          <h1 className="panel-titulo">Resumen</h1>
          <p className="panel-subtitulo">La actividad de tu negocio de un vistazo.</p>
        </div>
      </header>

      {perfil?.aceptaReservas === false && (
        <div className="panel-alerta panel-alerta--aviso">
          <span className="panel-alerta-icono" aria-hidden="true">⏸</span>
          <div className="panel-alerta-contenido">
            <strong>Pausaste las reservas</strong>
            <p>Los clientes no pueden pedir reservas nuevas.</p>
          </div>
          <Link to="/reservas" className="btn-servia-secondary btn-servia-sm panel-alerta-accion">Reanudar en Reservas</Link>
        </div>
      )}

      {perfil?.visible === false && (
        <div className="panel-alerta panel-alerta--aviso">
          <span className="panel-alerta-icono" aria-hidden="true">!</span>
          <div className="panel-alerta-contenido">
            <strong>Tu negocio no aparece en las búsquedas.</strong>
            <p>Revisa tu perfil y tus servicios.</p>
          </div>
          <div className="resumen-alerta-acciones panel-alerta-accion">
            <Link to="/mi-perfil" className="btn-servia-secondary btn-servia-sm">Mi perfil</Link>
            <Link to="/servicios" className="btn-servia-secondary btn-servia-sm">Servicios</Link>
          </div>
        </div>
      )}

      <div aria-busy={cargando}>
        {cargando && <div className="panel-estado">
          <div className="spinner-border" aria-hidden="true" />
          <p className="panel-estado-texto" role="status">Cargando resumen...</p>
        </div>}

        {!cargando && error && <div className="panel-estado">
          <div className="panel-estado-icono panel-estado-icono--error" aria-hidden="true">!</div>
          <p className="panel-estado-texto" role="alert">{error}</p>
          <button className="btn-servia-primary" onClick={reintentar}>Reintentar</button>
        </div>}

        {!cargando && !error && datos && <>
          <ul className="resumen-tarjetas" aria-label="Números de tu negocio">
            <Tarjeta numero={datos.pendientes} etiqueta="Solicitudes pendientes" ruta="/reservas?estado=pendiente" />
            <Tarjeta numero={datos.hoy} etiqueta="Reservas de hoy" />
            <Tarjeta numero={datos.proximos7Dias} etiqueta="Próximos 7 días" />
            <Tarjeta numero={datos.clientesAtendidos} etiqueta="Clientes atendidos" />
            <Tarjeta numero={datos.serviciosPublicados} etiqueta="Servicios publicados" ruta="/servicios" />
          </ul>

          <section className="panel-tarjeta resumen-proximas" aria-labelledby="resumen-proximas-titulo">
            <h2 id="resumen-proximas-titulo" className="panel-tarjeta-titulo">Próximas citas</h2>
            {datos.proximas.length === 0 ? (
              <div className="panel-estado">
                <div className="panel-estado-icono" aria-hidden="true">✦</div>
                <p className="panel-estado-texto">
                  {sinReservas ? 'Todavía no tienes reservas.' : 'No tienes reservas próximas.'}
                </p>
              </div>
            ) : (
              <ul className="panel-lista resumen-lista">
                {datos.proximas.map((cita) => (
                  <li key={cita.id}>
                    <Link to={`/reservas/${cita.id}`} className="panel-item resumen-cita">
                      <span>
                        <span className="panel-item-titulo d-block">{cita.clienteNombre}</span>
                        <span className="panel-item-texto d-block">
                          {cita.servicioNombre} · {fecha.format(new Date(cita.inicio))} de {hora.format(new Date(cita.inicio))} a {hora.format(new Date(cita.fin))}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>}
      </div>
    </div></div>
  );
}
