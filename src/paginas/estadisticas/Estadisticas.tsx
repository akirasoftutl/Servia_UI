import { useEffect, useState } from 'react';
import { CalendarDays, CalendarX, ChartColumn, CircleCheck, Clock, UserX, Users, type LucideIcon } from 'lucide-react';
import { EstadoVacio } from '../../componentes/panel/EstadosPanel';
import { api, ErrorApi } from '../../servicios/api';
import { periodoPredefinido, validarPeriodo, type Periodo } from './fechas';
import { GraficaReservas, LeyendaGrafica } from './GraficaReservas';
import { porcentaje } from './grafica';
import './Estadisticas.css';
import { EyebrowPanel } from '../../componentes/panel/EyebrowPanel';

interface EstadisticasNegocio {
  periodo: Periodo;
  totalReservas: number;
  porEstado: { pendiente: number; confirmada: number; rechazada: number; rechazadaVencimiento: number; cancelada: number; completada: number };
  cancelaciones: { porCliente: number; porNegocio: number };
  clientesAtendidos: number;
  serviciosMasReservados: { servicioId: string; nombre: string; reservas: number }[];
  porDia: { fecha: string; reservas: number }[];
}

const OPCIONES_PERIODO = [['7', '7 días'], ['30', '30 días'], ['90', '90 días'], ['personalizado', 'Personalizado']] as const;

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

  const metricas: readonly (readonly [string, number, LucideIcon, string])[] = datos ? [
    ['Total de reservas', datos.totalReservas, CalendarDays, ''],
    ['Confirmadas', datos.porEstado.confirmada, Clock, 'info'],
    ['Completadas', datos.porEstado.completada, CircleCheck, 'exito'],
    ['Cancelaciones por cliente', datos.cancelaciones.porCliente, UserX, 'aviso'],
    ['Cancelaciones por negocio', datos.cancelaciones.porNegocio, CalendarX, 'peligro'],
    ['Clientes atendidos', datos.clientesAtendidos, Users, ''],
  ] : [];

  return <div className="panel-pagina"><div className="panel-contenedor">
    <header className="panel-encabezado"><div className="panel-encabezado-textos">
      <EyebrowPanel grupo="negocio" icono={ChartColumn} />
      <h1 className="panel-titulo">Estadísticas</h1>
      <p className="panel-subtitulo">Consulta las reservas y la actividad de tu negocio por periodo.</p>
    </div>{!validacion && <div className="panel-encabezado-acciones">
      <span className="estadisticas-periodo-rango"><CalendarDays aria-hidden="true" />{fechaLegible(periodo.desde)} – {fechaLegible(periodo.hasta)}</span>
    </div>}</header>
    <section className="panel-tarjeta" aria-labelledby="titulo-periodo">
      <div className="estadisticas-periodo-barra">
        <div>
          <h2 id="titulo-periodo" className="panel-tarjeta-titulo">Periodo de consulta</h2>
          <p className="panel-tarjeta-subtitulo">Elige un rango rápido o define tus propias fechas.</p>
        </div>
        <div className="panel-pestanas" role="group" aria-label="Rango de fechas">
          {OPCIONES_PERIODO.map(([valor, texto]) => <button type="button" key={valor} className={seleccion === valor ? 'active' : ''}
            aria-pressed={seleccion === valor} onClick={() => {
              if (valor === seleccion) return;
              setSeleccion(valor);
              limpiar(valor === 'personalizado' ? { ...periodo } : periodoPredefinido(Number(valor)));
            }}>{texto}</button>)}
        </div>
      </div>
      {seleccion === 'personalizado' && <div className="estadisticas-filtros">
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
      </div>}
    </section>
    <section className="panel-tarjeta" aria-label="Estadísticas del periodo" aria-busy={cargando}>
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
        {datos.totalReservas === 0 && <EstadoVacio
          icono={ChartColumn}
          titulo="Sin datos que mostrar"
          texto="Las cifras aparecerán cuando tengas reservas en este periodo."
        />}
        <dl className="estadisticas-metricas">{metricas.map(([etiqueta, valor, Icono, tono]) =>
          <div className="panel-item estadisticas-kpi" key={etiqueta}>
            <dt className="estadisticas-kpi-top"><span className="panel-item-texto">{etiqueta}</span>
              <span className={`estadisticas-kpi-icono${tono ? ` estadisticas-kpi-icono--${tono}` : ''}`} aria-hidden="true"><Icono /></span></dt>
            <dd className="estadisticas-numero">{valor}</dd></div>)}</dl>
        <div className="estadisticas-bloque-grafica">
          <div className="estadisticas-grafica-cabecera">
            <div>
              <h2 className="panel-tarjeta-titulo">Reservas por día</h2>
              <p className="panel-tarjeta-subtitulo">Del {fechaLegible(datos.periodo.desde)} al {fechaLegible(datos.periodo.hasta)} · Todos los estados.</p>
            </div>
            <LeyendaGrafica porDia={datos.porDia} />
          </div>
          <GraficaReservas porDia={datos.porDia}
            etiquetaAccesible={`Reservas por día del ${fechaLegible(datos.periodo.desde)} al ${fechaLegible(datos.periodo.hasta)}: ${datos.totalReservas} ${datos.totalReservas === 1 ? 'reserva' : 'reservas'}. Detalle en la tabla equivalente.`} />
        </div>
        <div className="estadisticas-bloque-servicios">
          <div className="panel-tarjeta-encabezado">
            <div>
              <h2 className="panel-tarjeta-titulo">Servicios más reservados</h2>
              {datos.serviciosMasReservados.length > 0 && <p className="panel-tarjeta-subtitulo">Participación sobre el total de {datos.totalReservas} {datos.totalReservas === 1 ? 'reserva' : 'reservas'} del periodo.</p>}
            </div>
            {datos.serviciosMasReservados.length > 0 && <span className="panel-contador">{datos.serviciosMasReservados.length} {datos.serviciosMasReservados.length === 1 ? 'servicio' : 'servicios'}</span>}
          </div>
          {datos.serviciosMasReservados.length === 0 ? <p className="panel-subtitulo">No hay servicios reservados para mostrar.</p> :
            <ul className="panel-lista estadisticas-servicios">{datos.serviciosMasReservados.map((servicio, i) => {
              const parte = porcentaje(servicio.reservas, datos.totalReservas);
              return <li className="panel-item estadisticas-servicio-item" key={servicio.servicioId}>
                <div className="estadisticas-servicio-fila">
                  <div className="estadisticas-servicio-izq"><span className="estadisticas-rango-num" aria-hidden="true">{i + 1}</span>
                    <span className="panel-item-titulo">{servicio.nombre}</span></div>
                  <span className="estadisticas-servicio-conteo"><span>{servicio.reservas} {servicio.reservas === 1 ? 'reserva' : 'reservas'}</span> <small>· {parte}%</small></span>
                </div>
                <div className="estadisticas-progreso" aria-hidden="true"><div className="estadisticas-progreso-barra" style={{ width: `${parte}%` }} /></div>
              </li>;
            })}</ul>}
        </div>
      </>}
    </section>
  </div></div>;
}
