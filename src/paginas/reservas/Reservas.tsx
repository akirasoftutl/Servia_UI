import { useState, useEffect, useRef } from 'react';
import { api } from '../../servicios/api';
import './Reservas.css';

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
  const [consulta, setConsulta] = useState({ pestana: 'pendientes' as Pestana, estado: '', fecha: '', cursores: [''] });
  const [pagina, setPagina] = useState<Pagina>({ items: [], siguiente: null });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [ahora, setAhora] = useState(Date.now);
  const vencimientosConsultados = useRef(new Set<string>());
  const { pestana, estado: filtroEstado, fecha: filtroFecha, cursores } = consulta;

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
    // RN-46/T3: la API identifica al negocio por su token y entrega el orden MVP-22.
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
      // RN-57/58: pedir el estado efectivo a BE, sin modificarlo en la PWA.
      setConsulta((actual) => ({ ...actual, cursores: [''] }));
    }, Math.max(0, proximoVencimiento - Date.now()));
    return () => window.clearTimeout(temporizador);
  }, [pagina, cargando, error]);

  function cambiarPestana(nueva: Pestana) {
    setConsulta((actual) => ({ ...actual, pestana: nueva,
      estado: nueva === 'proximas' ? 'confirmada' : '', cursores: [''] }));
  }

  return (
    <div className="reservas-page"><div className="reservas-container">
      <header className="reservas-header"><h1>Reservas</h1><p>Administra las solicitudes de tus clientes.</p></header>
      <section className="reservas-panel">
        <div className="d-flex flex-wrap gap-3 mb-4">
          <div>
            <label htmlFor="reservas-fecha" className="form-label small fw-bold text-muted">Fecha</label>
            <input id="reservas-fecha" type="date" className="form-control" value={filtroFecha}
              onChange={(e) => setConsulta({ ...consulta, fecha: e.target.value, cursores: [''] })} />
          </div>
          <div>
            <label htmlFor="reservas-estado" className="form-label small fw-bold text-muted">Estado</label>
            <select id="reservas-estado" className="form-select" value={filtroEstado} disabled={pestana === 'proximas'}
              onChange={(e) => setConsulta({ ...consulta, estado: e.target.value, cursores: [''] })}>
              <option value="">Todos</option>
              {Object.entries(estados).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
            </select>
          </div>
        </div>
        <div className="reservas-tabs" role="tablist" aria-label="Vistas de reservas">
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
          {cargando && <p className="text-center py-5" role="status">Cargando reservas...</p>}
          {!cargando && error && <div className="text-center py-5">
            <p className="text-danger" role="alert">{error}</p>
            <button className="btn-servia-primary" onClick={() => setRevision((r) => r + 1)}>Reintentar</button>
          </div>}
          {!cargando && !error && pagina.items.length === 0 && <p className="text-muted">
            {pestana === 'pendientes' ? 'No tienes reservas pendientes.' : 'No tienes reservas próximas.'}
          </p>}
          {!cargando && !error && <div className="reservas-lista">
            {pagina.items.map((r) => <article key={r.id} className="reserva-card">
              <div className="reserva-info-principal">
                <h3>{r.cliente.nombre}</h3>
                <p>{r.servicio.nombre} · {fecha.format(new Date(r.inicio))} de {hora.format(new Date(r.inicio))} a {hora.format(new Date(r.fin))}</p>
              </div>
              <div className="reserva-estado-container">
                <span className={`reserva-badge ${r.estado}`}>{estados[r.estado]}</span>
                {r.estado === 'pendiente' && r.venceEn && Date.parse(r.venceEn) > ahora &&
                  <span className="reserva-tiempo">⏱ {tiempoRestante(r.venceEn, ahora)}</span>}
              </div>
            </article>)}
          </div>}
          {!cargando && !error && (cursores.length > 1 || pagina.siguiente) && <nav aria-label="Páginas de reservas" className="d-flex gap-3 mt-4">
            <button disabled={cursores.length === 1} onClick={() => setConsulta({ ...consulta, cursores: cursores.slice(0, -1) })}>Anterior</button>
            <span>Página {cursores.length}</span>
            <button disabled={!pagina.siguiente} onClick={() => setConsulta({ ...consulta, cursores: [...cursores, pagina.siguiente!] })}>Siguiente</button>
          </nav>}
        </div>
      </section>
    </div></div>
  );
}
