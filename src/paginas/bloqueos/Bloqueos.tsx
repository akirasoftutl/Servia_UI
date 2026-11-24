import { useState, useEffect, useRef, type ReactNode, type FormEvent } from 'react';
import { CalendarOff } from 'lucide-react';
import { api, ErrorApi } from '../../servicios/api';
import { alertaDeError, confirmar, exito } from '../../servicios/alertas';
import { mensajeDeError } from '../../servicios/mensajeDeError';
import { EstadoCargando, EstadoVacio } from '../../componentes/panel/EstadosPanel';
import { EncabezadoPanel } from '../../componentes/panel/EncabezadoPanel';
import { TarjetaPanel } from '../../componentes/panel/TarjetaPanel';
import { BotonPanel } from '../../componentes/panel/BotonPanel';
import { ErrorCampo } from '../../componentes/panel/ErrorCampo';
import {
  atributosErrorCampo,
  idErrorCampo,
  longitudMaxima,
  notificarErroresFormulario,
  validarFechaNoPasada,
} from '../../utilidades/validacion';
import './Bloqueos.css';

interface Bloqueo {
  id: string;
  inicio: string;
  fin: string;
  motivo: string | null;
}

interface ReservaConflicto {
  folio: string;
  inicio: string;
  servicio: { nombre: string };
  estado: string;
}

const ORDEN_CAMPOS = ['fechaInicio', 'fechaFin', 'horaInicio', 'horaFin', 'motivo'] as const;

// El cuerpo del ErrorApi es desconocido: validar el contrato antes de renderizarlo.
function leerReservas(datos: unknown): ReservaConflicto[] {
  if (!datos || typeof datos !== 'object' || !('reservas' in datos) || !Array.isArray(datos.reservas)) return [];
  return datos.reservas.filter((r): r is ReservaConflicto =>
    r && typeof r.folio === 'string' && typeof r.inicio === 'string' &&
    typeof r.servicio?.nombre === 'string' && typeof r.estado === 'string');
}

