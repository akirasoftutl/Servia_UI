import { useEffect, useState } from 'react';
import { api, ErrorApi } from '../../servicios/api';
import { periodoPredefinido, validarPeriodo, type Periodo } from './fechas';
import './Estadisticas.css';

interface EstadisticasNegocio {
  periodo: Periodo;
  totalReservas: number;
  porEstado: { pendiente: number; confirmada: number; rechazada: number; rechazadaVencimiento: number; cancelada: number; completada: number };
  cancelaciones: { porCliente: number; porNegocio: number };
  clientesAtendidos: number;
  serviciosMasReservados: { servicioId: string; nombre: string; reservas: number }[];
  porDia: { fecha: string; reservas: number }[];
}

function fechaLegible(fecha: string) {
  return fecha.split('-').reverse().join('/');
}

export function Estadisticas() {
  const [seleccion, setSeleccion] = useState('30');
  const [periodo, setPeriodo] = useState(() => periodoPredefinido(30));
  const [datos, setDatos] = useState<EstadisticasNegocio | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const validacion = validarPeriodo(periodo);

  useEffect(() => {
    let vigente = true;
    async function cargar() {
      await Promise.resolve();
      if (!vigente || validacion) return;
      try {
        // RN-46 y T14: el servidor identifica al negocio y calcula los conteos.
        const respuesta = await api<EstadisticasNegocio>(`/negocios/mio/estadisticas?${new URLSearchParams({ ...periodo })}`);
        if (vigente) setDatos(respuesta);
      } catch (causa) {
        if (vigente) setError(causa instanceof ErrorApi && causa.estado === 400 && /demasiadas reservas/i.test(causa.message)
          ? `${causa.message} Acorta el periodo.`
          : 'No pudimos cargar las estadísticas. Intenta de nuevo.');
      } finally {
        if (vigente) setCargando(false);
      }
    }
    void cargar();
    return () => { vigente = false; };
  }, [periodo, validacion, revision]);

  function limpiar(nuevoPeriodo: Periodo) {
    setDatos(null);
    setError('');
    setCargando(!validarPeriodo(nuevoPeriodo));
    setPeriodo(nuevoPeriodo);
  }

  const metricas = datos ? [
    ['Total de reservas', datos.totalReservas],
    ['Confirmadas', datos.porEstado.confirmada],
    ['Completadas', datos.porEstado.completada],
    ['Cancelaciones por cliente', datos.cancelaciones.porCliente],
    ['Cancelaciones por negocio', datos.cancelaciones.porNegocio],
    ['Clientes atendidos', datos.clientesAtendidos],
  ] as const : [];
  const maximo = Math.max(0, ...(datos?.porDia.map(dia => dia.reservas) ?? []));

  return <div className="panel-pagina"><div className="panel-contenedor">
    <header className="panel-encabezado"><div>
      <span className="panel-eyebrow">OPERACIONES</span>
      <h1 className="panel-titulo">Estadísticas</h1>
      <p className="panel-subtitulo">Consulta las reservas y la actividad de tu negocio por periodo.</p>
    </div></header>
    <section className="panel-tarjeta" aria-labelledby="titulo-periodo">
      <h2 id="titulo-periodo" className="panel-tarjeta-titulo">Periodo</h2>
      <div className="estadisticas-filtros">
        <div><label htmlFor="periodo" className="form-label">Periodo de consulta</label>
          <select id="periodo" className="form-select" value={seleccion} onChange={e => {
            const valor = e.target.value;
            setSeleccion(valor);
            limpiar(valor === 'personalizado' ? { ...periodo } : periodoPredefinido(Number(valor)));
          }}>
            <option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option>
            <option value="90">Últimos 90 días</option><option value="personalizado">Personalizado</option>
          </select>
        </div>
        {seleccion === 'personalizado' && <>
          <div><label htmlFor="desde" className="form-label">Fecha inicial</label>
            <input id="desde" type="date" className="form-control" value={periodo.desde}
              aria-invalid={!!validacion} aria-describedby={validacion ? 'error-periodo' : undefined}
              onChange={e => limpiar({ ...periodo, desde: e.target.value })} /></div>
          <div><label htmlFor="hasta" className="form-label">Fecha final</label>
            <input id="hasta" type="date" className="form-control" value={periodo.hasta}
              aria-invalid={!!validacion} aria-describedby={validacion ? 'error-periodo' : undefined}
              onChange={e => limpiar({ ...periodo, hasta: e.target.value })} />
            {validacion && <p id="error-periodo" className="panel-error-campo" role="alert">{validacion}</p>}
          </div>
        </>}
      </div>
    </section>
    <section className="panel-tarjeta" aria-label="Estadísticas del periodo" aria-busy={cargando}>
      <div className="panel-alerta"><span className="panel-alerta-icono" aria-hidden="true">i</span>
        <div className="panel-alerta-contenido">«Clientes atendidos» y «Cancelaciones por cliente» pueden mostrar 0 mientras no existan MVP-27 y MVP-21.</div>
      </div>
      {cargando && <div className="panel-estado">
        <div className="spinner-border" aria-hidden="true" />
        <p className="panel-estado-texto" role="status">Cargando estadísticas...</p>
      </div>}
      {!cargando && error && <div className="panel-estado">
        <div className="panel-estado-icono panel-estado-icono--error" aria-hidden="true">!</div>
        <p className="panel-estado-texto" role="alert">{error}</p>
        <button className="btn-servia-primary" onClick={() => {
          limpiar({ ...periodo });
          setRevision(r => r + 1);
        }}>Reintentar</button>
      </div>}
      {!cargando && !error && datos && <>
        {datos.totalReservas === 0 && <div className="panel-estado">
          <div className="panel-estado-icono" aria-hidden="true">✦</div>
          <p className="panel-estado-texto">No hay reservas en este periodo.</p>
        </div>}
        <dl className="estadisticas-metricas">{metricas.map(([etiqueta, valor]) =>
          <div className="panel-item" key={etiqueta}><dt className="panel-item-texto">{etiqueta}</dt>
            <dd className="estadisticas-numero">{valor}</dd></div>)}</dl>
        <h2 className="panel-tarjeta-titulo">Reservas por día</h2>
        <p className="panel-subtitulo">Del {fechaLegible(datos.periodo.desde)} al {fechaLegible(datos.periodo.hasta)} · Todos los estados.</p>
        <div className="estadisticas-grafica panel-grafica" role="img"
          aria-label={`Reservas por día del ${fechaLegible(datos.periodo.desde)} al ${fechaLegible(datos.periodo.hasta)}: ${datos.totalReservas} ${datos.totalReservas === 1 ? 'reserva' : 'reservas'}. Detalle en la tabla equivalente.`}>
          <div className="panel-grafica-eje panel-ayuda" aria-hidden="true">
            <span>{maximo}</span><span>0</span>
          </div>
          <div className="estadisticas-barras" aria-hidden="true">{datos.porDia.map(dia =>
            <div className="estadisticas-columna" key={dia.fecha} title={`${dia.fecha}: ${dia.reservas} ${dia.reservas === 1 ? 'reserva' : 'reservas'}`}>
              <div className="estadisticas-barra" style={{ height: `${dia.reservas / Math.max(1, maximo) * 100}%` }} />
            </div>)}</div>
          <div className="panel-grafica-fechas panel-ayuda" aria-hidden="true">
            <span>{fechaLegible(datos.porDia[0]?.fecha ?? datos.periodo.desde)}</span>
            <span>{fechaLegible(datos.porDia.at(-1)?.fecha ?? datos.periodo.hasta)}</span>
          </div>
        </div>
        <table className="visually-hidden"><caption>Reservas por día</caption>
          <thead><tr><th scope="col">Fecha</th><th scope="col">Reservas</th></tr></thead>
          <tbody>{datos.porDia.map(dia => <tr key={dia.fecha}><th scope="row">{dia.fecha}</th><td>{dia.reservas}</td></tr>)}</tbody>
        </table>
        <h2 className="panel-tarjeta-titulo">Servicios más reservados</h2>
        {datos.serviciosMasReservados.length === 0 ? <p className="panel-subtitulo">No hay servicios reservados para mostrar.</p> :
          <ul className="panel-lista estadisticas-servicios">{datos.serviciosMasReservados.map(servicio =>
            <li className="panel-item" key={servicio.servicioId}><span className="panel-item-titulo">{servicio.nombre}</span>
              <span className="panel-item-texto">{servicio.reservas} {servicio.reservas === 1 ? 'reserva' : 'reservas'}</span></li>)}</ul>}
      </>}
    </section>
  </div></div>;
}
