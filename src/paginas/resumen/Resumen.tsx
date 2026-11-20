import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Bell, CalendarCheck, CalendarClock, ChartColumn, ChevronRight, Clock, LayoutDashboard, Pause, Plus, Scissors, Users, type LucideIcon } from 'lucide-react';
import { EstadoVacio } from '../../componentes/panel/EstadosPanel';
import { api } from '../../servicios/api';
import { ESTADOS_CONFIG } from '../reservas/estados';
import { etiquetaDia } from './citas';
import '../reservas/Reservas.css';
import './Resumen.css';
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
  // Servia_BE#106: la API lo agregará. Solo «pendiente» lleva chip; «proximas» trae confirmadas, que no se marcan.
  estado?: string;
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
const hora = new Intl.DateTimeFormat('es-MX', { timeZone: zonaHoraria, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

function esResumen(datos: unknown): datos is DatosResumen {
  const d = datos as DatosResumen | null;
  return !!d && typeof d.pendientes === 'number' && Array.isArray(d.proximas);
}

type Tono = 'info' | 'exito' | 'aviso';

function Ficha({ icono: Icono, tono }: { icono: LucideIcon; tono?: Tono }) {
  return <span className={`resumen-icono-ficha resumen-icono-ficha--sm${tono ? ` resumen-icono-ficha--${tono}` : ''}`} aria-hidden="true"><Icono /></span>;
}

function Cifra({ numero, etiqueta, icono, tono, nota, ruta, accion }: {
  numero: number; etiqueta: string; icono: LucideIcon; tono?: Tono; nota?: string; ruta?: string; accion?: string;
}) {
  const contenido = <>
    <span className="resumen-kpi-top"><span className="resumen-kpi-etiqueta">{etiqueta}</span><Ficha icono={icono} tono={tono} /></span>
    <span className="resumen-kpi-cuerpo">
      <span className="resumen-numero resumen-kpi-valor">{numero}</span>
      {accion ? <span className="resumen-kpi-enlace-texto">{accion}<ChevronRight aria-hidden="true" /></span> : <span className="resumen-kpi-nota">{nota}</span>}
    </span>
  </>;
  return (
    <li>
      {ruta ? <Link to={ruta} className="resumen-kpi-card resumen-kpi-card--enlace">{contenido}</Link>
        : <div className="resumen-kpi-card">{contenido}</div>}
    </li>
  );
}

// Los cuatro accesos rápidos del Resumen; las rutas son las del router.
const ACCESOS: { ruta: string; titulo: string; sub: string; icono: LucideIcon; tono?: Tono }[] = [
  { ruta: '/servicios/nuevo', titulo: 'Nuevo servicio', sub: 'Publicar en catálogo', icono: Plus },
  { ruta: '/horario', titulo: 'Ajustar horario', sub: 'Días y horas hábiles', icono: Clock, tono: 'info' },
  { ruta: '/bloqueos', titulo: 'Bloquear fecha', sub: 'Ausencias y festivos', icono: CalendarClock, tono: 'aviso' },
  { ruta: '/estadisticas', titulo: 'Ver estadísticas', sub: 'Resumen del periodo', icono: ChartColumn, tono: 'exito' },
];

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
          <span className="panel-alerta-icono" aria-hidden="true"><Pause /></span>
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
            <li className="resumen-hero">
              <span className="resumen-hero-cabecera">
                <span className="resumen-icono-ficha" aria-hidden="true"><Bell /></span>
                {datos.pendientes > 0 && <span className="panel-insignia panel-insignia--aviso">Requiere atención</span>}
              </span>
              <span className="resumen-hero-cifra">
                <span className="resumen-numero resumen-hero-numero">{datos.pendientes}</span>
                <span className="resumen-hero-etiqueta">Solicitudes pendientes</span>
                <span className="resumen-hero-contexto">{datos.pendientes > 0
                  ? 'Tienes citas esperando confirmación para asegurar su horario.' : 'No tienes solicitudes esperando tu respuesta.'}</span>
              </span>
              <span className="resumen-hero-pie">
                <Link to="/reservas?estado=pendiente" className="btn-servia-primary btn-servia-sm">Atender solicitudes<ChevronRight aria-hidden="true" /></Link>
              </span>
            </li>
            <Cifra numero={datos.hoy} etiqueta="Reservas de hoy" icono={CalendarCheck} tono="info" nota="Agenda del día" />
            <Cifra numero={datos.proximos7Dias} etiqueta="Próximos 7 días" icono={CalendarClock} tono="exito" nota="Citas programadas" />
            <Cifra numero={datos.clientesAtendidos} etiqueta="Clientes atendidos" icono={Users} ruta="/clientes" accion="Ver clientes" />
            <Cifra numero={datos.serviciosPublicados} etiqueta="Servicios publicados" icono={Scissors} tono="aviso" ruta="/servicios" accion="Gestionar catálogo" />
          </ul>

          <nav className="resumen-accesos" aria-label="Accesos rápidos">
            {ACCESOS.map(({ ruta, titulo, sub, icono, tono }) => (
              <Link key={ruta} to={ruta} className="resumen-acceso">
                <Ficha icono={icono} tono={tono} />
                <span className="resumen-acceso-textos">
                  <span className="resumen-acceso-titulo">{titulo}</span>
                  <span className="resumen-acceso-sub">{sub}</span>
                </span>
              </Link>
            ))}
          </nav>

          <section className="panel-tarjeta resumen-proximas" aria-labelledby="resumen-proximas-titulo">
            <div className="panel-tarjeta-encabezado">
              <div>
                <h2 id="resumen-proximas-titulo" className="panel-tarjeta-titulo">Próximas citas</h2>
                <p className="panel-tarjeta-subtitulo">Tus siguientes reservas, ordenadas por fecha y hora.</p>
              </div>
              {datos.proximas.length > 0 && <span className="panel-contador">{datos.proximas.length} {datos.proximas.length === 1 ? 'cita' : 'citas'}</span>}
            </div>
            {datos.proximas.length === 0 ? (
              <EstadoVacio
                icono={CalendarClock}
                titulo={sinReservas ? 'Tu agenda está libre' : 'Sin citas próximas'}
                texto={sinReservas ? 'Todavía no tienes reservas.' : 'No tienes reservas próximas.'}
                accion={datos.serviciosPublicados === 0 ? <Link to="/servicios/nuevo" className="btn-servia-primary">Crear servicio</Link> : undefined}
              />
            ) : (
              <ul className="panel-lista resumen-lista">
                {datos.proximas.map((cita) => {
                  const dia = etiquetaDia(cita.inicio, datos.generadoEn);
                  const pendiente = cita.estado === 'pendiente';
                  return (
                    <li key={cita.id}>
                      <Link to={`/reservas/${cita.id}`} className="panel-item resumen-cita">
                        <span className="resumen-cita-principal">
                          <span className={`resumen-cita-hora${dia.hoy ? '' : ' resumen-cita-hora--otro-dia'}`}>
                            <span className="resumen-cita-hora-inicio">{hora.format(new Date(cita.inicio))}</span>
                            <span className="resumen-cita-hora-dia">{dia.texto}</span>
                          </span>
                          <span className="resumen-cita-datos">
                            <span className="resumen-cita-cliente">{cita.clienteNombre}</span>
                            <span className="resumen-cita-servicio">
                              {cita.servicioNombre} · {hora.format(new Date(cita.inicio))} a {hora.format(new Date(cita.fin))} · {cita.folio}
                            </span>
                          </span>
                        </span>
                        <span className={`resumen-cita-meta${pendiente ? '' : ' resumen-cita-meta--solo-flecha'}`}>
                          {pendiente && <span className={`reserva-badge ${ESTADOS_CONFIG.pendiente.className}`}>{ESTADOS_CONFIG.pendiente.label}</span>}
                          <ChevronRight className="resumen-cita-chevron" aria-hidden="true" />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>}
      </div>
    </div></div>
  );
}