function Dialogo({ titulo, cerrar, children, amplio = false }: { titulo: string; cerrar: () => void; children: ReactNode; amplio?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      if (anterior?.isConnected) anterior.focus();
      else document.getElementById('bloquear')?.focus();
    };
  }, []);
  return <div className="panel-dialogo-fondo">
    <div ref={panel} role="alertdialog" aria-modal="true" aria-labelledby="titulo-dialogo" aria-describedby="descripcion-dialogo"
      className={`panel-dialogo ${amplio ? 'panel-dialogo--amplio' : ''}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); cerrar(); }
        if (e.key === 'Tab') {
          const botones = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
          const primero = botones[0];
          const ultimo = botones[botones.length - 1];
          if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo?.focus(); }
          else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero?.focus(); }
        }
      }}>
      <h2 id="titulo-dialogo" className="panel-dialogo-titulo">{titulo}</h2>{children}
    </div>
  </div>;
}

export function Bloqueos() {
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [tipo, setTipo] = useState<'dia' | 'rango' | 'horas'>('dia');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [motivo, setMotivo] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [creando, setCreando] = useState(false);

  const [reservasConflicto, setReservasConflicto] = useState<ReservaConflicto[]>([]);
  const [mostrarConflicto, setMostrarConflicto] = useState(false);
  const [quitando, setQuitando] = useState(false);

  const cargarBloqueos = async () => {
    setCargando(true);
    setError('');
    try {
      const data = await api<Bloqueo[]>('/negocios/mio/bloqueos');
      setBloqueos(data);
    } catch (causa: unknown) {
      setError(mensajeDeError(causa, 'No pudimos cargar tus bloqueos.'));
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    let activo = true;
    // La carga inicial ya comienza en estado cargando; evita actualizaciones síncronas.
    api<Bloqueo[]>('/negocios/mio/bloqueos').then(
      (datos) => { if (activo) setBloqueos(datos); },
      (causa: unknown) => { if (activo) setError(mensajeDeError(causa, 'No pudimos cargar tus bloqueos.')); },
    ).finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, []);

  const validar = (): boolean => {
    const nuevosErrores: Record<string, string> = {};
    if (!fechaInicio) nuevosErrores.fechaInicio = 'Elige la fecha.';
    // RN-32: el formulario compara la fecha civil del negocio, no la del navegador.
    const errPasada = validarFechaNoPasada(fechaInicio, {
      horaFin: tipo === 'horas' ? horaFin : undefined,
    });
    if (errPasada) nuevosErrores.fechaInicio = errPasada;

    const errMotivo = longitudMaxima(motivo, 200, 'El motivo no puede tener más de 200 caracteres.', true);
    if (errMotivo) nuevosErrores.motivo = errMotivo;

    if (tipo === 'rango') {
      if (!fechaFin) nuevosErrores.fechaFin = 'Elige la fecha.';
      else if (fechaFin < fechaInicio) nuevosErrores.fechaFin = 'La fecha final no puede ser anterior a la inicial.';
    }

    if (tipo === 'horas') {
      if (!horaInicio) nuevosErrores.horaInicio = 'Elige la hora de inicio.';
      if (!horaFin) nuevosErrores.horaFin = 'Elige la hora de fin.';
      else if (horaFin <= horaInicio) nuevosErrores.horaFin = 'La hora final debe ser posterior a la inicial.';
    }

    setErrores(nuevosErrores);
    return notificarErroresFormulario(nuevosErrores, ORDEN_CAMPOS, { mostrarAviso: true });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMostrarConflicto(false);
    setReservasConflicto([]);

    if (!validar()) return;

    setCreando(true);
    try {
      const payload: { fechaInicio: string; fechaFin?: string; horaInicio?: string; horaFin?: string; motivo?: string } = {
        fechaInicio,
        motivo: motivo.trim() || undefined,
      };

      if (tipo === 'rango') payload.fechaFin = fechaFin;
      if (tipo === 'horas') {
        payload.horaInicio = horaInicio;
        payload.horaFin = horaFin;
      }

      await api('/negocios/mio/bloqueos', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setFechaInicio('');
      setFechaFin('');
      setHoraInicio('');
      setHoraFin('');
      setMotivo('');
      await cargarBloqueos();
      await exito('Bloqueo creado.');
    } catch (error: unknown) {
      if (error instanceof ErrorApi && error.estado === 409) {
        setReservasConflicto(leerReservas(error.datos));
        setMostrarConflicto(true);
      } else {
        await alertaDeError(error, 'No pudimos guardar el bloqueo. Intenta de nuevo.');
      }
    } finally {
      setCreando(false);
    }
  };

  const handleQuitar = async (id: string) => {
    if (quitando) return;
    const aceptado = await confirmar({
      titulo: 'Quitar bloqueo',
      texto: '¿Quitar este bloqueo? Los clientes podrán volver a reservar en ese periodo.',
      confirmar: 'Quitar',
      cancelar: 'Cancelar',
      peligro: true,
    });
    if (!aceptado) return;

    setQuitando(true);
    try {
      await api(`/negocios/mio/bloqueos/${id}`, { method: 'DELETE' });
      await cargarBloqueos();
      await exito('Bloqueo quitado.');
    } catch (causa: unknown) {
      await alertaDeError(causa, 'No pudimos quitar el bloqueo. Intenta de nuevo.');
    } finally {
      setQuitando(false);
    }
  };

  // --- FUNCIONES DE FORMATEO DE FECHAS ---
  const formatearFecha = (fechaISO: string) => {
    if (!fechaISO) return '';
    const fecha = new Date(fechaISO);
    return fecha.toLocaleDateString('es-MX', {
      timeZone: 'America/Mexico_City',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatearHora = (fechaISO: string) => {
    if (!fechaISO) return '';
    const fecha = new Date(fechaISO);
    return fecha.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  };

  return (
    <div className="panel-pagina">
      <div className="panel-contenedor bloqueos-container" inert={mostrarConflicto}>

        <EncabezadoPanel
          grupo="negocio"
          icono={CalendarOff}
          titulo="Bloqueos de horario"
          subtitulo="Administra los días u horas en los que no atenderás."
        />

        {error && <div role="alert" className="panel-alerta panel-alerta--error bloqueos-alerta-error">{error} <BotonPanel variante="secundario" tamano="sm" onClick={() => void cargarBloqueos()}>Reintentar</BotonPanel></div>}

        <TarjetaPanel>
          <div className="bloqueos-grid">
            
            {/* FORMULARIO */}
            <div className="bloqueos-form">
              <h2 className="panel-tarjeta-titulo bloqueos-columna-titulo">Nuevo bloqueo</h2>
              <form onSubmit={handleSubmit} noValidate>
                <div className="mb-3">
                  <label htmlFor="tipo" className="form-label">Tipo de bloqueo</label>
                  <select id="tipo" className="form-select" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
                    <option value="dia">Día completo</option>
                    <option value="rango">Varios días</option>
                    <option value="horas">Unas horas</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label htmlFor="fechaInicio" className="form-label">{tipo === 'rango' ? 'Desde *' : 'Fecha *'}</label>
                  <input id="fechaInicio" {...atributosErrorCampo('fechaInicio', errores.fechaInicio)} type="date" className={`form-control ${errores.fechaInicio ? 'is-invalid' : ''}`} value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                  <ErrorCampo id={idErrorCampo('fechaInicio')} mensaje={errores.fechaInicio} />
                </div>

                {tipo === 'rango' && (
                  <div className="mb-3">
                    <label htmlFor="fechaFin" className="form-label">Hasta *</label>
                    <input id="fechaFin" {...atributosErrorCampo('fechaFin', errores.fechaFin)} type="date" className={`form-control ${errores.fechaFin ? 'is-invalid' : ''}`} value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
                    <ErrorCampo id={idErrorCampo('fechaFin')} mensaje={errores.fechaFin} />
                  </div>
                )}

                {tipo === 'horas' && (
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label htmlFor="horaInicio" className="form-label">De *</label>
                      <input id="horaInicio" {...atributosErrorCampo('horaInicio', errores.horaInicio)} type="time" className={`form-control ${errores.horaInicio ? 'is-invalid' : ''}`} value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
                      <ErrorCampo id={idErrorCampo('horaInicio')} mensaje={errores.horaInicio} />
                    </div>
                    <div className="col-6">
                      <label htmlFor="horaFin" className="form-label">A *</label>
                      <input id="horaFin" {...atributosErrorCampo('horaFin', errores.horaFin)} type="time" className={`form-control ${errores.horaFin ? 'is-invalid' : ''}`} value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
                      <ErrorCampo id={idErrorCampo('horaFin')} mensaje={errores.horaFin} />
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <label htmlFor="motivo" className="form-label">Motivo (opcional)</label>
                  <input id="motivo" {...atributosErrorCampo('motivo', errores.motivo)} type="text" maxLength={200} className="form-control" placeholder="Ej. Vacaciones" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                  <ErrorCampo id={idErrorCampo('motivo')} mensaje={errores.motivo} />
                </div>

                <BotonPanel id="bloquear" type="submit" variante="primario" bloque disabled={creando}>
                  {creando ? 'Creando...' : 'Bloquear'}
                </BotonPanel>
              </form>
            </div>

            {/* LISTA DE BLOQUEOS */}
            <div className="bloqueos-list">
              <h2 className="panel-tarjeta-titulo bloqueos-columna-titulo">Tus bloqueos</h2>

              {cargando && <EstadoCargando mensaje="Cargando..." />}
              {!cargando && !error && bloqueos.length === 0 && <EstadoVacio
                icono={CalendarOff}
                titulo="Tu agenda no tiene bloqueos"
                texto="Cuando necesites cerrar una fecha u hora, crea un bloqueo en el formulario."
              />}

              {!cargando && !error && bloqueos.length > 0 && (
                <div className="panel-lista">
                  {bloqueos.map((b) => {
                    const completo = formatearHora(b.inicio) === '00:00' && formatearHora(b.fin) === '00:00';
                    // La API devuelve fin exclusivo; para días completos mostrar el último día incluido.
                    const finVisible = completo ? new Date(new Date(b.fin).getTime() - 1).toISOString() : b.fin;
                    return (
                    <div key={b.id} className="panel-item bloqueo-card">
                      <div className="bloqueo-info">
                        <h3 className="panel-item-titulo">
                          {formatearFecha(b.inicio)}
                          {formatearFecha(b.inicio) !== formatearFecha(finVisible) && ` - ${formatearFecha(finVisible)}`}
                        </h3>
                        <p className="panel-item-texto">
                          {/* Los límites a medianoche representan días completos. */}
                          {!completo
                            ? `${formatearHora(b.inicio)} a ${formatearHora(b.fin)}`
                            : 'Día(s) completo(s)'
                          }
                          {b.motivo && ` · ${b.motivo}`}
                        </p>
                      </div>
                      <BotonPanel variante="peligro" tamano="sm" disabled={quitando} onClick={() => void handleQuitar(b.id)}>Quitar</BotonPanel>
                    </div>
                  ); })}
                </div>
              )}
            </div>
          </div>
        </TarjetaPanel>

      </div>
        {/* MODAL DE CONFLICTO 409 */}
        {mostrarConflicto && (
          <Dialogo amplio titulo="No se puede bloquear" cerrar={() => setMostrarConflicto(false)}>
              <p id="descripcion-dialogo" className="panel-dialogo-texto">No se puede bloquear este periodo porque tiene reservas activas. Recházalas o cancélalas primero:</p>
              <div className="panel-tabla-contenedor">
                <table className="panel-tabla">
                  <thead>
                    <tr><th>Folio</th><th>Fecha</th><th>Hora</th><th>Servicio</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    {reservasConflicto.map((r, i) => (
                      <tr key={i}><td>{r.folio}</td><td>{formatearFecha(r.inicio)}</td><td>{formatearHora(r.inicio)}</td><td>{r.servicio.nombre}</td><td>{r.estado === 'pendiente' ? 'Pendiente' : r.estado === 'confirmada' ? 'Confirmada' : r.estado}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="panel-dialogo-acciones">
                <BotonPanel variante="secundario" onClick={() => setMostrarConflicto(false)}>Entendido</BotonPanel>
              </div>
          </Dialogo>
        )}
    </div>
  );
}
