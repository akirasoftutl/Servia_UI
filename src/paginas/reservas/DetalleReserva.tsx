import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../../servicios/api';
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

  useEffect(() => {
    const cargarDetalle = async () => {
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
    cargarDetalle();
  }, [id]);

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
          {error.includes('No encontramos') ? (
            <Link to="/reservas" className="btn-servia-primary text-decoration-none">Volver a reservas</Link>
          ) : (
            <button className="btn-servia-primary" onClick={() => window.location.reload()}>Reintentar</button>
          )}
        </div>
      </div>
    );
  }

  if (!reserva) return null;
  const estadoConfig = ESTADOS_CONFIG[reserva.estado] || { label: reserva.estado, className: '' };

  return (
    <div className="panel-pagina">
      <div className="panel-contenedor" style={{ maxWidth: '900px' }}>
        
        {/* Encabezado */}
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

        {/* Alerta de tiempo restante */}
        {reserva.estado === 'pendiente' && reserva.segundosRestantes !== null && (
          <div className="alert rounded-4 mb-4 d-flex align-items-center gap-3 border-0 shadow-sm" style={{ background: '#fdf8e4', color: '#b7791f' }}>
            {/* Icono de reloj SVG */}
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <div>
              <strong className="d-block">Tiempo para responder:</strong>
              <span>{calcularTiempoRestante(reserva.segundosRestantes)}</span>
            </div>
          </div>
        )}

        {/* Tarjeta principal */}
        <div className="panel-tarjeta p-0 overflow-hidden" style={{ borderRadius: '19px', border: '1px solid #eeeaf5' }}>
          
          <div className="row g-0">
            {/* Columna Izquierda: Cliente */}
            <div className="col-md-6 p-4 p-md-5 border-end" style={{ borderColor: '#eeeaf5' }}>
              <h5 className="fw-bold text-dark mb-4 d-flex align-items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7452bd" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                Datos del cliente
              </h5>
              
              <div className="mb-3">
                <span className="text-muted small d-block mb-1">Nombre completo</span>
                <span className="fw-semibold fs-6 text-dark">{reserva.cliente.nombre || 'No especificado'}</span>
              </div>

              <div className="mb-3">
                <span className="text-muted small d-block mb-1">Teléfono</span>
                {reserva.cliente.telefono ? (
                  <a href={`tel:${reserva.cliente.telefono}`} className="text-decoration-none fw-semibold d-inline-flex align-items-center gap-2" style={{ color: '#7452bd' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                    {reserva.cliente.telefono}
                  </a>
                ) : (
                  <span className="text-muted">No especificado</span>
                )}
              </div>

              {reserva.cliente.correo && (
                <div className="mb-4">
                  <span className="text-muted small d-block mb-1">Correo electrónico</span>
                  <a href={`mailto:${reserva.cliente.correo}`} className="text-decoration-none fw-semibold d-inline-flex align-items-center gap-2" style={{ color: '#7452bd' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                    </svg>
                    {reserva.cliente.correo}
                  </a>
                </div>
              )}

              <div className="mt-4 pt-4 border-top" style={{ borderColor: '#eeeaf5' }}>
                <h6 className="fw-bold text-dark mb-2">Observaciones del cliente</h6>
                <p className="text-muted small mb-0 p-3 rounded-3" style={{ background: '#f7f6fb', borderLeft: '3px solid #7452bd' }}>
                  {reserva.observaciones || 'Sin observaciones.'}
                </p>
              </div>

              {reserva.motivo && (
                <div className="mt-4">
                  <h6 className="fw-bold text-danger mb-2">Motivo de rechazo/cancelación</h6>
                  <p className="text-danger small mb-0 p-3 rounded-3" style={{ background: '#fff0f0', borderLeft: '3px solid #dc3545' }}>
                    {reserva.motivo}
                  </p>
                </div>
              )}
            </div>

            {/* Columna Derecha: Servicio y Fecha */}
            <div className="col-md-6 p-4 p-md-5" style={{ background: '#faf9fc' }}>
              <h5 className="fw-bold text-dark mb-4 d-flex align-items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7452bd" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="6" cy="6" r="3"></circle>
                  <circle cx="6" cy="18" r="3"></circle>
                  <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
                  <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
                  <line x1="8.12" y1="8.12" x2="12" y2="12"></line>
                </svg>
                Detalles del servicio
              </h5>

              <div className="mb-4 p-4 bg-white rounded-3 shadow-sm" style={{ border: '1px solid #eeeaf5' }}>
                <span className="text-muted small d-block mb-1">Servicio contratado</span>
                <span className="fw-bold fs-5 mb-3 d-block" style={{ color: '#7452bd' }}>{reserva.servicio.nombre}</span>
                <div className="d-flex justify-content-between text-muted small pt-2 border-top" style={{ borderColor: '#eeeaf5' }}>
                  <span>Duración: <strong className="text-dark">{reserva.servicio.duracionMin} min</strong></span>
                  <span>Precio: <strong className="text-dark">${reserva.servicio.precio?.toFixed(2)}</strong></span>
                </div>
              </div>

              <h5 className="fw-bold text-dark mb-3 mt-4 d-flex align-items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7452bd" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
                  <line x1="16" x2="16" y1="2" y2="6"></line>
                  <line x1="8" x2="8" y1="2" y2="6"></line>
                  <line x1="3" x2="21" y1="10" y2="10"></line>
                </svg>
                Fecha y hora
              </h5>
              
              <div className="p-3 rounded-3" style={{ background: '#f1ecfa' }}>
                <div className="mb-2">
                  <span className="text-muted small d-block">Fecha</span>
                  <span className="fw-semibold text-dark">{formatearFecha(reserva.inicio)}</span>
                </div>
                <div>
                  <span className="text-muted small d-block">Horario</span>
                  <span className="fw-semibold text-dark">{formatearHora(reserva.inicio)} - {formatearHora(reserva.fin)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer de la tarjeta */}
          <div className="p-4 text-center border-top" style={{ borderColor: '#eeeaf5', background: '#fff' }}>
            <Link to="/reservas" className="btn-servia-secondary text-decoration-none px-4 py-2" style={{ borderRadius: '50px' }}>
              Volver a reservas
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}