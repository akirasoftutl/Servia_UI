import { useEffect, useRef, useState } from 'react';
import { Bell, CircleAlert } from 'lucide-react';
import { api, ErrorApi } from '../../servicios/api';
import { EsqueletoLista, IlustracionEstado } from './EstadosPanel';
import '../../estilos/panel.css';

interface PreferenciasPush { nuevaSolicitud: boolean; reservaCancelada: boolean }
const tipos = [
  { campo: 'nuevaSolicitud', titulo: 'Nueva solicitud', descripcion: 'Cuando un cliente solicita una reserva.' },
  { campo: 'reservaCancelada', titulo: 'Reserva cancelada por el cliente', descripcion: 'Cuando un cliente cancela su reserva.' },
] as const;
const mensajeError = (causa: unknown) => causa instanceof ErrorApi
  ? causa.message : 'No se pudo conectar. Inténtalo de nuevo.';

interface Props { titulo?: string; ancla?: string }

/** Interruptores de avisos push: los usan la página de Preferencias y la tarjeta de Configuración. */
export function PreferenciasNotificaciones({ titulo = 'Avisos push', ancla }: Props) {
  const [datos, setDatos] = useState<PreferenciasPush | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [revision, setRevision] = useState(0);
  const vigente = useRef(false);

  useEffect(() => {
    vigente.current = true;
    let actual = true;
    api<PreferenciasPush>('/notificaciones/preferencias').then(
      respuesta => { if (actual) setDatos(respuesta); },
      causa => { if (actual) setError(mensajeError(causa)); },
    ).finally(() => { if (actual) setCargando(false); });
    return () => { actual = false; vigente.current = false; };
  }, [revision]);

  async function cambiar(campo: keyof PreferenciasPush) {
    if (!datos || guardando) return;
    const anterior = datos;
    const nuevas = { ...datos, [campo]: !datos[campo] };
    setDatos(nuevas);
    setGuardando(true);
    setError(''); setExito('');
    try {
      const respuesta = await api<PreferenciasPush>('/notificaciones/preferencias', {
        method: 'PUT', body: JSON.stringify(nuevas),
      });
      if (vigente.current) { setDatos(respuesta); setExito('Preferencias guardadas.'); }
    } catch (causa) {
      if (vigente.current) { setDatos(anterior); setError(mensajeError(causa)); }
    } finally {
      if (vigente.current) setGuardando(false);
    }
  }

  return (
    <section id={ancla} className="panel-tarjeta" aria-labelledby="preferencias-titulo" aria-busy={cargando || guardando}>
      <div className="panel-tarjeta-encabezado"><div>
        <h2 id="preferencias-titulo" className="panel-tarjeta-titulo">{titulo}</h2>
        <p className="panel-tarjeta-subtitulo">Los avisos siempre aparecerán en tu bandeja, aunque apagues el push.</p>
      </div></div>
      {cargando ? <div role="status" aria-label="Cargando preferencias"><EsqueletoLista filas={2} /></div> : !datos ?
        <div className="panel-estado panel-estado--error">
          <IlustracionEstado icono={CircleAlert} error />
          <div className="panel-estado-cuerpo"><h2 className="panel-estado-titulo">No pudimos cargar las preferencias</h2>
            <p className="panel-estado-texto" role="alert">{error}</p></div>
          <div className="panel-estado-acciones"><button className="btn-servia-primary" onClick={() => {
            setError(''); setCargando(true); setRevision(r => r + 1);
          }}>Reintentar</button></div>
        </div> : <>
          {error && <div className="panel-alerta panel-alerta--error" role="alert"><span className="panel-alerta-icono"><CircleAlert aria-hidden="true" /></span><div className="panel-alerta-contenido">{error}</div></div>}
          {exito && <div className="panel-alerta panel-alerta--exito" role="status"><span className="panel-alerta-icono"><Bell aria-hidden="true" /></span><div className="panel-alerta-contenido">{exito}</div></div>}
          {guardando && <p className="panel-ayuda" role="status">Guardando preferencias...</p>}
          <div className="panel-lista">{tipos.map(({ campo, titulo, descripcion }) =>
            <article className="panel-item" key={campo}>
              <div><h3 id={`${campo}-titulo`} className="panel-item-titulo">{titulo}</h3>
                <p id={`${campo}-ayuda`} className="panel-item-texto">{descripcion}</p></div>
              <button type="button" role="switch" aria-checked={datos[campo]} aria-labelledby={`${campo}-titulo`}
                aria-describedby={`${campo}-ayuda`} disabled={guardando}
                className="panel-interruptor" onClick={() => void cambiar(campo)}>
                <span className="panel-interruptor-pista" aria-hidden="true" />
                {datos[campo] ? 'Activado' : 'Desactivado'}
              </button>
            </article>)}
          </div>
        </>}
    </section>
  );
}
