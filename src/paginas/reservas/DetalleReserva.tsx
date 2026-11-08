import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router';
import { api } from '../../servicios/api';
import { ESTADOS_CONFIG, formatearFecha, formatearHora, calcularTiempoRestante } from './estados';
import './Reservas.css'; // Para reusar los estilos

// Interfaz según lo que devuelve el backend
interface DetalleReservaAPI {
  id: string;
  folio: string;
  estado: string;
  inicio: string;
  fin: string;
  servicio: { nombre: string; precio: number; duracionMin: number };
  cliente: { nombre: string; telefono: string | null; correo?: string }; // Correo no viene en el test, pero la issue lo pide
  venceEn: string | null;
  segundosRestantes: number | null;
  motivo?: string;
  observaciones?: string;
}

export function DetalleReserva() {
  const { id } = useParams();
  const navigate = useNavigate();
  
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

  if (cargando) return <div className="text-center mt-5"><div className="spinner-border" style={{ color: '#9333ea' }}></div></div>;

  if (error) {
    return (
      <div className="reservas-page">
        <div className="reservas-container text-center py-5">
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
    <div className="reservas-page">
      <div className="reservas-container">
        
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="reservas-header h1 mb-0">Reserva {reserva.folio}</h1>
          <span className={`reserva-badge ${estadoConfig.className}`} style={{ fontSize: '14px', padding: '8px 16px' }}>
            {estadoConfig.label}
          </span>
        </div>

        {/* Cuenta regresiva si está pendiente */}
        {reserva.estado === 'pendiente' && reserva.segundosRestantes !== null && (
          <div className="alert alert-warning rounded-4 mb-4 text-center">
            <strong>⏱ Tiempo para responder:</strong> {calcularTiempoRestante(reserva.segundosRestantes)}
          </div>
        )}

        <div className="reservas-panel">
          <div className="row g-4">
            
            {/* Columna Izquierda: Datos de la reserva */}
            <div className="col-md-6">
              <div className="bg-light p-4 rounded-4 h-100">
                <h5 className="fw-bold mb-3 border-bottom pb-2">Detalles del servicio</h5>
                <p className="mb-2"><strong>Servicio:</strong> {reserva.servicio.nombre}</p>
                <p className="mb-2"><strong>Duración:</strong> {reserva.servicio.duracionMin} min</p>
                <p className="mb-4"><strong>Precio:</strong> ${reserva.servicio.precio?.toFixed(2)}</p>

                <h5 className="fw-bold mb-3 border-bottom pb-2">Fecha y hora</h5>
                <p className="mb-2"><strong>Fecha:</strong> {formatearFecha(reserva.inicio)}</p>
                <p className="mb-0"><strong>Horario:</strong> {formatearHora(reserva.inicio)} - {formatearHora(reserva.fin)}</p>
              </div>
            </div>

            {/* Columna Derecha: Datos del cliente */}
            <div className="col-md-6">
              <div className="bg-light p-4 rounded-4 h-100">
                <h5 className="fw-bold mb-3 border-bottom pb-2">Datos del cliente</h5>
                <p className="mb-2"><strong>Nombre:</strong> {reserva.cliente.nombre || 'No especificado'}</p>
                <p className="mb-2">
                  <strong>Teléfono:</strong> 
                  {reserva.cliente.telefono ? (
                    <a href={`tel:${reserva.cliente.telefono}`} className="ms-1">{reserva.cliente.telefono}</a>
                  ) : ' No especificado'}
                </p>
                {reserva.cliente.correo && (
                  <p className="mb-4">
                    <strong>Correo:</strong> 
                    <a href={`mailto:${reserva.cliente.correo}`} className="ms-1">{reserva.cliente.correo}</a>
                  </p>
                )}

                <h5 className="fw-bold mb-3 border-bottom pb-2">Observaciones</h5>
                <p className="text-muted mb-0">{reserva.observaciones || 'Sin observaciones.'}</p>

                {reserva.motivo && (
                  <>
                    <h5 className="fw-bold mb-3 border-bottom pb-2 mt-4 text-danger">Motivo</h5>
                    <p className="text-danger mb-0">{reserva.motivo}</p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 text-center border-top pt-4">
            <Link to="/reservas" className="btn-servia-secondary text-decoration-none px-4">
              Volver a reservas
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}