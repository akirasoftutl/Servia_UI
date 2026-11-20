import { useEffect, useState } from 'react';
import { CircleAlert, CircleHelp, LogOut, MessageSquareWarning, Settings, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../contextos/AuthContext';
import { api } from '../../servicios/api';
import { EsqueletoLista } from '../../componentes/panel/EstadosPanel';
import { EyebrowPanel } from '../../componentes/panel/EyebrowPanel';
import { PreferenciasNotificaciones } from '../../componentes/panel/PreferenciasNotificaciones';
import { RecepcionReservas } from '../../componentes/panel/RecepcionReservas';
import { CambiarContrasena } from '../mi_perfil/CambiarContrasena';
import '../../estilos/panel.css';

interface Reporte { id: string; asunto: string; estado: 'abierto'; creadaEn: string }
const ULTIMOS_REPORTES = 3;
const fecha = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'medium', timeStyle: 'short' });

function TarjetaCuenta() {
  const { usuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();
  return (
    <section id="cuenta" className="panel-tarjeta" aria-labelledby="configuracion-cuenta">
      <div className="panel-tarjeta-encabezado"><div>
        <h2 id="configuracion-cuenta" className="panel-tarjeta-titulo">Cuenta</h2>
        <p className="panel-tarjeta-subtitulo">Con este correo entras a Servia.</p>
      </div></div>
      <div className="panel-item">
        <div className="panel-estado-cuerpo">
          <h3 className="panel-item-titulo">Correo de acceso</h3>
          <p className="panel-item-texto panel-reporte-asunto">{usuario?.email ?? 'Sin correo registrado'}</p>
        </div>
        <Link to="/mi-perfil" className="btn-servia-secondary"><UserRound aria-hidden="true" />Mi perfil</Link>
      </div>
      <CambiarContrasena incrustada />
      <div className="panel-formulario-acciones panel-formulario-acciones--separado">
        <p className="panel-ayuda">Cierra la sesión en este dispositivo.</p>
        <button type="button" className="btn-servia-danger" onClick={async () => { await cerrarSesion(); navigate('/login'); }}>
          <LogOut aria-hidden="true" />Cerrar sesión
        </button>
      </div>
    </section>
  );
}

function TarjetaAyuda() {
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let vigente = true;
    api<Reporte[]>('/soporte/reportes/mios')
      .then(datos => { if (vigente) setReportes([...datos].sort((a, b) => b.creadaEn.localeCompare(a.creadaEn)).slice(0, ULTIMOS_REPORTES)); })
      .catch(() => { if (vigente) setError(true); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [revision]);

  return (
    <section id="ayuda-y-soporte" className="panel-tarjeta" aria-labelledby="configuracion-ayuda" aria-busy={cargando}>
      <div className="panel-tarjeta-encabezado"><div>
        <h2 id="configuracion-ayuda" className="panel-tarjeta-titulo">Ayuda y soporte</h2>
        <p className="panel-tarjeta-subtitulo">Resuelve dudas o cuéntanos si algo no funciona.</p>
      </div></div>
      <div className="panel-acciones-fila">
        <Link to="/ayuda" className="btn-servia-secondary"><CircleHelp aria-hidden="true" />Preguntas frecuentes</Link>
        <Link to="/soporte" className="btn-servia-primary"><MessageSquareWarning aria-hidden="true" />Reportar un problema</Link>
      </div>
      <div className="panel-subseccion">
        <h3 className="panel-item-titulo">Tus últimos reportes</h3>
        {cargando && <div role="status" aria-label="Cargando reportes"><EsqueletoLista filas={1} /></div>}
        {!cargando && error && (
          <div className="panel-alerta panel-alerta--error" role="alert">
            <span className="panel-alerta-icono"><CircleAlert aria-hidden="true" /></span>
            <div className="panel-alerta-contenido">No pudimos cargar tus reportes.</div>
            <button type="button" className="btn-servia-secondary" onClick={() => { setError(false); setCargando(true); setRevision(r => r + 1); }}>Reintentar</button>
          </div>
        )}
        {!cargando && !error && reportes.length === 0 && <p className="panel-ayuda">Todavía no has enviado reportes.</p>}
        <div className="panel-lista">
          {reportes.map(reporte => (
            <article className="panel-item" key={reporte.id}>
              <div className="panel-estado-cuerpo">
                <h4 className="panel-item-titulo panel-reporte-asunto">{reporte.asunto}</h4>
                <p className="panel-item-texto"><time dateTime={reporte.creadaEn}>{fecha.format(new Date(reporte.creadaEn))}</time></p>
              </div>
              <span className="panel-insignia panel-insignia--aviso">Abierto</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Configuracion() {
  return (
    <div className="panel-pagina"><div className="panel-contenedor">
      <header className="panel-encabezado"><div className="panel-encabezado-textos">
        <EyebrowPanel grupo="configuracion" icono={Settings} />
        <h1 className="panel-titulo">Configuración</h1>
        <p className="panel-subtitulo">Tu cuenta, la recepción de reservas, los avisos y la ayuda en un solo lugar.</p>
      </div></header>
      <TarjetaCuenta />
      <RecepcionReservas />
      <PreferenciasNotificaciones titulo="Notificaciones" ancla="notificaciones" />
      <TarjetaAyuda />
    </div></div>
  );
}
