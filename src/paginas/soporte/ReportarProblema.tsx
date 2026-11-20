import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageSquareWarning } from 'lucide-react';
import { api } from '../../servicios/api';
import { mensajeDeError } from '../../servicios/mensajeDeError';
import { EsqueletoLista, IlustracionEstado } from '../../componentes/panel/EstadosPanel';
import '../../estilos/panel.css';
import { EyebrowPanel } from '../../componentes/panel/EyebrowPanel';

interface Reporte { id: string; asunto: string; estado: 'abierto'; creadaEn: string }
const fecha = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'medium', timeStyle: 'short' });
const longitud = (texto: string) => Array.from(texto.trim()).length;

export function ReportarProblema() {
  const [asunto, setAsunto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [errorEnvio, setErrorEnvio] = useState('');
  const [exito, setExito] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [intentado, setIntentado] = useState(false);
  const [revision, setRevision] = useState(0);
  const bloqueo = useRef(false);
  const largoAsunto = longitud(asunto);
  const largoDescripcion = longitud(descripcion);
  const asuntoInvalido = largoAsunto < 5 || largoAsunto > 100;
  const descripcionInvalida = largoDescripcion < 20 || largoDescripcion > 1000;

  useEffect(() => {
    let vigente = true;
    api<Reporte[]>('/soporte/reportes/mios')
      .then(datos => { if (vigente) setReportes(actuales => {
        const combinados = new Map([...datos, ...actuales].map(r => [r.id, r]));
        return [...combinados.values()].sort((a, b) => b.creadaEn.localeCompare(a.creadaEn));
      }); })
      .catch((error: unknown) => { if (vigente) setErrorCarga(mensajeDeError(error, 'No pudimos cargar tus reportes. Intenta de nuevo.')); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [revision]);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setIntentado(true);
    setExito('');
    setErrorEnvio('');
    if (asuntoInvalido || descripcionInvalida || bloqueo.current) return;
    bloqueo.current = true;
    setEnviando(true);
    try {
      const reporte = await api<Reporte>('/soporte/reportes', { method: 'POST', body: JSON.stringify({ asunto: asunto.trim(), descripcion: descripcion.trim() }) });
      setReportes(actuales => [reporte, ...actuales.filter(r => r.id !== reporte.id)]);
      setExito('Tu reporte se envió correctamente.');
      setAsunto(''); setDescripcion(''); setIntentado(false);
    } catch (error: unknown) {
      setErrorEnvio(mensajeDeError(error, 'No pudimos enviar tu reporte. Revisa tu conexión e intenta de nuevo.'));
    } finally { bloqueo.current = false; setEnviando(false); }
  }

  return <div className="panel-pagina"><div className="panel-contenedor">
    <header className="panel-encabezado"><div className="panel-encabezado-textos">
      <EyebrowPanel grupo="configuracion" icono={MessageSquareWarning} />
      <h1 className="panel-titulo">Reportar un problema</h1>
      <p className="panel-subtitulo">Cuéntanos qué ocurrió y consulta tus reportes enviados.</p>
    </div></header>
    {exito && <div className="panel-alerta panel-alerta--exito" role="status">{exito}</div>}
    {errorEnvio && <div className="panel-alerta panel-alerta--error" role="alert">{errorEnvio}</div>}
    <section className="panel-tarjeta" aria-labelledby="nuevo-reporte">
      <div className="panel-tarjeta-encabezado"><h2 id="nuevo-reporte" className="panel-tarjeta-titulo">Nuevo reporte</h2></div>
      <form onSubmit={enviar} noValidate>
        <label className="form-label" htmlFor="reporte-asunto">Asunto</label>
        <input className="form-control" id="reporte-asunto" value={asunto} disabled={enviando} required
          aria-invalid={intentado && asuntoInvalido} aria-describedby="asunto-ayuda" onChange={e => setAsunto(e.target.value)} />
        <p className={intentado && asuntoInvalido ? 'panel-error-campo' : 'panel-ayuda'} id="asunto-ayuda">{largoAsunto}/100 caracteres. El asunto debe tener entre 5 y 100 caracteres.</p>
        <label className="form-label" htmlFor="reporte-descripcion">Descripción</label>
        <textarea className="form-control" id="reporte-descripcion" value={descripcion} disabled={enviando} required
          aria-invalid={intentado && descripcionInvalida} aria-describedby="descripcion-ayuda" onChange={e => setDescripcion(e.target.value)} />
        <p className={intentado && descripcionInvalida ? 'panel-error-campo' : 'panel-ayuda'} id="descripcion-ayuda">{largoDescripcion}/1000 caracteres. La descripción debe tener entre 20 y 1000 caracteres.</p>
        <div className="panel-formulario-acciones"><p className="panel-ayuda">No se cuentan los espacios de los extremos.</p>
          <button type="submit" className="btn-servia-primary" disabled={enviando}>{enviando ? 'Enviando...' : 'Enviar reporte'}</button>
        </div>
      </form>
    </section>
    <section className="panel-tarjeta" aria-labelledby="reportes-enviados" aria-busy={cargando}>
      <div className="panel-tarjeta-encabezado"><h2 id="reportes-enviados" className="panel-tarjeta-titulo">Mis reportes enviados</h2></div>
      {cargando && <div className="panel-cargando" role="status"><span className="panel-cargando-texto">Cargando tus reportes...</span><EsqueletoLista /></div>}
      {!cargando && errorCarga && <div className="panel-estado panel-estado--error"><IlustracionEstado icono={MessageSquareWarning} error />
        <div className="panel-estado-cuerpo"><p className="panel-estado-texto" role="alert">{errorCarga}</p><div className="panel-estado-acciones">
          <button className="btn-servia-secondary" onClick={() => { setCargando(true); setErrorCarga(''); setRevision(r => r + 1); }}>Reintentar</button>
        </div></div></div>}
      {!cargando && !errorCarga && reportes.length === 0 && <div className="panel-estado"><IlustracionEstado icono={MessageSquareWarning} />
        <div className="panel-estado-cuerpo"><h3 className="panel-estado-titulo">Todavía no has enviado reportes</h3><p className="panel-estado-texto">Cuando reportes un problema, aparecerá aquí.</p></div></div>}
      <div className="panel-lista">{reportes.map(reporte => <article className="panel-item" key={reporte.id}>
        <div className="panel-estado-cuerpo"><h3 className="panel-item-titulo panel-reporte-asunto">{reporte.asunto}</h3>
          <p className="panel-item-texto"><time dateTime={reporte.creadaEn}>{fecha.format(new Date(reporte.creadaEn))}</time></p></div>
        <span className="panel-insignia panel-insignia--aviso">{reporte.estado === 'abierto' ? 'Abierto' : reporte.estado}</span>
      </article>)}</div>
    </section>
  </div></div>;
}
