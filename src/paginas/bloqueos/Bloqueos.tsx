import { useState, useEffect, useRef, type ReactNode, type FormEvent } from 'react';
import { CalendarOff } from 'lucide-react';
import { api, ErrorApi } from '../../servicios/api';
import { EstadoVacio } from '../../componentes/panel/EstadosPanel';
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
  const [alerta, setAlerta] = useState('');

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
  const [quitarId, setQuitarId] = useState<string | null>(null);
  const [quitando, setQuitando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState('');

  const cargarBloqueos = async () => {
    setCargando(true);
    setError('');
    try {
      const data = await api<Bloqueo[]>('/negocios/mio/bloqueos');
      setBloqueos(data);
    } catch {
      setError('No pudimos cargar tus bloqueos.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    let activo = true;
    // La carga inicial ya comienza en estado cargando; evita actualizaciones síncronas.
    api<Bloqueo[]>('/negocios/mio/bloqueos').then(
      (datos) => { if (activo) setBloqueos(datos); },
      () => { if (activo) setError('No pudimos cargar tus bloqueos.'); },
    ).finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, []);

  const validar = (): boolean => {
    const nuevosErrores: Record<string, string> = {};
    if (!fechaInicio) nuevosErrores.fechaInicio = 'Elige la fecha.';
    // RN-32: el formulario compara la fecha civil del negocio, no la del navegador.
    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    if (fechaInicio && (fechaInicio < hoy || (tipo === 'horas' && horaFin && new Date(`${fechaInicio}T${horaFin}:00-06:00`).getTime() <= Date.now()))) nuevosErrores.fechaInicio = 'No puedes bloquear fechas que ya pasaron.';
    if (motivo.length > 200) nuevosErrores.motivo = 'El motivo no puede tener más de 200 caracteres.';
    
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
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAlerta('');
    setErrorGuardar('');
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

      setAlerta('Bloqueo creado.');
      setFechaInicio('');
      setFechaFin('');
      setHoraInicio('');
      setHoraFin('');
      setMotivo('');
      cargarBloqueos();
    } catch (error: unknown) {
      if (error instanceof ErrorApi && error.estado === 409) {
        setReservasConflicto(leerReservas(error.datos));
        setMostrarConflicto(true);
      } else {
        setErrorGuardar('No pudimos guardar el bloqueo. Intenta de nuevo.');
      }
    } finally {
      setCreando(false);
    }
  };

  const handleQuitar = async () => {
    if (!quitarId || quitando) return;
    setQuitando(true);
    setErrorGuardar('');
    try {
      await api(`/negocios/mio/bloqueos/${quitarId}`, { method: 'DELETE' });
      setAlerta('Bloqueo quitado.');
      setQuitarId(null);
      await cargarBloqueos();
    } catch {
      setErrorGuardar('No pudimos quitar el bloqueo. Intenta de nuevo.');
      setQuitarId(null);
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
      <div className="panel-contenedor bloqueos-container" inert={mostrarConflicto || quitarId !== null}>

        <header className="panel-encabezado">
          <div>
            <span className="panel-eyebrow">OPERACIONES</span>
            <h1 className="panel-titulo">Bloqueos de horario</h1>
            <p className="panel-subtitulo">Administra los días u horas en los que no atenderás.</p>
          </div>
        </header>

        {alerta && <div role="status" className="panel-alerta panel-alerta--exito">{alerta}</div>}
        {error && <div role="alert" className="panel-alerta panel-alerta--error bloqueos-alerta-error">{error} <button className="btn-servia-secondary btn-servia-sm" onClick={() => void cargarBloqueos()}>Reintentar</button></div>}

        <div className="panel-tarjeta">
          <div className="bloqueos-grid">
            
            {/* FORMULARIO */}
            <div className="bloqueos-form">
              <h2 className="panel-tarjeta-titulo bloqueos-columna-titulo">Nuevo bloqueo</h2>
              <form onSubmit={handleSubmit} noValidate>
                {errorGuardar && <p role="alert" className="panel-alerta panel-alerta--error">{errorGuardar}</p>}
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
                  <input id="fechaInicio" aria-invalid={!!errores.fechaInicio} aria-describedby={errores.fechaInicio ? "error-fechaInicio" : undefined} type="date" className={`form-control ${errores.fechaInicio ? 'is-invalid' : ''}`} value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                  {errores.fechaInicio && <div id="error-fechaInicio" role="alert" className="invalid-feedback">{errores.fechaInicio}</div>}
                </div>

                {tipo === 'rango' && (
                  <div className="mb-3">
                    <label htmlFor="fechaFin" className="form-label">Hasta *</label>
                    <input id="fechaFin" aria-invalid={!!errores.fechaFin} aria-describedby={errores.fechaFin ? "error-fechaFin" : undefined} type="date" className={`form-control ${errores.fechaFin ? 'is-invalid' : ''}`} value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
                    {errores.fechaFin && <div id="error-fechaFin" role="alert" className="invalid-feedback">{errores.fechaFin}</div>}
                  </div>
                )}

                {tipo === 'horas' && (
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label htmlFor="horaInicio" className="form-label">De *</label>
                      <input id="horaInicio" aria-invalid={!!errores.horaInicio} aria-describedby={errores.horaInicio ? "error-horaInicio" : undefined} type="time" className={`form-control ${errores.horaInicio ? 'is-invalid' : ''}`} value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
                      {errores.horaInicio && <div id="error-horaInicio" role="alert" className="invalid-feedback">{errores.horaInicio}</div>}
                    </div>
                    <div className="col-6">
                      <label htmlFor="horaFin" className="form-label">A *</label>
                      <input id="horaFin" aria-invalid={!!errores.horaFin} aria-describedby={errores.horaFin ? "error-horaFin" : undefined} type="time" className={`form-control ${errores.horaFin ? 'is-invalid' : ''}`} value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
                      {errores.horaFin && <div id="error-horaFin" role="alert" className="invalid-feedback">{errores.horaFin}</div>}
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <label htmlFor="motivo" className="form-label">Motivo (opcional)</label>
                  <input id="motivo" aria-invalid={!!errores.motivo} aria-describedby={errores.motivo ? "error-motivo" : undefined} type="text" maxLength={200} className="form-control" placeholder="Ej. Vacaciones" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                  {errores.motivo && <p id="error-motivo" role="alert" className="panel-error-campo">{errores.motivo}</p>}
                </div>

                <button id="bloquear" type="submit" className="btn-servia-primary btn-servia-bloque" disabled={creando}>
                  {creando ? 'Creando...' : 'Bloquear'}
                </button>
              </form>
            </div>

            {/* LISTA DE BLOQUEOS */}
            <div className="bloqueos-list">
              <h2 className="panel-tarjeta-titulo bloqueos-columna-titulo">Tus bloqueos</h2>

              {cargando && <div className="panel-estado">
                <div className="spinner-border" aria-hidden="true" />
                <p className="panel-estado-texto">Cargando...</p>
              </div>}
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
                      <button onClick={() => setQuitarId(b.id)} className="btn-servia-danger btn-servia-sm">Quitar</button>
                    </div>
                  ); })}
                </div>
              )}
            </div>
          </div>
        </div>

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
                <button className="btn-servia-secondary" onClick={() => setMostrarConflicto(false)}>Entendido</button>
              </div>
          </Dialogo>
        )}
        {quitarId && <Dialogo titulo="Quitar bloqueo" cerrar={() => { if (!quitando) setQuitarId(null); }}>
          <p id="descripcion-dialogo" className="panel-dialogo-texto">¿Quitar este bloqueo? Los clientes podrán volver a reservar en ese periodo.</p>
          <div className="panel-dialogo-acciones">
            <button className="btn-servia-secondary" disabled={quitando} onClick={() => setQuitarId(null)}>Cancelar</button>
            <button className="btn-servia-danger" disabled={quitando} onClick={() => void handleQuitar()}>Quitar</button>
          </div>
        </Dialogo>}
    </div>
  );
}
