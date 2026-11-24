import { useEffect, useState } from 'react';
import { CircleAlert, CircleHelp, LogOut, MessageSquareWarning, Settings, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contextos/AuthContext';
import { api } from '../../servicios/api';
import { mensajeDeError } from '../../servicios/mensajeDeError';
import { EsqueletoLista } from '../../componentes/panel/EstadosPanel';
import { EncabezadoPanel } from '../../componentes/panel/EncabezadoPanel';
import { TarjetaPanel } from '../../componentes/panel/TarjetaPanel';
import { EtiquetaEstado } from '../../componentes/panel/EtiquetaEstado';
import { BotonPanel } from '../../componentes/panel/BotonPanel';
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
    <TarjetaPanel id="cuenta" titulo="Cuenta" tituloId="configuracion-cuenta" subtitulo="Con este correo entras a Servia.">
      <div className="panel-item">
        <div className="panel-estado-cuerpo">
          <h3 className="panel-item-titulo">Correo de acceso</h3>
          <p className="panel-item-texto panel-reporte-asunto">{usuario?.email ?? 'Sin correo registrado'}</p>
        </div>
        <BotonPanel variante="secundario" to="/mi-perfil"><UserRound aria-hidden="true" />Mi perfil</BotonPanel>
      </div>
      <CambiarContrasena incrustada />
      <div className="panel-formulario-acciones panel-formulario-acciones--separado">
        <p className="panel-ayuda">Cierra la sesión en este dispositivo.</p>
        <button type="button" className="btn-servia-danger" onClick={async () => { await cerrarSesion(); navigate('/login'); }}>
          <LogOut aria-hidden="true" />Cerrar sesión
        </button>
      </div>
    </TarjetaPanel>
  );
}

function TarjetaAyuda() {
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let vigente = true;
    api<Reporte[]>('/soporte/reportes/mios')
      .then(datos => { if (vigente) setReportes([...datos].sort((a, b) => b.creadaEn.localeCompare(a.creadaEn)).slice(0, ULTIMOS_REPORTES)); })
      .catch((causa: unknown) => { if (vigente) setError(mensajeDeError(causa, 'No pudimos cargar tus reportes.')); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [revision]);

  return (
    <TarjetaPanel
      id="ayuda-y-soporte"
      titulo="Ayuda y soporte"
      tituloId="configuracion-ayuda"
      subtitulo="Resuelve dudas o cuéntanos si algo no funciona."
      ariaBusy={cargando}
    >
      <div className="panel-acciones-fila">
        <BotonPanel variante="secundario" to="/ayuda"><CircleHelp aria-hidden="true" />Preguntas frecuentes</BotonPanel>
        <BotonPanel variante="primario" to="/soporte"><MessageSquareWarning aria-hidden="true" />Reportar un problema</BotonPanel>
      </div>
      <div className="panel-subseccion">
        <h3 className="panel-item-titulo">Tus últimos reportes</h3>
        {cargando && <div role="status" aria-label="Cargando reportes"><EsqueletoLista filas={1} /></div>}
        {!cargando && error && (
          <div className="panel-alerta panel-alerta--error" role="alert">
            <span className="panel-alerta-icono"><CircleAlert aria-hidden="true" /></span>
            <div className="panel-alerta-contenido">{error}</div>
            <BotonPanel variante="secundario" onClick={() => { setError(''); setCargando(true); setRevision(r => r + 1); }}>Reintentar</BotonPanel>
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
              <EtiquetaEstado texto="Abierto" tono="aviso" />
            </article>
          ))}
        </div>
      </div>
    </TarjetaPanel>
  );
}

export function Configuracion() {
  return (
    <div className="panel-pagina"><div className="panel-contenedor">
      <EncabezadoPanel
        grupo="configuracion"
        icono={Settings}
        titulo="Configuración"
        subtitulo="Tu cuenta, la recepción de reservas, los avisos y la ayuda en un solo lugar."
      />
      <TarjetaCuenta />
      <RecepcionReservas />
      <PreferenciasNotificaciones titulo="Notificaciones" ancla="notificaciones" />
      <TarjetaAyuda />
    </div></div>
  );
}
