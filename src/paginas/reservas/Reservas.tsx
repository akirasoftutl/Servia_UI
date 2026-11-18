import { useState, useEffect, useRef } from 'react';
import { api } from '../../servicios/api';
import './Reservas.css';
import { useNavigate } from 'react-router';

const estados = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada', 
  rechazada: 'Rechazada',
  rechazada_vencimiento: 'Rechazada por vencimiento',
  cancelada: 'Cancelada',
  completada: 'Completada',
};
type Estado = keyof typeof estados;
interface Reserva {
  id: string;
  folio: string;
  cliente: { nombre: string; telefono: string | null };
  servicio: { id: string; nombre: string; precio: number | null; duracionMin: number | null };
  inicio: string;
  fin: string;
  estado: Estado;
  venceEn: string | null;
  segundosRestantes: number | null;
}
interface Pagina { items: Reserva[]; siguiente: string | null }
type Pestana = 'pendientes' | 'proximas';
const zonaHoraria = 'America/Mexico_City';
const fecha = new Intl.DateTimeFormat('es-MX', { timeZone: zonaHoraria, dateStyle: 'short' });
const hora = new Intl.DateTimeFormat('es-MX', { timeZone: zonaHoraria, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

function tiempoRestante(venceEn: string, ahora: number) {
  const segundos = Math.max(0, Math.ceil((Date.parse(venceEn) - ahora) / 1000));
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  return `${horas > 0 ? `${horas}h ` : ''}${minutos}m ${segundos % 60}s restantes`;
}

export function Reservas() {
  const navigate = useNavigate(); // <-- LÍNEA AGREGADA

  const [consulta, setConsulta] = useState({ pestana: 'pendientes' as Pestana, estado: '', fecha: '', cursores: [''] });
  const [pagina, setPagina] = useState<Pagina>({ items: [], siguiente: null });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [ahora, setAhora] = useState(Date.now);
  const vencimientosConsultados = useRef(new Set<string>());
  const { pestana, estado: filtroEstado, fecha: filtroFecha, cursores } = consulta;

  // Recepción de reservas (antes vivía en el Layout).
  const [aceptaReservas, setAceptaReservas] = useState<boolean | null>(null);
  const [cargandoRecepcion, setCargandoRecepcion] = useState(false);
  const [errorCargaRecepcion, setErrorCargaRecepcion] = useState(false);
  const [reintentoRecepcion, setReintentoRecepcion] = useState(0);
  const [mensajeReservas, setMensajeReservas] = useState('');
  const [errorCambio, setErrorCambio] = useState(false);
  const [mostrarModalPausa, setMostrarModalPausa] = useState(false);
  const solicitudRecepcion = useRef({ version: 0 });
  const interruptor = useRef<HTMLInputElement>(null);
  const dialogo = useRef<HTMLDivElement>(null);
  const cancelar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let vigente = true;
    const parametros = new URLSearchParams();
    if (pestana === 'proximas') parametros.set('vista', 'proximas');
    if (filtroEstado) parametros.set('estado', filtroEstado);
    if (filtroFecha) {
      parametros.set('desde', filtroFecha);
      parametros.set('hasta', filtroFecha);
    }
    const cursor = cursores[cursores.length - 1];
    if (cursor) parametros.set('cursor', cursor);
    const cargar = async () => {
      await Promise.resolve();
      if (!vigente) return;
      setCargando(true);
      setError('');
      return api<Pagina>(`/reservas/negocio?${parametros}`);
    };
    cargar().then((datos) => {
      if (vigente && datos) setPagina(datos);
    }).catch(() => {
      if (vigente) setError('No pudimos cargar las reservas. Intenta de nuevo.');
    }).finally(() => {
      if (vigente) setCargando(false);
    });
    return () => { vigente = false; };
  }, [pestana, filtroEstado, filtroFecha, cursores, revision]);

  useEffect(() => {
    const temporizador = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(temporizador);
  }, []);

  useEffect(() => {
    if (cargando || error) return;
    const pendientes = pagina.items.filter((r) => r.estado === 'pendiente' && r.venceEn &&
      !vencimientosConsultados.current.has(`${r.id}:${r.venceEn}`));
    if (pendientes.length === 0) return;
    const proximoVencimiento = Math.min(...pendientes.map((r) => Date.parse(r.venceEn!)));
    const temporizador = window.setTimeout(() => {
      pendientes.filter((r) => Date.parse(r.venceEn!) <= Date.now()).forEach((r) =>
        vencimientosConsultados.current.add(`${r.id}:${r.venceEn}`));
      setConsulta((actual) => ({ ...actual, cursores: [''] }));
    }, Math.max(0, proximoVencimiento - Date.now()));
    return () => window.clearTimeout(temporizador);
  }, [pagina, cargando, error]);

  function cambiarPestana(nueva: Pestana) {
    setConsulta((actual) => ({ ...actual, pestana: nueva,
      estado: nueva === 'proximas' ? 'confirmada' : '', cursores: [''] }));
  }

  useEffect(() => {
    const solicitudes = solicitudRecepcion.current;
    const actual = ++solicitudes.version;
    api<{ aceptaReservas: boolean }>('/negocios/mio')
      .then((perfil) => {
        if (actual !== solicitudes.version) return;
        if (typeof perfil.aceptaReservas !== 'boolean') throw new Error('Estado desconocido');
        setAceptaReservas(perfil.aceptaReservas);
      })
      .catch(() => {
        if (actual === solicitudes.version) setErrorCargaRecepcion(true);
      });
    return () => { solicitudes.version++; };
  }, [reintentoRecepcion]);

  useEffect(() => {
    if (!mostrarModalPausa) return;
    const origen = interruptor.current;
    cancelar.current?.focus();
    return () => { origen?.focus(); };
  }, [mostrarModalPausa]);

  useEffect(() => {
    if (mostrarModalPausa && cargandoRecepcion) dialogo.current?.focus();
  }, [mostrarModalPausa, cargandoRecepcion]);

  const cambiarRecepcion = async (nuevoEstado: boolean) => {
    if (aceptaReservas === null || cargandoRecepcion) return;
    const actual = ++solicitudRecepcion.current.version;
    setCargandoRecepcion(true);
    setMensajeReservas('');
    setErrorCambio(false);
    try {
      await api('/negocios/mio/recepcion-reservas', {
        method: 'PATCH',
        body: JSON.stringify({ aceptaReservas: nuevoEstado }),
      });
      if (actual !== solicitudRecepcion.current.version) return;
      setAceptaReservas(nuevoEstado);
      setMensajeReservas(nuevoEstado ? 'Reservas reanudadas.' : 'Reservas pausadas.');
      setMostrarModalPausa(false);
    } catch {
      if (actual !== solicitudRecepcion.current.version) return;
      setErrorCambio(true);
      setMensajeReservas('No pudimos cambiar la recepción de reservas. Intenta de nuevo.');
    } finally {
      if (actual === solicitudRecepcion.current.version) setCargandoRecepcion(false);
    }
  };

  const handleToggleReservas = (nuevoEstado: boolean) => {
    if (aceptaReservas === null || cargandoRecepcion) return;
    if (nuevoEstado) void cambiarRecepcion(true);
    else {
      setMensajeReservas('');
      setErrorCambio(false);
      setMostrarModalPausa(true);
    }
  };

  return (
    <>
    <div className="panel-pagina" inert={mostrarModalPausa}><div className="panel-contenedor">
      <header className="panel-encabezado">
        <div>
          <span className="panel-eyebrow">ADMINISTRACIÓN</span>
          <h1 className="panel-titulo">Reservas</h1>
          <p className="panel-subtitulo">Administra las solicitudes de tus clientes.</p>
        </div>
      </header>

      <section className="panel-tarjeta reservas-recepcion">
        <div className="reservas-recepcion-cuerpo">
          <span className="panel-alerta-icono" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </span>
          <div className="reservas-recepcion-textos">
            <h2 className="panel-tarjeta-titulo mb-1">Recepción de reservas</h2>
            <p id="estadoRecepcion" className="panel-tarjeta-subtitulo mb-0">
              {aceptaReservas === null
                ? (errorCargaRecepcion ? 'Estado de recepción desconocido.' : 'Cargando recepción de reservas...')
                : aceptaReservas
                ? 'Tus clientes pueden agendar citas contigo.'
                : 'Los clientes ven tu perfil, pero no pueden agendar.'}
            </p>
          </div>
        </div>

        <div className="reservas-recepcion-control">
          {mensajeReservas && !mostrarModalPausa && (
            <span role={errorCambio ? 'alert' : 'status'} className={`reservas-recepcion-mensaje${errorCambio ? ' reservas-recepcion-mensaje--error' : ''}`}>
              {mensajeReservas}
            </span>
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
              disabled={cargandoRecepcion || aceptaReservas === null}
            />
            <label className="form-check-label" htmlFor="switchReservas">
              Recibir reservas
            </label>
          </div>
        </div>

        {errorCargaRecepcion && (
          <div role="alert" className="panel-alerta panel-alerta--error mt-3 mb-0">
            <span className="panel-alerta-icono" aria-hidden="true">!</span>
            <div className="panel-alerta-contenido">
              <strong>No pudimos cargar la recepción de reservas.</strong>
              <p>Intenta de nuevo para consultar el estado actual.</p>
            </div>
            <button className="btn-servia-secondary btn-servia-sm panel-alerta-accion" onClick={() => {
              setErrorCargaRecepcion(false);
              setReintentoRecepcion((valor) => valor + 1);
            }}>
              Reintentar
            </button>
          </div>
        )}

        {aceptaReservas === false && (
          <div className="panel-alerta panel-alerta--aviso mt-3 mb-0">
            <span className="panel-alerta-icono" aria-hidden="true">⏸</span>
            <div className="panel-alerta-contenido">
              <strong>Pausaste las reservas</strong>
              <p>Los clientes no pueden pedir reservas nuevas.</p>
            </div>
            <button
              className="btn-servia-secondary btn-servia-sm panel-alerta-accion"
              onClick={() => handleToggleReservas(true)}
              disabled={cargandoRecepcion || aceptaReservas === null}
            >
              Reanudar
            </button>
          </div>
        )}
      </section>

      <section className="panel-tarjeta">
        <div className="reservas-filtros">
          <div>
            <label htmlFor="reservas-fecha" className="form-label">Fecha</label>
            <input id="reservas-fecha" type="date" className="form-control" value={filtroFecha}
              onChange={(e) => setConsulta({ ...consulta, fecha: e.target.value, cursores: [''] })} />
          </div>
          <div>
            <label htmlFor="reservas-estado" className="form-label">Estado</label>
            <select id="reservas-estado" className="form-select" value={filtroEstado} disabled={pestana === 'proximas'}
              onChange={(e) => setConsulta({ ...consulta, estado: e.target.value, cursores: [''] })}>
              <option value="">Todos</option>
              {Object.entries(estados).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
            </select>
          </div>
        </div>
        <div className="panel-pestanas" role="tablist" aria-label="Vistas de reservas">
          {(['pendientes', 'proximas'] as const).map((vista) => (
            <button key={vista} id={`tab-${vista}`} role="tab" aria-selected={pestana === vista}
              aria-controls="panel-reservas" tabIndex={pestana === vista ? 0 : -1}
              className={pestana === vista ? 'active' : ''} onClick={() => cambiarPestana(vista)}
              onKeyDown={(e) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
                e.preventDefault();
                const nueva = e.key === 'Home' ? 'pendientes' : e.key === 'End' ? 'proximas' : vista === 'pendientes' ? 'proximas' : 'pendientes';
                cambiarPestana(nueva);
                document.getElementById(`tab-${nueva}`)?.focus();
              }}>{vista === 'pendientes' ? 'Pendientes' : 'Próximas'}</button>
          ))}
        </div>
        <div id="panel-reservas" role="tabpanel" aria-labelledby={`tab-${pestana}`} aria-busy={cargando}>
          {cargando && <div className="panel-estado">
            <div className="spinner-border" aria-hidden="true" />
            <p className="panel-estado-texto" role="status">Cargando reservas...</p>
          </div>}
          {!cargando && error && <div className="panel-estado">
            <div className="panel-estado-icono panel-estado-icono--error" aria-hidden="true">!</div>
            <p className="panel-estado-texto" role="alert">{error}</p>
            <button className="btn-servia-primary" onClick={() => setRevision((r) => r + 1)}>Reintentar</button>
          </div>}
          {!cargando && !error && pagina.items.length === 0 && <div className="panel-estado">
            <div className="panel-estado-icono" aria-hidden="true">✦</div>
            <p className="panel-estado-texto">
              {pestana === 'pendientes' ? 'No tienes reservas pendientes.' : 'No tienes reservas próximas.'}
            </p>
          </div>}
          {!cargando && !error && <div className="panel-lista">
            {pagina.items.map((r) => (
              <article
                key={r.id}
                className="panel-item reserva-card"
                onClick={() => navigate(`/reservas/${r.id}`)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/reservas/${r.id}`);
                  }
                }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              >
                <div className="reserva-info-principal">
                  <h3 className="panel-item-titulo">{r.cliente.nombre}</h3>
                  <p className="panel-item-texto">{r.servicio.nombre} · {fecha.format(new Date(r.inicio))} de {hora.format(new Date(r.inicio))} a {hora.format(new Date(r.fin))}</p>
                </div>
                <div className="reserva-estado-container">
                  <span className={`reserva-badge ${r.estado}`}>{estados[r.estado]}</span>
                  {r.estado === 'pendiente' && r.venceEn && Date.parse(r.venceEn) > ahora &&
                    <span className="reserva-tiempo">⏱ {tiempoRestante(r.venceEn, ahora)}</span>}
                </div>
              </article>
            ))}
          </div>}
          {!cargando && !error && (cursores.length > 1 || pagina.siguiente) && <nav aria-label="Páginas de reservas" className="panel-paginacion">
            <button className="btn-servia-secondary btn-servia-sm" disabled={cursores.length === 1} onClick={() => setConsulta({ ...consulta, cursores: cursores.slice(0, -1) })}>Anterior</button>
            <span>Página {cursores.length}</span>
            <button className="btn-servia-secondary btn-servia-sm" disabled={!pagina.siguiente} onClick={() => setConsulta({ ...consulta, cursores: [...cursores, pagina.siguiente!] })}>Siguiente</button>
          </nav>}
        </div>
      </section>
    </div></div>

      {mostrarModalPausa && (
        <div className="panel-dialogo-fondo">
          <div
            ref={dialogo}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tituloPausa"
            aria-describedby="descripcionPausa notaPausa"
            tabIndex={-1}
            onKeyDown={(evento) => {
              if (evento.key === 'Escape' && !cargandoRecepcion) {
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
            className="panel-dialogo"
          >
            <div className="panel-dialogo-icono panel-dialogo-icono--aviso" aria-hidden="true">⏸</div>
            <h2 id="tituloPausa" className="panel-dialogo-titulo">¿Pausar las reservas?</h2>
            <p id="descripcionPausa" className="panel-dialogo-texto">
              Tu perfil seguirá visible, pero los clientes verán «No acepta reservas por ahora» y no podrán pedir reservas nuevas.
            </p>
            <div className="panel-alerta panel-alerta--aviso mb-0">
              <span className="panel-alerta-icono" aria-hidden="true">!</span>
              <div id="notaPausa" className="panel-alerta-contenido">
                <strong>Nota:</strong> Las reservas que ya tienes no cambiarán.
              </div>
            </div>
            {errorCambio && mensajeReservas && <p role="alert" className="panel-error-campo mt-3">{mensajeReservas}</p>}
            <div className="panel-dialogo-acciones">
              <button
                ref={cancelar}
                className="btn-servia-secondary"
                onClick={() => setMostrarModalPausa(false)}
                disabled={cargandoRecepcion || aceptaReservas === null}
              >
                Cancelar
              </button>
              <button
                className="btn-servia-primary"
                onClick={() => cambiarRecepcion(false)}
                disabled={cargandoRecepcion || aceptaReservas === null}
              >
                {cargandoRecepcion ? 'Pausando...' : 'Pausar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}