import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAuth } from '../../contextos/AuthContext';
import { api, ErrorApi } from '../../servicios/api';
import { alertaDeError, confirmar, error as alertaError, exito, hayAlertaAbierta } from '../../servicios/alertas';
import { mensajeDeError } from '../../servicios/mensajeDeError';
import { ESTADOS_CONFIG, formatearFecha, formatearHora, calcularTiempoRestante } from './estados';
import { ErrorCampo } from '../../componentes/panel/ErrorCampo';
import { atributosErrorCampo, idErrorCampo, validarMotivo } from '../../utilidades/validacion';
import './Reservas.css';
import { CalendarCheck, Clock } from 'lucide-react';
import { EncabezadoPanel } from '../../componentes/panel/EncabezadoPanel';
import { EstadoError } from '../../componentes/panel/EstadosPanel';
import { BotonPanel } from '../../componentes/panel/BotonPanel';
import { EtiquetaEstado } from '../../componentes/panel/EtiquetaEstado';

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

  // Modales con campo de motivo y estado de envío
  const [mostrarRechazar, setMostrarRechazar] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [errorMotivo, setErrorMotivo] = useState('');
  const [procesando, setProcesando] = useState(false);
  const enProceso = useRef(false);

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

  const iniciarAccion = () => {
    setProcesando(true);
    setErrorMotivo('');
  };

  const mostrarErrorAccion = async (err: unknown, completando = false) => {
    if (err instanceof ErrorApi && (err.estado === 409 || err.estado === 400)) {
      if (err.estado === 409) {
        setMostrarRechazar(false);
        setMostrarModal(false);
      }
      void cargarDetalle();
    }
    if (completando && err instanceof ErrorApi && err.estado === 404) {
      await alertaError('La reserva no existe.');
      return;
    }
    await alertaDeError(
      err,
      completando
        ? 'No se pudo conectar. Inténtalo de nuevo.'
        : 'No pudimos guardar tu respuesta. Intenta de nuevo.',
    );
  };

  const handleCompletar = async () => {
    if (!reserva || procesando || enProceso.current) return;
    enProceso.current = true;
    try {
      const aceptado = await confirmar({
        titulo: '¿Marcar esta reserva como completada? Ya no se podrá modificar.',
        texto: `Reserva ${reserva.folio} de ${reserva.cliente.nombre} el ${formatearFecha(reserva.inicio)} a las ${formatearHora(reserva.inicio)}.`,
        confirmar: 'Confirmar',
        cancelar: 'Cancelar',
      });
      if (!aceptado) return;

      iniciarAccion();
      try {
        const detalle = await api<DetalleReservaAPI>(`/reservas/negocio/${id}/completar`, { method: 'PATCH' });
        setReserva(detalle);
        await exito('Reserva marcada como completada.');
      } catch (err: unknown) {
        if (err instanceof ErrorApi && err.estado === 401) {
          await cerrarSesion();
          navigate('/login', { replace: true });
        } else {
          await mostrarErrorAccion(err, true);
        }
      } finally {
        setProcesando(false);
      }
    } finally {
      enProceso.current = false;
    }
  };

  const handleAceptar = async () => {
    if (!reserva || procesando || enProceso.current) return;
    enProceso.current = true;
    try {
      const aceptado = await confirmar({
        titulo: '¿Confirmar la reserva?',
        texto: `¿Confirmar la reserva de ${reserva.cliente.nombre} el ${formatearFecha(reserva.inicio)} a las ${formatearHora(reserva.inicio)}?`,
        confirmar: 'Confirmar',
        cancelar: 'Cancelar',
      });
      if (!aceptado) return;

      iniciarAccion();
      try {
        await api(`/reservas/negocio/${id}/aceptar`, { method: 'PATCH' });
        void cargarDetalle();
        await exito('Reserva confirmada.');
      } catch (err: unknown) {
        await mostrarErrorAccion(err);
      } finally {
        setProcesando(false);
      }
    } finally {
      enProceso.current = false;
    }
  };

  const handleRechazar = async () => {
    const validacion = validarMotivo(motivoRechazo, 'del rechazo', MOTIVO_MIN, MOTIVO_MAX);
    if (validacion) {
      setErrorMotivo(validacion);
      document.getElementById('motivo-rechazo')?.focus();
      return;
    }
    iniciarAccion();
    try {
      await api(`/reservas/negocio/${id}/rechazar`, {
        method: 'PATCH',
        body: JSON.stringify({ motivo: motivoRechazo.trim() }),
      });
      setMostrarRechazar(false);
      setMotivoRechazo('');
      void cargarDetalle();
      await exito('Solicitud rechazada. El horario quedó libre.');
    } catch (err: unknown) {
      await mostrarErrorAccion(err);
    } finally {
      setProcesando(false);
    }
  };

  const handleCancelar = async () => {
    const validacion = validarMotivo(motivo, 'de la cancelación', MOTIVO_MIN, MOTIVO_MAX);
    if (validacion) {
      setErrorMotivo(validacion);
      document.getElementById('motivo-cancelacion')?.focus();
      return;
    }
    iniciarAccion();
    try {
      await api(`/reservas/negocio/${id}/cancelar`, {
        method: 'PATCH',
        body: JSON.stringify({ motivo: motivo.trim() }),
      });
      setMostrarModal(false);
      setMotivo('');
      void cargarDetalle();
      await exito('Reserva cancelada. El horario quedó libre.');
    } catch (err: unknown) {
      await mostrarErrorAccion(err);
    } finally {
      setProcesando(false);
    }
  };

  // Cerrar los modales de motivo con Escape solo si no hay una alerta abierta de SweetAlert2.
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || procesando || hayAlertaAbierta()) {
        return;
      }
      setMostrarRechazar(false);
      setMostrarModal(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [procesando]);

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
  const estadoConfig = ESTADOS_CONFIG[reserva.estado] || { label: reserva.estado, className: '', tono: 'neutro' as const };

  const esPendienteVigente = reserva.estado === 'pendiente' && (segundosRestantes === null || segundosRestantes > 0);
  // RN-51/RN-54: solo una Confirmada iniciada se puede cerrar; usar el reloj vivo.
  const puedeCompletar = reserva.estado === 'confirmada' && Date.parse(reserva.inicio) <= ahora;
  const puedeCancelar = reserva.estado === 'confirmada' && Date.parse(reserva.inicio) > ahora;

  return (
    <div className="panel-pagina">
      <div className="panel-contenedor">

        {reserva.estado === 'pendiente' && segundosRestantes !== null && segundosRestantes > 0 && (
          <div className="panel-alerta panel-alerta--aviso" role="status">
            <span className="panel-alerta-icono" aria-hidden="true">
              <Clock aria-hidden="true" />
            </span>
            <div className="panel-alerta-contenido">
              <strong>Tiempo para responder</strong>
              <p>Responde antes de que venza la solicitud para no perder el horario.</p>
            </div>
            <EtiquetaEstado
              texto={calcularTiempoRestante(segundosRestantes)}
              tono="aviso"
              className="panel-alerta-accion"
            />
          </div>
        )}

        <EncabezadoPanel
          grupo="operacion"
          icono={CalendarCheck}
          titulo={`Reserva ${reserva.folio}`}
          subtitulo="Revisa la información de la solicitud del cliente."
          acciones={
            <EtiquetaEstado
              texto={estadoConfig.label}
              tono={estadoConfig.tono}
              className={`reserva-badge ${estadoConfig.className}`.trim()}
            />
          }
        />

        {esPendienteVigente && (
          <div className="reserva-detalle-acciones">
            <BotonPanel
              variante="primario"
              disabled={procesando}
              onClick={() => void handleAceptar()}
            >
              Aceptar Reserva
            </BotonPanel>
            <BotonPanel
              variante="peligro"
              disabled={procesando}
              onClick={() => { setErrorMotivo(''); setMostrarRechazar(true); }}
            >
              Rechazar Solicitud
            </BotonPanel>
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

            <BotonPanel variante="secundario" to="/reservas">Volver a reservas</BotonPanel>

            {puedeCompletar && (
              <BotonPanel
                variante="primario"
                onClick={() => void handleCompletar()}
                disabled={procesando}
              >
                {procesando ? 'Confirmando...' : 'Marcar como completada'}
              </BotonPanel>
            )}

            {puedeCancelar && (
              <BotonPanel
                variante="peligro"
                onClick={() => { setErrorMotivo(''); setMostrarModal(true); }}
                disabled={procesando}
              >
                Cancelar reserva
              </BotonPanel>
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
                {...atributosErrorCampo('motivo-cancelacion', errorMotivo, 'ayuda-cancelacion contador-cancelacion')}
                value={motivo}
                onChange={(e) => { setMotivo(e.target.value); setErrorMotivo(''); }}
                placeholder="Explica al cliente por qué se cancela la reserva..."
                disabled={procesando}
              ></textarea>
              <div className="reserva-dialogo-pie-campo">
                <ErrorCampo id={idErrorCampo('motivo-cancelacion')} mensaje={errorMotivo} />
                <span id="contador-cancelacion" className="panel-ayuda">{motivo.trim().length}/{MOTIVO_MAX}</span>
              </div>
            </div>
            <div className="panel-dialogo-acciones">
              <BotonPanel variante="secundario" onClick={() => setMostrarModal(false)} disabled={procesando}>Volver</BotonPanel>
              <BotonPanel variante="peligro" onClick={() => void handleCancelar()} disabled={procesando}>
                {procesando ? 'Cancelando...' : 'Cancelar reserva'}
              </BotonPanel>
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
                {...atributosErrorCampo('motivo-rechazo', errorMotivo, 'ayuda-rechazo contador-rechazo')}
                value={motivoRechazo}
                onChange={(e) => { setMotivoRechazo(e.target.value); setErrorMotivo(''); }}
                placeholder="Explica al cliente por qué no puedes aceptar la reserva..."
                disabled={procesando}
              ></textarea>
              <div className="reserva-dialogo-pie-campo">
                <ErrorCampo id={idErrorCampo('motivo-rechazo')} mensaje={errorMotivo} />
                <span id="contador-rechazo" className="panel-ayuda">{motivoRechazo.trim().length}/{MOTIVO_MAX}</span>
              </div>
            </div>
            <div className="panel-dialogo-acciones">
              <BotonPanel variante="secundario" onClick={() => setMostrarRechazar(false)} disabled={procesando}>Cancelar</BotonPanel>
              <BotonPanel variante="peligro" onClick={() => void handleRechazar()} disabled={procesando}>
                {procesando ? 'Rechazando...' : 'Rechazar solicitud'}
              </BotonPanel>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
