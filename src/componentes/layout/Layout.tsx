import { Outlet, useLocation } from 'react-router';
import { useState, useEffect, useRef } from 'react';
import Navbar from '../navbar/Navbar';
import Footer from '../footer/Footer';
import { Sidebar } from '../sidebar/Sidebar';
import { useAuth } from '../../contextos/AuthContext';
import { api } from '../../servicios/api';
import './Layout.css';

export function Layout() {
  const { usuario } = useAuth();
  // Cada sesión comienza con recepción desconocida y sin solicitudes heredadas.
  return <ContenidoLayout key={usuario?.uid ?? 'sin-sesion'} />;
}

function ContenidoLayout() {
  const location = useLocation();
  const { usuario, cargando } = useAuth();

  const [aceptaReservas, setAceptaReservas] = useState<boolean | null>(null);
  const [cargandoReservas, setCargandoReservas] = useState(false);
  const [errorCarga, setErrorCarga] = useState(false);
  const [reintento, setReintento] = useState(0);
  const [mensajeReservas, setMensajeReservas] = useState('');
  const [errorCambio, setErrorCambio] = useState(false);
  const [mostrarModalPausa, setMostrarModalPausa] = useState(false);
  const solicitud = useRef({ version: 0 });
  const interruptor = useRef<HTMLInputElement>(null);
  const dialogo = useRef<HTMLDivElement>(null);
  const cancelar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const solicitudes = solicitud.current;
    const actual = ++solicitudes.version;
    if (usuario?.uid) {
      api<{ aceptaReservas: boolean }>('/negocios/mio')
        .then((perfil) => {
          if (actual !== solicitudes.version) return;
          if (typeof perfil.aceptaReservas !== 'boolean') throw new Error('Estado desconocido');
          setAceptaReservas(perfil.aceptaReservas);
        })
        .catch(() => {
          if (actual === solicitudes.version) setErrorCarga(true);
        });
    }
    // También invalida respuestas de una sesión anterior o tras desmontar.
    return () => { solicitudes.version++; };
  }, [usuario?.uid, reintento]);

  useEffect(() => {
    if (!mostrarModalPausa) return;
    const origen = interruptor.current;
    cancelar.current?.focus();
    return () => { origen?.focus(); };
  }, [mostrarModalPausa]);

  useEffect(() => {
    if (mostrarModalPausa && cargandoReservas) dialogo.current?.focus();
  }, [mostrarModalPausa, cargandoReservas]);

  const cambiarRecepcion = async (nuevoEstado: boolean) => {
    if (aceptaReservas === null || cargandoReservas) return;
    // Un GET anterior nunca debe sobrescribir el resultado de este PATCH.
    const actual = ++solicitud.current.version;
    setCargandoReservas(true);
    setMensajeReservas('');
    setErrorCambio(false);
    try {
      await api('/negocios/mio/recepcion-reservas', {
        method: 'PATCH',
        body: JSON.stringify({ aceptaReservas: nuevoEstado }),
      });
      if (actual !== solicitud.current.version) return;
      setAceptaReservas(nuevoEstado);
      setMensajeReservas(nuevoEstado ? 'Reservas reanudadas.' : 'Reservas pausadas.');
      setMostrarModalPausa(false);
    } catch {
      if (actual !== solicitud.current.version) return;
      setErrorCambio(true);
      setMensajeReservas('No pudimos cambiar la recepción de reservas. Intenta de nuevo.');
    } finally {
      if (actual === solicitud.current.version) setCargandoReservas(false);
    }
  };

  const handleToggleReservas = (nuevoEstado: boolean) => {
    if (aceptaReservas === null || cargandoReservas) return;
    if (nuevoEstado) void cambiarRecepcion(true);
    else {
      setMensajeReservas('');
      setErrorCambio(false);
      setMostrarModalPausa(true);
    }
  };

  const ocultarHYF = 
    location.pathname === '/login' || 
    location.pathname === '/registro-negocio';

  if (cargando) {
    return (
      <div className="layout">
        <main className="contenido">
          <Outlet />
        </main>
      </div>
    );
  }

  const showSidebar = !ocultarHYF && !!usuario;

  return (
    <>
    <div className={`layout ${showSidebar ? 'layout--with-sidebar' : ''}`} inert={mostrarModalPausa}>
      {!ocultarHYF && (usuario ? <Sidebar /> : <Navbar />)}
      
      <main className="contenido">
        
        {/* --- INTERRUPTOR DE RESERVAS --- */}
        {usuario && !ocultarHYF && (
          <div className="container-fluid mb-4 mt-3">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center p-3 bg-white shadow-sm rounded-4 border">
              
              <div className="d-flex flex-column">
                <h6 className="mb-0 fw-bold text-dark">Recepción de reservas</h6>
                <small id="estadoRecepcion" className="text-muted">
                  {aceptaReservas === null
                    ? (errorCarga ? 'Estado de recepción desconocido.' : 'Cargando recepción de reservas...')
                    : aceptaReservas
                    ? 'Tus clientes pueden agendar citas contigo.' 
                    : 'Los clientes ven tu perfil, pero no pueden agendar.'}
                </small>
              </div>

              <div className="d-flex align-items-center gap-3 mt-3 mt-md-0">
                {mensajeReservas && !mostrarModalPausa && (
                  <span role={errorCambio ? 'alert' : 'status'} className="badge bg-light text-dark border me-2">{mensajeReservas}</span>
                )}
                
                <div className="form-check form-switch m-0 d-flex align-items-center gap-2">
                  <input
                    ref={interruptor}
                    className="form-check-input" 
                    type="checkbox" 
                    role="switch" 
                    id="switchReservas" 
                    checked={aceptaReservas === true}
                    aria-describedby="estadoRecepcion"
                    onChange={(e) => handleToggleReservas(e.target.checked)}
                    disabled={cargandoReservas || aceptaReservas === null}
                    style={{ cursor: 'pointer', transform: 'scale(1.3)', margin: 0 }}
                  />
                  <label className="form-check-label fw-semibold" htmlFor="switchReservas" style={{ cursor: 'pointer' }}>
                    Recibir reservas
                  </label>
                </div>
              </div>

            </div>

            {errorCarga && (
              <div role="alert" className="alert alert-danger mt-2">
                No pudimos cargar la recepción de reservas. Intenta de nuevo.
                <button className="btn btn-outline-dark ms-2" onClick={() => {
                  setErrorCarga(false);
                  setReintento((valor) => valor + 1);
                }}>
                  Reintentar
                </button>
              </div>
            )}

            {aceptaReservas === false && (
              <div className="alert alert-warning mt-2 mb-0 d-flex justify-content-between align-items-center rounded-3 border-0 shadow-sm">
                <span className="small">
                  <strong>Pausaste las reservas:</strong> los clientes no pueden pedir reservas nuevas.
                </span>
                <button 
                  className="btn btn-sm btn-dark rounded-pill px-3" 
                  onClick={() => handleToggleReservas(true)}
                  disabled={cargandoReservas || aceptaReservas === null}
                >
                  Reanudar
                </button>
              </div>
            )}
          </div>
        )}
       
        <Outlet />
      </main>
      
      {!ocultarHYF && !usuario && <Footer />}

      </div>

      {/* Confirmación de RN-13/RN-14; el fondo queda inerte mientras está abierta. */}
      {mostrarModalPausa && (
        <div 
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" 
          style={{ backgroundColor: 'rgba(23, 16, 35, 0.55)', zIndex: 1080, backdropFilter: 'blur(4px)' }}
        >
          <div 
            ref={dialogo}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tituloPausa"
            aria-describedby="descripcionPausa notaPausa"
            tabIndex={-1}
            onKeyDown={(evento) => {
              if (evento.key === 'Escape' && !cargandoReservas) {
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
            className="bg-white p-4 p-md-5 shadow-lg" 
            style={{ maxWidth: '500px', width: '90%', borderRadius: '24px' }}
          >
            <div className="text-center mb-3">
              <div 
                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3" 
                style={{ width: 70, height: 70, background: '#fff0c2', color: '#d97706', fontSize: 32 }}
              >
                ⏸
              </div>
              <h3 id="tituloPausa" className="fw-bold text-dark mb-2">¿Pausar las reservas?</h3>
              <p id="descripcionPausa" className="text-muted small mb-0">
                Tu perfil seguirá visible, pero los clientes verán «No acepta reservas por ahora» y no podrán pedir reservas nuevas.
              </p>
            </div>
            
            <div className="bg-light rounded-3 p-3 mb-4 text-center">
              <span id="notaPausa" className="small text-secondary">
                <strong>Nota:</strong> Las reservas que ya tienes no cambiarán.
              </span>
            </div>

            {errorCambio && mensajeReservas && <p role="alert">{mensajeReservas}</p>}

            <div className="d-flex justify-content-center gap-3">
              <button 
                ref={cancelar}
                className="btn btn-light px-4 py-2 fw-semibold" 
                style={{ borderRadius: '12px', border: '1px solid #dfe3ec' }}
                onClick={() => setMostrarModalPausa(false)}
                disabled={cargandoReservas || aceptaReservas === null}
              >
                Cancelar
              </button>
              <button 
                className="btn text-white px-4 py-2 fw-semibold" 
                style={{ borderRadius: '12px', background: 'linear-gradient(135deg, #7e22ce, #7017ff)' }}
                onClick={() => cambiarRecepcion(false)}
                disabled={cargandoReservas || aceptaReservas === null}
              >
                {cargandoReservas ? 'Pausando...' : 'Pausar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}