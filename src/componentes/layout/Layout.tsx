import { Outlet, useLocation } from 'react-router';
import { useState, useEffect } from 'react';
import Navbar from '../navbar/Navbar';
import Footer from '../footer/Footer';
import { Sidebar } from '../sidebar/Sidebar';
import { useAuth } from '../../contextos/AuthContext';
import { api } from '../../servicios/api';
import './Layout.css';

export function Layout() {
  const location = useLocation();
  const { usuario, cargando } = useAuth();

  // --- ESTADOS PARA EL INTERRUPTOR DE RESERVAS ---
  const [aceptaReservas, setAceptaReservas] = useState(true);
  const [cargandoReservas, setCargandoReservas] = useState(false);
  const [mensajeReservas, setMensajeReservas] = useState('');
  const [mostrarModalPausa, setMostrarModalPausa] = useState(false);

  // Cargar el estado inicial del backend al entrar
  useEffect(() => {
    if (usuario) {
      const cargarEstado = async () => {
        try {
          const perfil = await api<{ aceptaReservas: boolean }>('/negocios/mio');
          setAceptaReservas(perfil.aceptaReservas ?? true);
        } catch (error) {
          console.error('Error al cargar estado de reservas:', error);
        }
      };
      cargarEstado();
    }
  }, [usuario]);

  // Función para encender el interruptor (reanudar)
  const handleToggleReservas = async (nuevoEstado: boolean) => {
    if (!nuevoEstado) {
      setMostrarModalPausa(true);
      return;
    }

    setCargandoReservas(true);
    setMensajeReservas('');
    const estadoAnterior = aceptaReservas;

    try {
      await api('/negocios/mio/recepcion-reservas', {
        method: 'PATCH',
        body: JSON.stringify({ aceptaReservas: nuevoEstado }),
      });
      setAceptaReservas(nuevoEstado);
      setMensajeReservas('Reservas reanudadas.');
    } catch (error) {
      setAceptaReservas(estadoAnterior);
      setMensajeReservas('No pudimos cambiar la recepción de reservas. Intenta de nuevo.');
    } finally {
      setCargandoReservas(false);
    }
  };

  // Función para confirmar la pausa desde el modal
  const confirmarPausa = async () => {
    setCargandoReservas(true);
    setMensajeReservas('');
    const estadoAnterior = aceptaReservas;

    try {
      await api('/negocios/mio/recepcion-reservas', {
        method: 'PATCH',
        body: JSON.stringify({ aceptaReservas: false }),
      });
      setAceptaReservas(false);
      setMensajeReservas('Reservas pausadas.');
      setMostrarModalPausa(false);
    } catch (error) {
      setAceptaReservas(estadoAnterior);
      setMensajeReservas('No pudimos cambiar la recepción de reservas. Intenta de nuevo.');
    } finally {
      setCargandoReservas(false);
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
    <div className={`layout ${showSidebar ? 'layout--with-sidebar' : ''}`}>
      {!ocultarHYF && (usuario ? <Sidebar /> : <Navbar />)}
      
      <main className="contenido">
        
        {/* --- INTERRUPTOR DE RESERVAS --- */}
        {usuario && !ocultarHYF && (
          <div className="container-fluid mb-4 mt-3">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center p-3 bg-white shadow-sm rounded-4 border">
              
              <div className="d-flex flex-column">
                <h6 className="mb-0 fw-bold text-dark">Recepción de reservas</h6>
                <small className="text-muted">
                  {aceptaReservas 
                    ? 'Tus clientes pueden agendar citas contigo.' 
                    : 'Los clientes ven tu perfil, pero no pueden agendar.'}
                </small>
              </div>

              <div className="d-flex align-items-center gap-3 mt-3 mt-md-0">
                {mensajeReservas && (
                  <span className="badge bg-light text-dark border me-2">{mensajeReservas}</span>
                )}
                
                <div className="form-check form-switch m-0 d-flex align-items-center gap-2">
                  <input 
                    className="form-check-input" 
                    type="checkbox" 
                    role="switch" 
                    id="switchReservas" 
                    checked={aceptaReservas}
                    onChange={(e) => handleToggleReservas(e.target.checked)}
                    disabled={cargandoReservas}
                    style={{ cursor: 'pointer', transform: 'scale(1.3)', margin: 0 }}
                  />
                  <label className="form-check-label fw-semibold" htmlFor="switchReservas" style={{ cursor: 'pointer' }}>
                    {aceptaReservas ? 'Activo' : 'Pausado'}
                  </label>
                </div>
              </div>

            </div>

            {!aceptaReservas && (
              <div className="alert alert-warning mt-2 mb-0 d-flex justify-content-between align-items-center rounded-3 border-0 shadow-sm">
                <span className="small">
                  <strong>Pausaste las reservas:</strong> los clientes no pueden pedir reservas nuevas.
                </span>
                <button 
                  className="btn btn-sm btn-dark rounded-pill px-3" 
                  onClick={() => handleToggleReservas(true)}
                  disabled={cargandoReservas}
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

      {/* MODAL PERSONALIZADO DE PAUSA */}
      {mostrarModalPausa && (
        <div 
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" 
          style={{ backgroundColor: 'rgba(23, 16, 35, 0.55)', zIndex: 1080, backdropFilter: 'blur(4px)' }}
        >
          <div 
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
              <h3 className="fw-bold text-dark mb-2">¿Pausar las reservas?</h3>
              <p className="text-muted small mb-0">
                Tu perfil seguirá visible, pero los clientes verán «No acepta reservas por ahora» y no podrán pedir reservas nuevas.
              </p>
            </div>
            
            <div className="bg-light rounded-3 p-3 mb-4 text-center">
              <span className="small text-secondary">
                <strong>Nota:</strong> Las reservas que ya tienes no cambiarán.
              </span>
            </div>

            <div className="d-flex justify-content-center gap-3">
              <button 
                className="btn btn-light px-4 py-2 fw-semibold" 
                style={{ borderRadius: '12px', border: '1px solid #dfe3ec' }}
                onClick={() => setMostrarModalPausa(false)}
                disabled={cargandoReservas}
              >
                Cancelar
              </button>
              <button 
                className="btn text-white px-4 py-2 fw-semibold" 
                style={{ borderRadius: '12px', background: 'linear-gradient(135deg, #7e22ce, #7017ff)' }}
                onClick={confirmarPausa}
                disabled={cargandoReservas}
              >
                {cargandoReservas ? 'Pausando...' : 'Pausar reservas'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}