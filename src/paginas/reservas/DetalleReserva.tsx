import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../../contextos/AuthContext';
import { api, ErrorApi } from '../../servicios/api';
import { mensajeDeError } from '../../servicios/mensajeDeError';
import { ESTADOS_CONFIG, formatearFecha, formatearHora, calcularTiempoRestante } from './estados';
import './Reservas.css';
import { CalendarCheck, Clock } from 'lucide-react';
import { EncabezadoPanel } from '../../componentes/panel/EncabezadoPanel';
import { EstadoError } from '../../componentes/panel/EstadosPanel';
import { BotonPanel } from '../../componentes/panel/BotonPanel';

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
        <EstadoError
          mensaje={error}
          onReintentar={cargarDetalle}
          accionSecundaria={<BotonPanel variante="secundario" to="/reservas">Volver a reservas</BotonPanel>}
        />
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
              <Clock aria-hidden="true" />
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

        <EncabezadoPanel
          grupo="operacion"
          icono={CalendarCheck}
          titulo={`Reserva ${reserva.folio}`}
          subtitulo="Revisa la información de la solicitud del cliente."
          acciones={
            <span className={`reserva-badge ${estadoConfig.className}`}>
              {estadoConfig.label}
            </span>
          }
        />

        {esPendienteVigente && (
          <div className="reserva-detalle-acciones">
            <button
              className="btn-servia-primary"
              onClick={() => { setErrorMotivo(''); setMostrarConfirmar(true); }}
            >
              Aceptar Reserva
            </button>
            <button
              className="btn-servia-danger"
              onClick={() => { setErrorMotivo(''); setMostrarRechazar(true); }}
            >
              Rechazar Solicitud
            </button>
          </div>
        )}

        <section className="panel-tarjeta reserva-detalle-tarjeta">
          <div className="reserva-detalle-grid">
            <div className="reserva-detalle-col reserva-detalle-col--inicio">
              <h5 className="reserva-detalle-subtitulo">Datos del cliente</h5>
              <div className="reserva-detalle-dato">
                <span className="reserva-detalle-etiqueta">Nombre completo</span>
                <span className="reserva-detalle-valor">{reserva.cliente.nombre || 'No especificado'}</span>
              </div>
              <div className="reserva-detalle-dato">
                <span className="reserva-detalle-etiqueta">Teléfono</span>
                {reserva.cliente.telefono ? <a href={`tel:${reserva.cliente.telefono}`} className="reserva-detalle-enlace">{reserva.cliente.telefono}</a> : <span className="panel-ayuda">No especificado</span>}
              </div>
              {reserva.cliente.correo && (
                <div className="reserva-detalle-dato">
                  <span className="reserva-detalle-etiqueta">Correo electrónico</span>
                  <a href={`mailto:${reserva.cliente.correo}`} className="reserva-detalle-enlace">{reserva.cliente.correo}</a>
                </div>
              )}
              <div className="reserva-detalle-seccion">
                <h6 className="reserva-detalle-subtitulo">Observaciones del cliente</h6>
                <p className="reserva-detalle-observaciones">{reserva.observaciones || 'Sin observaciones.'}</p>
              </div>
            </div>
            <div className="reserva-detalle-col">
              <h5 className="reserva-detalle-subtitulo">Detalles del servicio</h5>
              <div className="reserva-detalle-bloque">
                <span className="reserva-detalle-etiqueta">Servicio contratado</span>
                <span className="reserva-detalle-servicio-nombre">{reserva.servicio.nombre}</span>
                <div className="reserva-detalle-servicio-meta">
                  <span>Duración: <strong>{reserva.servicio.duracionMin} min</strong></span>
                  <span>Precio: <strong>${reserva.servicio.precio?.toFixed(2)}</strong></span>
                </div>
              </div>
              <div className="reserva-detalle-seccion">
                <h5 className="reserva-detalle-subtitulo">Fecha y hora</h5>
                <div className="reserva-detalle-bloque">
                  <div className="reserva-detalle-dato">
                    <span className="reserva-detalle-etiqueta">Fecha</span>
                    <span className="reserva-detalle-valor">{formatearFecha(reserva.inicio)}</span>
                  </div>
                  <div>
                    <span className="reserva-detalle-etiqueta">Horario</span>
                    <span className="reserva-detalle-valor">{formatearHora(reserva.inicio)} - {formatearHora(reserva.fin)}</span>
                  </div>
                </div>
              </div>
              {reserva.motivo && (
                <div className="reserva-detalle-motivo">
                  <h6>{reserva.estado === 'cancelada' ? 'Motivo de la cancelación' : 'Motivo del rechazo'}</h6>
                  <p>{reserva.motivo}</p>
                </div>
              )}
            </div>
          </div>
          <div className="reserva-detalle-pie">

            <Link to="/reservas" className="btn-servia-secondary">Volver a reservas</Link>

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
        </section>
      </div>

      {mostrarModal && (
        <div className="panel-dialogo-fondo" role="alertdialog" aria-modal="true">
          <div className="panel-dialogo">
            <h3 className="panel-dialogo-titulo">Cancelar reserva</h3>
            <p className="panel-dialogo-texto">
              El cliente verá este motivo. La reserva quedará cancelada, el horario se liberará y ya no podrá volver a confirmarse.
            </p>
            <div className="mb-3">
              <label htmlFor="motivo-cancelacion" className="form-label">Motivo de la cancelación *</label>
              <p id="ayuda-cancelacion" className="panel-ayuda">De {MOTIVO_MIN} a {MOTIVO_MAX} caracteres</p>
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
              <div className="reserva-dialogo-pie-campo">
                {errorMotivo && <div className="panel-alerta panel-alerta--error" role="alert"><div className="panel-alerta-contenido">{errorMotivo}</div></div>}
                <span id="contador-cancelacion" className="panel-ayuda">{motivo.trim().length}/{MOTIVO_MAX}</span>
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
            <p className="panel-dialogo-texto">
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
              <p id="ayuda-rechazo" className="panel-ayuda">De {MOTIVO_MIN} a {MOTIVO_MAX} caracteres</p>
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
              <div className="reserva-dialogo-pie-campo">
                {errorMotivo && <div className="panel-alerta panel-alerta--error" role="alert"><div className="panel-alerta-contenido">{errorMotivo}</div></div>}
                <span id="contador-rechazo" className="panel-ayuda">{motivoRechazo.trim().length}/{MOTIVO_MAX}</span>
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
