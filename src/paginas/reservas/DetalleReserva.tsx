import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../../contextos/AuthContext';
import { api, ErrorApi } from '../../servicios/api';
import { mensajeDeError } from '../../servicios/mensajeDeError';
import { ESTADOS_CONFIG, formatearFecha, formatearHora, calcularTiempoRestante } from './estados';
import './Reservas.css';
import { CalendarCheck } from 'lucide-react';
import { EyebrowPanel } from '../../componentes/panel/EyebrowPanel';

const MOTIVO_MIN = 20;
const MOTIVO_MAX = 500;

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
  const navigate = useNavigate();
  const { cerrarSesion } = useAuth();
  const [reserva, setReserva] = useState<DetalleReservaAPI | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // Modales y acciones
  const [mostrarCompletar, setMostrarCompletar] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [mostrarRechazar, setMostrarRechazar] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [errorMotivo, setErrorMotivo] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');
  const [mensajeError, setMensajeError] = useState('');

  const [ahora, setAhora] = useState(Date.now);
  const vencimientosConsultados = useRef(new Set<string>());

  const cargarDetalle = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await api<DetalleReservaAPI>(`/reservas/negocio/${id}`);
      setReserva(data);
    } catch (err: unknown) {
      if (err instanceof ErrorApi && err.estado === 404) {
        setError('No encontramos esta reserva.');
      } else {
        setError(mensajeDeError(err, 'No pudimos cargar la reserva. Intenta de nuevo.'));
      }
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(cargarDetalle);
  }, [cargarDetalle]);

  useEffect(() => {
    const temporizador = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(temporizador);
  }, []);

  const segundosRestantes = reserva?.venceEn
    ? Math.max(0, Math.ceil((Date.parse(reserva.venceEn) - ahora) / 1000))
    : reserva?.segundosRestantes ?? null;

  // RN-58/RN-59: la API decide el estado; consultar cada vencimiento una sola vez.
  useEffect(() => {
    if (cargando || error || reserva?.estado !== 'pendiente' || segundosRestantes === null || segundosRestantes > 0) return;
    const clave = `${id}:${reserva.venceEn ?? 'sin-plazo'}`;
    if (vencimientosConsultados.current.has(clave)) return;
    vencimientosConsultados.current.add(clave);
    void Promise.resolve().then(cargarDetalle);
  }, [cargando, error, reserva, segundosRestantes, id, cargarDetalle]);

  const validarMotivo = (texto: string, accion: string) => {
    const longitud = texto.trim().length;
    if (!longitud) return `Escribe el motivo ${accion}.`;
    if (longitud < MOTIVO_MIN) return `El motivo debe tener al menos ${MOTIVO_MIN} caracteres.`;
    if (longitud > MOTIVO_MAX) return `El motivo no puede exceder ${MOTIVO_MAX} caracteres.`;
    return '';
  };

  const iniciarAccion = () => {
    setProcesando(true);
    setErrorMotivo('');
    setMensajeError('');
    setMensajeExito('');
  };

  const mostrarErrorAccion = (err: unknown, completando = false) => {
    const mensaje = completando && err instanceof ErrorApi && err.estado === 404
      ? 'La reserva no existe.'
      : err instanceof ErrorApi ? err.message
      : completando ? 'No se pudo conectar. Inténtalo de nuevo.'
      : 'No pudimos guardar tu respuesta. Intenta de nuevo.';
    setMensajeError(mensaje);
    setErrorMotivo(mensaje);
    if (err instanceof ErrorApi && (err.estado === 409 || err.estado === 400)) {
      if (err.estado === 409) {
        setMostrarCompletar(false);
        setMostrarConfirmar(false);
        setMostrarRechazar(false);
        setMostrarModal(false);
      }
      void cargarDetalle();
    }
  };

  const handleCompletar = async () => {
    iniciarAccion();
    try {
      const detalle = await api<DetalleReservaAPI>(`/reservas/negocio/${id}/completar`, { method: 'PATCH' });
      setReserva(detalle);
      setMensajeExito('Reserva marcada como completada.');
      setMostrarCompletar(false);
    } catch (err: unknown) {
      if (err instanceof ErrorApi && err.estado === 401) {
        await cerrarSesion();
        navigate('/login', { replace: true });
      } else {
        mostrarErrorAccion(err, true);
      }
    } finally {
      setProcesando(false);
    }
  };

  const handleAceptar = async () => {
    iniciarAccion();
    try {
      await api(`/reservas/negocio/${id}/aceptar`, { method: 'PATCH' });
      setMensajeExito('Reserva confirmada.');
      setMostrarConfirmar(false);
      void cargarDetalle();
    } catch (err: unknown) {
      mostrarErrorAccion(err);
    } finally {
      setProcesando(false);
    }
  };

  const handleRechazar = async () => {
    const validacion = validarMotivo(motivoRechazo, 'del rechazo');
    if (validacion) {
      setErrorMotivo(validacion);
      return;
    }
    iniciarAccion();
    try {
      await api(`/reservas/negocio/${id}/rechazar`, {
        method: 'PATCH',
        body: JSON.stringify({ motivo: motivoRechazo.trim() }),
      });
      setMensajeExito('Solicitud rechazada. El horario quedó libre.');
      setMostrarRechazar(false);
      setMotivoRechazo('');
      void cargarDetalle();
    } catch (err: unknown) {
      mostrarErrorAccion(err);
    } finally {
      setProcesando(false);
    }
  };

  const handleCancelar = async () => {
    const validacion = validarMotivo(motivo, 'de la cancelación');
    if (validacion) {
      setErrorMotivo(validacion);
      return;
    }
    iniciarAccion();
    try {
      await api(`/reservas/negocio/${id}/cancelar`, {
        method: 'PATCH',
        body: JSON.stringify({ motivo: motivo.trim() }),
      });
      setMensajeExito('Reserva cancelada. El horario quedó libre.');
      setMostrarModal(false);
      setMotivo('');
      void cargarDetalle();
    } catch (err: unknown) {
      mostrarErrorAccion(err);
    } finally {
      setProcesando(false);
    }
  };

  // Cerrar los modales con Escape.
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMostrarCompletar(false);
        setMostrarConfirmar(false);
        setMostrarRechazar(false);
        setMostrarModal(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  if (cargando) return (
    <div className="panel-pagina"><div className="panel-contenedor panel-estado">
      <div className="spinner-border" role="status" aria-label="Cargando reserva" />
    </div></div>
  );

  if (error) {
    return (
      <div className="panel-pagina"><div className="panel-contenedor">
        <div className="panel-estado">
          <div className="panel-estado-icono panel-estado-icono--error" aria-hidden="true">!</div>
          <p className="panel-estado-texto" role="alert">{error}</p>
          <button className="btn-servia-primary" onClick={cargarDetalle}>Reintentar</button>
          <Link to="/reservas" className="btn-servia-secondary text-decoration-none">Volver a reservas</Link>
        </div>
      </div></div>
    );
  }

  if (!reserva) return null;
  const estadoConfig = ESTADOS_CONFIG[reserva.estado] || { label: reserva.estado, className: '' };

  const esPendienteVigente = reserva.estado === 'pendiente' && (segundosRestantes === null || segundosRestantes > 0);
  // RN-51/RN-54: solo una Confirmada iniciada se puede cerrar; usar el reloj vivo.
  const puedeCompletar = reserva.estado === 'confirmada' && Date.parse(reserva.inicio) <= ahora;
  const puedeCancelar = reserva.estado === 'confirmada' && Date.parse(reserva.inicio) > ahora;

  return (
    <div className="panel-pagina">
      <div className="panel-contenedor">

        {mensajeExito && (
          <div className="panel-alerta panel-alerta--exito" role="status">
            <div className="panel-alerta-contenido">{mensajeExito}</div>
          </div>
        )}

        {mensajeError && (
          <div className="panel-alerta panel-alerta--error" role="alert">
            <div className="panel-alerta-contenido">{mensajeError}</div>
          </div>
        )}

        {reserva.estado === 'pendiente' && segundosRestantes !== null && segundosRestantes > 0 && (
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
              {calcularTiempoRestante(segundosRestantes)}
            </span>
          </div>
        )}

        <header className="panel-encabezado d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
          <div>
            <EyebrowPanel grupo="operacion" icono={CalendarCheck} />
            <h1 className="panel-titulo mb-0">Reserva {reserva.folio}</h1>
            <p className="panel-subtitulo mt-1">Revisa la información de la solicitud del cliente.</p>
          </div>
          <span className={`reserva-badge ${estadoConfig.className}`}>
            {estadoConfig.label}
          </span>
        </header>

        {esPendienteVigente && (
          <div className="d-flex gap-3 mb-4">
            <button
              className="btn-servia-primary flex-grow-1"
              onClick={() => { setErrorMotivo(''); setMostrarConfirmar(true); }}
            >
              Aceptar Reserva
            </button>
            <button
              className="btn-servia-danger flex-grow-1"
              onClick={() => { setErrorMotivo(''); setMostrarRechazar(true); }}
            >
              Rechazar Solicitud
            </button>
          </div>
        )}

        <div className="panel-tarjeta p-0 overflow-hidden">
          <div className="row g-0">
            <div className="col-md-6 p-4 p-md-5 border-end">
              <h5 className="fw-bold text-dark mb-4 d-flex align-items-center gap-2">Datos del cliente</h5>
              <div className="mb-3"><span className="text-muted small d-block mb-1">Nombre completo</span><span className="fw-semibold fs-6 text-dark">{reserva.cliente.nombre || 'No especificado'}</span></div>
              <div className="mb-3"><span className="text-muted small d-block mb-1">Teléfono</span>{reserva.cliente.telefono ? <a href={`tel:${reserva.cliente.telefono}`} className="text-decoration-none fw-semibold" style={{ color: 'var(--sv-acento)' }}>{reserva.cliente.telefono}</a> : <span className="text-muted">No especificado</span>}</div>
              {reserva.cliente.correo && (<div className="mb-4"><span className="text-muted small d-block mb-1">Correo electrónico</span><a href={`mailto:${reserva.cliente.correo}`} className="text-decoration-none fw-semibold" style={{ color: 'var(--sv-acento)' }}>{reserva.cliente.correo}</a></div>)}
              <div className="mt-4 pt-4 border-top">
                <h6 className="fw-bold text-dark mb-2">Observaciones del cliente</h6>
                <p className="text-muted small mb-0 p-3 rounded-3">{reserva.observaciones || 'Sin observaciones.'}</p>
              </div>
            </div>
            <div className="col-md-6 p-4 p-md-5">
              <h5 className="fw-bold text-dark mb-4">Detalles del servicio</h5>
              <div className="mb-4 p-4 bg-white rounded-3 shadow-sm">
                <span className="text-muted small d-block mb-1">Servicio contratado</span>
                <span className="fw-bold fs-5 mb-3 d-block">{reserva.servicio.nombre}</span>
                <div className="d-flex justify-content-between text-muted small pt-2 border-top">
                  <span>Duración: <strong className="text-dark">{reserva.servicio.duracionMin} min</strong></span>
                  <span>Precio: <strong className="text-dark">${reserva.servicio.precio?.toFixed(2)}</strong></span>
                </div>
              </div>
              <h5 className="fw-bold text-dark mb-3 mt-4">Fecha y hora</h5>
              <div className="p-3 rounded-3">
                <div className="mb-2"><span className="text-muted small d-block">Fecha</span><span className="fw-semibold text-dark">{formatearFecha(reserva.inicio)}</span></div>
                <div><span className="text-muted small d-block">Horario</span><span className="fw-semibold text-dark">{formatearHora(reserva.inicio)} - {formatearHora(reserva.fin)}</span></div>
              </div>
              {reserva.motivo && (<div className="mt-4"><h6 className="fw-bold text-danger mb-2">{reserva.estado === 'cancelada' ? 'Motivo de la cancelación' : 'Motivo del rechazo'}</h6><p className="text-danger small mb-0 p-3 rounded-3">{reserva.motivo}</p></div>)}
            </div>
          </div>
          <div className="p-4 border-top d-flex flex-wrap justify-content-center gap-3">

            <Link to="/reservas" className="btn-servia-secondary text-decoration-none">Volver a reservas</Link>

            {puedeCompletar && (
              <button
                type="button"
                className="btn-servia-primary"
                onClick={() => { setErrorMotivo(''); setMostrarCompletar(true); }}
                disabled={procesando}
              >
                Marcar como completada
              </button>
            )}

            {puedeCancelar && (
              <button
                type="button"
                className="btn-servia-danger"
                onClick={() => { setErrorMotivo(''); setMostrarModal(true); }}
              >
                Cancelar reserva
              </button>
            )}
          </div>
        </div>
      </div>

      {mostrarModal && (
        <div className="panel-dialogo-fondo" role="alertdialog" aria-modal="true">
          <div className="panel-dialogo">
            <h3 className="panel-dialogo-titulo">Cancelar reserva</h3>
            <p className="text-muted small mb-4">
              El cliente verá este motivo. La reserva quedará cancelada, el horario se liberará y ya no podrá volver a confirmarse.
            </p>
            <div className="mb-3">
              <label htmlFor="motivo-cancelacion" className="form-label">Motivo de la cancelación *</label>
              <p id="ayuda-cancelacion" className="small text-muted">De {MOTIVO_MIN} a {MOTIVO_MAX} caracteres</p>
              <textarea
                className={`form-control ${errorMotivo ? 'is-invalid' : ''}`}
                rows={3}
                id="motivo-cancelacion"
                aria-describedby="ayuda-cancelacion contador-cancelacion"
                aria-invalid={!!errorMotivo}
                value={motivo}
                onChange={(e) => { setMotivo(e.target.value); setErrorMotivo(''); }}
                placeholder="Explica al cliente por qué se cancela la reserva..."
                disabled={procesando}
              ></textarea>
              <div className="d-flex justify-content-between mt-1">
                {errorMotivo && <div className="panel-alerta panel-alerta--error" role="alert"><div className="panel-alerta-contenido">{errorMotivo}</div></div>}
                <span id="contador-cancelacion" className="text-muted small">{motivo.trim().length}/{MOTIVO_MAX}</span>
              </div>
            </div>
            <div className="panel-dialogo-acciones">
              <button className="btn-servia-secondary" onClick={() => setMostrarModal(false)} disabled={procesando}>Volver</button>
              <button className="btn-servia-danger" onClick={handleCancelar} disabled={procesando}>
                {procesando ? 'Cancelando...' : 'Cancelar reserva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {(mostrarConfirmar || mostrarCompletar) && (
        <div className="panel-dialogo-fondo" role="alertdialog" aria-modal="true">
          <div className="panel-dialogo">
            <h3 className="panel-dialogo-titulo">{mostrarCompletar ? '¿Marcar esta reserva como completada? Ya no se podrá modificar.' : '¿Confirmar la reserva?'}</h3>
            <p className="text-muted mb-4">
              {mostrarCompletar ? <>Reserva <strong>{reserva.folio}</strong> de </> : '¿Confirmar la reserva de '}
              <strong>{reserva.cliente.nombre}</strong> el {formatearFecha(reserva.inicio)} a las {formatearHora(reserva.inicio)}{mostrarCompletar ? '.' : '?'}
            </p>
            {errorMotivo && <div className="panel-alerta panel-alerta--error" role="alert"><div className="panel-alerta-contenido">{errorMotivo}</div></div>}
            <div className="panel-dialogo-acciones">
              <button className="btn-servia-secondary" onClick={() => { setMostrarConfirmar(false); setMostrarCompletar(false); }} disabled={procesando}>Cancelar</button>
              <button className="btn-servia-primary" onClick={mostrarCompletar ? handleCompletar : handleAceptar} disabled={procesando}>
                {procesando ? 'Confirmando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RECHAZAR */}
      {mostrarRechazar && (
        <div className="panel-dialogo-fondo" role="alertdialog" aria-modal="true">
          <div className="panel-dialogo">
            <h3 className="panel-dialogo-titulo">Rechazar solicitud</h3>
            <div className="mb-3">
              <label htmlFor="motivo-rechazo" className="form-label">Motivo del rechazo *</label>
              <p id="ayuda-rechazo" className="small text-muted">De {MOTIVO_MIN} a {MOTIVO_MAX} caracteres</p>
              <textarea
                className={`form-control ${errorMotivo ? 'is-invalid' : ''}`}
                rows={3}
                id="motivo-rechazo"
                aria-describedby="ayuda-rechazo contador-rechazo"
                aria-invalid={!!errorMotivo}
                value={motivoRechazo}
                onChange={(e) => { setMotivoRechazo(e.target.value); setErrorMotivo(''); }}
                placeholder="Explica al cliente por qué no puedes aceptar la reserva..."
                disabled={procesando}
              ></textarea>
              <div className="d-flex justify-content-between mt-1">
                {errorMotivo && <div className="panel-alerta panel-alerta--error" role="alert"><div className="panel-alerta-contenido">{errorMotivo}</div></div>}
                <span id="contador-rechazo" className="text-muted small">{motivoRechazo.trim().length}/{MOTIVO_MAX}</span>
              </div>
            </div>
            <div className="panel-dialogo-acciones">
              <button className="btn-servia-secondary" onClick={() => setMostrarRechazar(false)} disabled={procesando}>Cancelar</button>
              <button className="btn-servia-danger" onClick={handleRechazar} disabled={procesando}>
                {procesando ? 'Rechazando...' : 'Rechazar solicitud'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
