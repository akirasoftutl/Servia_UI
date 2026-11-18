import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { api, ErrorApi } from '../../servicios/api';
import { ESTADOS_CONFIG, formatearFecha, formatearHora, calcularTiempoRestante } from './estados';
import './Reservas.css';

interface DetalleReservaAPI {
  id: string;
  folio: string;
  estado: string;
  inicio: string;
  fin: string;
  servicio: { nombre: string; precio: number | null; duracionMin: number | null };
  cliente: { nombre: string; telefono: string | null; correo?: string };
  venceEn: string | null;
  segundosRestantes: number | null;
  motivo?: string;
  observaciones?: string;
}

export function DetalleReserva() {
  const { id } = useParams();
  const [reserva, setReserva] = useState<DetalleReservaAPI | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  
  // Estados para los modales y acciones
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [mostrarRechazar, setMostrarRechazar] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [errorMotivo, setErrorMotivo] = useState('');
  const [procesando, setProcesando] = useState(false);

  const cargarDetalle = async () => {
    setCargando(true);
    try {
      const data = await api<DetalleReservaAPI>(`/reservas/negocio/${id}`);
      setReserva(data);
    } catch (err: any) {
      if (err.estado === 404) {
        setError('No encontramos esta reserva.');
      } else {
        setError('No pudimos cargar la reserva. Intenta de nuevo.');
      }
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDetalle();
  }, [id]);

  // Efecto para ocultar botones y recargar cuando el tiempo llegue a 0
  useEffect(() => {
    if (reserva?.estado === 'pendiente' && reserva.segundosRestantes !== null) {
      if (reserva.segundosRestantes <= 0) {
        cargarDetalle(); // Recargar para que el backend actualice el estado a rechazada_vencimiento
      }
    }
  }, [reserva?.segundosRestantes]);

  const handleAceptar = async () => {
    setProcesando(true);
    try {
      await api(`/reservas/negocio/${id}/aceptar`, { method: 'PATCH' });
      alert('Reserva confirmada.');
      setMostrarConfirmar(false);
      cargarDetalle();
    } catch (err: any) {
      if (err instanceof ErrorApi && err.estado === 409) {
        alert(err.message); // Muestra el mensaje de la API
        setMostrarConfirmar(false);
        cargarDetalle();
      } else {
        alert('No pudimos guardar tu respuesta. Intenta de nuevo.');
      }
    } finally {
      setProcesando(false);
    }
  };

  const handleRechazar = async () => {
    if (!motivoRechazo.trim()) {
      setErrorMotivo('Escribe el motivo del rechazo.');
      return;
    }
    if (motivoRechazo.length > 500) {
      setErrorMotivo('El motivo no puede exceder 500 caracteres.');
      return;
    }

    setProcesando(true);
    try {
      await api(`/reservas/negocio/${id}/rechazar`, {
        method: 'PATCH',
        body: JSON.stringify({ motivo: motivoRechazo }),
      });
      alert('Solicitud rechazada. El horario quedó libre.');
      setMostrarRechazar(false);
      setMotivoRechazo('');
      cargarDetalle();
    } catch (err: any) {
      if (err instanceof ErrorApi && err.estado === 409) {
        alert(err.message);
        setMostrarRechazar(false);
        cargarDetalle();
      } else {
        alert('No pudimos guardar tu respuesta. Intenta de nuevo.');
      }
    } finally {
      setProcesando(false);
    }
  };

  // Manejo de tecla Escape para cerrar modales
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMostrarConfirmar(false);
        setMostrarRechazar(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  if (cargando) return (
    <div className="panel-pagina d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
      <div className="spinner-border" style={{ color: '#9333ea' }} role="status"></div>
    </div>
  );

  if (error) {
    return (
      <div className="panel-pagina">
        <div className="panel-contenedor text-center py-5">
          <h3 className="text-muted mb-4">{error}</h3>
          <Link to="/reservas" className="btn-servia-primary text-decoration-none">Volver a reservas</Link>
        </div>
      </div>
    );
  }

  if (!reserva) return null;
  const estadoConfig = ESTADOS_CONFIG[reserva.estado] || { label: reserva.estado, className: '' };
  
  // Condición para mostrar los botones
  const esPendienteVigente = reserva.estado === 'pendiente' && (reserva.segundosRestantes === null || reserva.segundosRestantes > 0);

  return (
    <div className="panel-pagina">

      <div className="panel-contenedor" style={{ maxWidth: '900px' }}>


        {reserva.estado === 'pendiente' && reserva.segundosRestantes !== null && reserva.segundosRestantes > 0 && (
          <div className="panel-alerta panel-alerta--aviso" role="status">
            <span className="panel-alerta-icono" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </span>
            <div className="panel-alerta-contenido">
              <strong>Tiempo para responder</strong>
              <p>Responde antes de que venza la solicitud para no perder el horario.</p>
            </div>
            <span className="panel-insignia panel-insignia--aviso panel-alerta-accion">
              {calcularTiempoRestante(reserva.segundosRestantes)}
            </span>
          </div>
        )}


        <header className="panel-encabezado d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
          <div>
            <span className="panel-eyebrow">DETALLE DE RESERVA</span>
            <h1 className="panel-titulo mb-0">Reserva {reserva.folio}</h1>
            <p className="panel-subtitulo mt-1">Revisa la información de la solicitud del cliente.</p>
          </div>
          <span className={`reserva-badge ${estadoConfig.className}`} style={{ fontSize: '14px', padding: '10px 20px', borderRadius: '50px', fontWeight: 'bold' }}>
            {estadoConfig.label}
          </span>
        </header>

        {/* Botones de Acción (Solo si es pendiente y vigente) */}
        {esPendienteVigente && (
          <div className="d-flex gap-3 mb-4">
            <button 
              className="btn-servia-primary flex-grow-1 py-3 fw-bold" 
              onClick={() => setMostrarConfirmar(true)}
              style={{ borderRadius: '12px' }}
            >
              Aceptar Reserva
            </button>
            <button 
              className="btn btn-outline-danger flex-grow-1 py-3 fw-bold" 
              onClick={() => setMostrarRechazar(true)}
              style={{ borderRadius: '12px' }}
            >
              Rechazar Solicitud
            </button>
          </div>
        )}

        <div className="panel-tarjeta p-0 overflow-hidden" style={{ borderRadius: '19px', border: '1px solid #eeeaf5' }}>
          <div className="row g-0">
            {/* ... (Resto del código del detalle de la reserva, el que ya tenías) ... */}
            <div className="col-md-6 p-4 p-md-5 border-end" style={{ borderColor: '#eeeaf5' }}>
              <h5 className="fw-bold text-dark mb-4 d-flex align-items-center gap-2">Datos del cliente</h5>
              <div className="mb-3"><span className="text-muted small d-block mb-1">Nombre completo</span><span className="fw-semibold fs-6 text-dark">{reserva.cliente.nombre || 'No especificado'}</span></div>
              <div className="mb-3"><span className="text-muted small d-block mb-1">Teléfono</span>{reserva.cliente.telefono ? <a href={`tel:${reserva.cliente.telefono}`} className="text-decoration-none fw-semibold" style={{ color: '#7452bd' }}>{reserva.cliente.telefono}</a> : <span className="text-muted">No especificado</span>}</div>
              {reserva.cliente.correo && (<div className="mb-4"><span className="text-muted small d-block mb-1">Correo electrónico</span><a href={`mailto:${reserva.cliente.correo}`} className="text-decoration-none fw-semibold" style={{ color: '#7452bd' }}>{reserva.cliente.correo}</a></div>)}
              <div className="mt-4 pt-4 border-top" style={{ borderColor: '#eeeaf5' }}>
                <h6 className="fw-bold text-dark mb-2">Observaciones del cliente</h6>
                <p className="text-muted small mb-0 p-3 rounded-3" style={{ background: '#f7f6fb', borderLeft: '3px solid #7452bd' }}>{reserva.observaciones || 'Sin observaciones.'}</p>
              </div>
            </div>
            <div className="col-md-6 p-4 p-md-5" style={{ background: '#faf9fc' }}>
              <h5 className="fw-bold text-dark mb-4">Detalles del servicio</h5>
              <div className="mb-4 p-4 bg-white rounded-3 shadow-sm" style={{ border: '1px solid #eeeaf5' }}>
                <span className="text-muted small d-block mb-1">Servicio contratado</span>
                <span className="fw-bold fs-5 mb-3 d-block" style={{ color: '#7452bd' }}>{reserva.servicio.nombre}</span>
                <div className="d-flex justify-content-between text-muted small pt-2 border-top" style={{ borderColor: '#eeeaf5' }}>
                  <span>Duración: <strong className="text-dark">{reserva.servicio.duracionMin} min</strong></span>
                  <span>Precio: <strong className="text-dark">${reserva.servicio.precio?.toFixed(2)}</strong></span>
                </div>
              </div>
              <h5 className="fw-bold text-dark mb-3 mt-4">Fecha y hora</h5>
              <div className="p-3 rounded-3" style={{ background: '#f1ecfa' }}>
                <div className="mb-2"><span className="text-muted small d-block">Fecha</span><span className="fw-semibold text-dark">{formatearFecha(reserva.inicio)}</span></div>
                <div><span className="text-muted small d-block">Horario</span><span className="fw-semibold text-dark">{formatearHora(reserva.inicio)} - {formatearHora(reserva.fin)}</span></div>
              </div>
              {reserva.motivo && (<div className="mt-4"><h6 className="fw-bold text-danger mb-2">Motivo de rechazo/cancelación</h6><p className="text-danger small mb-0 p-3 rounded-3" style={{ background: '#fff0f0', borderLeft: '3px solid #dc3545' }}>{reserva.motivo}</p></div>)}
            </div>
          </div>
          <div className="p-4 text-center border-top" style={{ borderColor: '#eeeaf5', background: '#fff' }}>
            <Link to="/reservas" className="btn-servia-secondary text-decoration-none px-4 py-2" style={{ borderRadius: '50px' }}>Volver a reservas</Link>
          </div>
        </div>
      </div>

      {/* MODAL ACEPTAR */}
      {mostrarConfirmar && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(23, 16, 35, 0.55)', zIndex: 1080, backdropFilter: 'blur(4px)' }} role="alertdialog" aria-modal="true">
          <div className="bg-white p-4 p-md-5 shadow-lg" style={{ maxWidth: '450px', width: '90%', borderRadius: '24px' }}>
            <h3 className="fw-bold text-dark mb-3">¿Confirmar la reserva?</h3>
            <p className="text-muted mb-4">
              ¿Confirmar la reserva de <strong>{reserva.cliente.nombre}</strong> el {formatearFecha(reserva.inicio)} a las {formatearHora(reserva.inicio)}?
            </p>
            <div className="d-flex justify-content-end gap-3">
              <button className="btn btn-light px-4 py-2 fw-semibold" style={{ borderRadius: '12px', border: '1px solid #dfe3ec' }} onClick={() => setMostrarConfirmar(false)} disabled={procesando}>Cancelar</button>
              <button className="btn text-white px-4 py-2 fw-semibold" style={{ borderRadius: '12px', background: 'linear-gradient(135deg, #7e22ce, #7017ff)' }} onClick={handleAceptar} disabled={procesando}>
                {procesando ? 'Confirmando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RECHAZAR */}
      {mostrarRechazar && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(23, 16, 35, 0.55)', zIndex: 1080, backdropFilter: 'blur(4px)' }} role="alertdialog" aria-modal="true">
          <div className="bg-white p-4 p-md-5 shadow-lg" style={{ maxWidth: '500px', width: '90%', borderRadius: '24px' }}>
            <h3 className="fw-bold text-dark mb-3">Rechazar solicitud</h3>
            <div className="mb-3">
              <label className="form-label fw-semibold text-secondary">Motivo del rechazo *</label>
              <textarea 
                className={`form-control ${errorMotivo ? 'is-invalid' : ''}`} 
                rows={3} 
                maxLength={500}
                value={motivoRechazo} 
                onChange={(e) => { setMotivoRechazo(e.target.value); setErrorMotivo(''); }}
                placeholder="Explica al cliente por qué no puedes aceptar la reserva..."
                disabled={procesando}
              ></textarea>
              <div className="d-flex justify-content-between mt-1">
                {errorMotivo ? <span className="text-danger small">{errorMotivo}</span> : <span></span>}
                <span className="text-muted small">{motivoRechazo.length}/500</span>
              </div>
            </div>
            <div className="d-flex justify-content-end gap-3 mt-4">
              <button className="btn btn-light px-4 py-2 fw-semibold" style={{ borderRadius: '12px', border: '1px solid #dfe3ec' }} onClick={() => setMostrarRechazar(false)} disabled={procesando}>Cancelar</button>
              <button className="btn btn-danger px-4 py-2 fw-semibold" style={{ borderRadius: '12px' }} onClick={handleRechazar} disabled={procesando}>
                {procesando ? 'Rechazando...' : 'Rechazar solicitud'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}