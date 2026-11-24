import { useEffect, useRef, useState } from 'react';
import { Pause } from 'lucide-react';
import { createPortal } from 'react-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../servicios/firebase';
import { useLocation, useNavigate } from 'react-router';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../../servicios/api';
import { mensajeDeError } from '../../servicios/mensajeDeError';
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
  // Recepción de reservas (antes vivía en el Layout).
  const [aceptaReservas, setAceptaReservas] = useState<boolean | null>(null);
  const [cargandoRecepcion, setCargandoRecepcion] = useState(false);
  const [errorCargaRecepcion, setErrorCargaRecepcion] = useState('');
  const [reintentoRecepcion, setReintentoRecepcion] = useState(0);
  const [mensajeReservas, setMensajeReservas] = useState('');
  const [errorCambio, setErrorCambio] = useState(false);
  const [mostrarModalPausa, setMostrarModalPausa] = useState(false);
  const solicitudRecepcion = useRef({ version: 0 });
  const interruptor = useRef<HTMLButtonElement>(null);
  const dialogo = useRef<HTMLDivElement>(null);
  const cancelar = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    if (!mostrarModalPausa) return;
    const origen = interruptor.current;
    const fondo = interruptor.current?.closest('.layout') ?? interruptor.current?.closest('.panel-pagina');
    fondo?.setAttribute('inert', '');
    cancelar.current?.focus();
    return () => { fondo?.removeAttribute('inert'); origen?.focus(); };
  }, [mostrarModalPausa]);

  useEffect(() => {
    if (mostrarModalPausa && cargandoRecepcion) dialogo.current?.focus();
  }, [mostrarModalPausa, cargandoRecepcion]);

  const cambiarRecepcion = async (nuevoEstado: boolean) => {
    if (aceptaReservas === null || cargandoRecepcion) return;
    const actual = ++solicitudRecepcion.current.version;
    setCargandoRecepcion(true);
    setMensajeReservas('');
    setErrorCambio(false);
    try {
      await api('/negocios/mio/recepcion-reservas', {
        method: 'PATCH',
        body: JSON.stringify({ aceptaReservas: nuevoEstado }),
      });
      if (actual !== solicitudRecepcion.current.version) return;
      setAceptaReservas(nuevoEstado);
      setMensajeReservas(nuevoEstado ? 'Reservas reanudadas.' : 'Reservas pausadas.');
      setMostrarModalPausa(false);
    } catch (error: unknown) {
      if (actual !== solicitudRecepcion.current.version) return;
      if (esNoAutorizado(error)) {
        await cerrarSesionVencida();
        navigate('/login', { replace: true });
        return;
      }
      setErrorCambio(true);
      setMensajeReservas(mensajeDeError(error, 'No pudimos cambiar la recepción de reservas. Intenta de nuevo.'));
    } finally {
      if (actual === solicitudRecepcion.current.version) setCargandoRecepcion(false);
    }
  };

  const handleToggleReservas = () => {
    if (aceptaReservas === null || cargandoRecepcion) return;
    setMensajeReservas('');
    setErrorCambio(false);
    setMostrarModalPausa(true);
  };

  return (<>
    <section id="recepcion-reservas" className="panel-tarjeta" inert={mostrarModalPausa} aria-labelledby="titulo-recepcion">
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
        {aceptaReservas !== false && (
          <div className="panel-recepcion-acciones">
            <button
              ref={interruptor}
              type="button"
              role="switch"
              aria-label="Recibir reservas"
              aria-checked={aceptaReservas === true}
              aria-describedby="estadoRecepcion"
              className="btn-servia-secondary"
              onClick={handleToggleReservas}
              disabled={cargandoRecepcion || aceptaReservas === null}
            >
              Pausar recepción
            </button>
          </div>
        )}

        {mensajeReservas && !mostrarModalPausa && (
          <div
            role={errorCambio ? 'alert' : 'status'}
            className={`panel-alerta panel-alerta--${errorCambio ? 'error' : 'exito'} panel-recepcion-estado`}
          >
            <span className="panel-alerta-icono" aria-hidden="true">
              {errorCambio ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            </span>
            <p className="panel-alerta-contenido">{mensajeReservas}</p>
          </div>
        )}

        {errorCargaRecepcion && (
          <div role="alert" className="panel-alerta panel-alerta--error">
            <span className="panel-alerta-icono" aria-hidden="true">!</span>
            <div className="panel-alerta-contenido">
              <strong>No pudimos cargar la recepción de reservas.</strong>
              <p>{errorCargaRecepcion}</p>
            </div>
            <button
              className="btn-servia-secondary btn-servia-sm panel-alerta-accion"
              onClick={() => {
                setErrorCargaRecepcion('');
                setReintentoRecepcion((valor) => valor + 1);
              }}
            >
              Reintentar
            </button>
          </div>
        )}

        {aceptaReservas === false && (
          <div className="panel-alerta panel-alerta--aviso">
            <span className="panel-alerta-icono" aria-hidden="true"><Pause /></span>
            <div className="panel-alerta-contenido">
              <strong>Pausaste las reservas</strong>
              <p>Los clientes no pueden pedir reservas nuevas.</p>
            </div>
            <button
              className="btn-servia-secondary btn-servia-sm panel-alerta-accion"
              onClick={() => handleToggleReservas()}
              disabled={cargandoRecepcion || aceptaReservas === null}
            >
              Reanudar
            </button>
          </div>
        )}
      </div>
    </section>

    {mostrarModalPausa && createPortal(
      <div className="panel-dialogo-fondo">
        <div
          ref={dialogo}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tituloPausa"
          aria-describedby="descripcionPausa notaPausa"
          tabIndex={-1}
          onKeyDown={(evento) => {
            if (evento.key === 'Escape' && !cargandoRecepcion) {
              evento.preventDefault();
              setMostrarModalPausa(false);
            }
            if (evento.key === 'Tab') {
              const botones = Array.from(dialogo.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
              const primero = botones[0];
              const ultimo = botones[botones.length - 1];
              if (!primero || !botones.includes(document.activeElement as HTMLButtonElement)) {
                evento.preventDefault();
                (evento.shiftKey ? ultimo : primero)?.focus();
              } else if (evento.shiftKey && document.activeElement === primero) {
                evento.preventDefault();
                ultimo.focus();
              } else if (!evento.shiftKey && document.activeElement === ultimo) {
                evento.preventDefault();
                primero.focus();
              }
            }
          }}
          className="panel-dialogo"
        >
          <div className="panel-dialogo-icono panel-dialogo-icono--aviso" aria-hidden="true"><Pause /></div>
          <h2 id="tituloPausa" className="panel-dialogo-titulo">{aceptaReservas ? '¿Pausar las reservas?' : '¿Reanudar las reservas?'}</h2>
          <p id="descripcionPausa" className="panel-dialogo-texto">
            {aceptaReservas
              ? 'Tu perfil seguirá visible. Los clientes no podrán solicitar nuevas reservas; verán «No acepta reservas por ahora» y no podrán pedir reservas nuevas.'
              : 'Tu perfil seguirá visible y los clientes podrán solicitar nuevas reservas.'}
          </p>
          <div className="panel-alerta panel-alerta--aviso">
            <span className="panel-alerta-icono" aria-hidden="true">!</span>
            <div id="notaPausa" className="panel-alerta-contenido">
              <strong>Nota:</strong> Las reservas que ya tienes no cambiarán.
            </div>
          </div>
          {errorCambio && mensajeReservas && <p role="alert" className="panel-error-campo">{mensajeReservas}</p>}
          <div className="panel-dialogo-acciones">
            <button
              ref={cancelar}
              className="btn-servia-secondary"
              onClick={() => setMostrarModalPausa(false)}
              disabled={cargandoRecepcion || aceptaReservas === null}
            >
              Cancelar
            </button>
            <button
              className="btn-servia-primary"
              onClick={() => cambiarRecepcion(!aceptaReservas)}
              disabled={cargandoRecepcion || aceptaReservas === null}
            >
              {cargandoRecepcion ? (aceptaReservas ? 'Pausando...' : 'Reanudando...') : (aceptaReservas ? 'Pausar' : 'Reanudar')}
            </button>
          </div>
        </div>
      </div>
      , document.body)}
  </>);
}