import { useEffect, useRef, useState } from 'react';
import { Pause } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../servicios/firebase';
import { useLocation, useNavigate } from 'react-router';
import { api } from '../../servicios/api';
import { alertaDeError, confirmar, exito } from '../../servicios/alertas';
import { mensajeDeError } from '../../servicios/mensajeDeError';
import { BotonPanel } from './BotonPanel';
import '../../estilos/panel.css';

async function cerrarSesionVencida() {
  // La ruta de visitantes requiere que Firebase también deje de tener sesión.
  if (auth) await signOut(auth);
}

function esNoAutorizado(error: unknown) {
  return error instanceof Error && 'estado' in error && error.estado === 401;
}

// RN-13, RN-14 y RN-46: solo cambia la recepción del negocio autenticado.
export function RecepcionReservas() {
  const navigate = useNavigate();
  const { hash } = useLocation();

  useEffect(() => {
    if (hash !== '#recepcion-reservas') return;
    // Espera a que el menú móvil cierre y restaure el foco antes de desplazar.
    const desplazamiento = window.setTimeout(() => document.getElementById('recepcion-reservas')?.scrollIntoView?.(), 0);
    return () => window.clearTimeout(desplazamiento);
  }, [hash]);

  const [aceptaReservas, setAceptaReservas] = useState<boolean | null>(null);
  const [cargandoRecepcion, setCargandoRecepcion] = useState(false);
  const [errorCargaRecepcion, setErrorCargaRecepcion] = useState('');
  const [reintentoRecepcion, setReintentoRecepcion] = useState(0);
  const solicitudRecepcion = useRef({ version: 0 });
  const enProceso = useRef(false);

  useEffect(() => {
    const solicitudes = solicitudRecepcion.current;
    const actual = ++solicitudes.version;
    api<{ aceptaReservas: boolean }>('/negocios/mio')
      .then((perfil) => {
        if (actual !== solicitudes.version) return;
        if (typeof perfil.aceptaReservas !== 'boolean') throw new Error('Estado desconocido');
        setAceptaReservas(perfil.aceptaReservas);
      })
      .catch(async (error: unknown) => {
        if (actual === solicitudes.version && esNoAutorizado(error)) {
          await cerrarSesionVencida();
          navigate('/login', { replace: true });
          return;
        }
        if (actual === solicitudes.version) {
          setErrorCargaRecepcion(mensajeDeError(error, 'Intenta de nuevo para consultar el estado actual.'));
        }
      });
    return () => { solicitudes.version++; };
  }, [reintentoRecepcion, navigate]);

  const cambiarRecepcion = async (nuevoEstado: boolean) => {
    if (aceptaReservas === null || cargandoRecepcion) return;
    const actual = ++solicitudRecepcion.current.version;
    setCargandoRecepcion(true);
    try {
      await api('/negocios/mio/recepcion-reservas', {
        method: 'PATCH',
        body: JSON.stringify({ aceptaReservas: nuevoEstado }),
      });
      if (actual !== solicitudRecepcion.current.version) return;
      setAceptaReservas(nuevoEstado);
      await exito(nuevoEstado ? 'Reservas reanudadas.' : 'Reservas pausadas.');
    } catch (error: unknown) {
      if (actual !== solicitudRecepcion.current.version) return;
      if (esNoAutorizado(error)) {
        await cerrarSesionVencida();
        navigate('/login', { replace: true });
        return;
      }
      await alertaDeError(error, 'No pudimos cambiar la recepción de reservas. Intenta de nuevo.');
    } finally {
      if (actual === solicitudRecepcion.current.version) setCargandoRecepcion(false);
    }
  };

  const handleToggleReservas = async () => {
    if (aceptaReservas === null || cargandoRecepcion || enProceso.current) return;
    enProceso.current = true;
    try {
      const pausar = aceptaReservas === true;
      const aceptado = await confirmar({
        titulo: pausar ? '¿Pausar las reservas?' : '¿Reanudar las reservas?',
        texto: pausar
          ? 'Tu perfil seguirá visible. Los clientes verán «No acepta reservas por ahora» y no podrán pedir reservas nuevas. Nota: Las reservas que ya tienes no cambiarán.'
          : 'Tu perfil seguirá visible y los clientes podrán solicitar nuevas reservas. Nota: Las reservas que ya tienes no cambiarán.',
        confirmar: pausar ? 'Pausar' : 'Reanudar',
        cancelar: 'Cancelar',
        peligro: pausar,
      });
      if (!aceptado) return;
      await cambiarRecepcion(!pausar);
    } finally {
      enProceso.current = false;
    }
  };

  return (
    <section id="recepcion-reservas" className="panel-tarjeta" aria-labelledby="titulo-recepcion">
      <div className="panel-tarjeta-encabezado">
        <div>
          <h2 id="titulo-recepcion" className="panel-tarjeta-titulo">Recepción de reservas</h2>
          <p id="estadoRecepcion" className="panel-tarjeta-subtitulo">
            {aceptaReservas === null
              ? (errorCargaRecepcion ? 'Estado de recepción desconocido.' : 'Cargando recepción de reservas...')
              : aceptaReservas ? 'Tus clientes pueden agendar citas contigo.' : 'Los clientes ven tu perfil, pero no pueden agendar.'}
          </p>
        </div>
      </div>

      <div className="panel-recepcion-cuerpo">
        <div className="panel-recepcion-acciones">
          <BotonPanel
            variante="secundario"
            role="switch"
            aria-label="Recibir reservas"
            aria-checked={aceptaReservas === true}
            aria-describedby="estadoRecepcion"
            onClick={() => void handleToggleReservas()}
            disabled={cargandoRecepcion || aceptaReservas === null}
          >
            {cargandoRecepcion
              ? (aceptaReservas ? 'Pausando...' : 'Reanudando...')
              : (aceptaReservas === false ? 'Reanudar recepción' : 'Pausar recepción')}
          </BotonPanel>
        </div>

        {errorCargaRecepcion && (
          <div role="alert" className="panel-alerta panel-alerta--error">
            <span className="panel-alerta-icono" aria-hidden="true">!</span>
            <div className="panel-alerta-contenido">
              <strong>No pudimos cargar la recepción de reservas.</strong>
              <p>{errorCargaRecepcion}</p>
            </div>
            <BotonPanel
              variante="secundario"
              tamano="sm"
              className="panel-alerta-accion"
              onClick={() => {
                setErrorCargaRecepcion('');
                setReintentoRecepcion((valor) => valor + 1);
              }}
            >
              Reintentar
            </BotonPanel>
          </div>
        )}

        {aceptaReservas === false && (
          <div className="panel-alerta panel-alerta--aviso">
            <span className="panel-alerta-icono" aria-hidden="true"><Pause /></span>
            <div className="panel-alerta-contenido">
              <strong>Pausaste las reservas</strong>
              <p>Los clientes no pueden pedir reservas nuevas.</p>
            </div>
            <BotonPanel
              variante="secundario"
              tamano="sm"
              className="panel-alerta-accion"
              onClick={() => void handleToggleReservas()}
              disabled={cargandoRecepcion || aceptaReservas === null}
            >
              Reanudar
            </BotonPanel>
          </div>
        )}
      </div>
    </section>
  );
}
