import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageSquareWarning } from 'lucide-react';
import { api } from '../../servicios/api';
import { mensajeDeError } from '../../servicios/mensajeDeError';
import { EsqueletoLista, EstadoError, EstadoVacio } from '../../componentes/panel/EstadosPanel';
import { EncabezadoPanel } from '../../componentes/panel/EncabezadoPanel';
import { TarjetaPanel } from '../../componentes/panel/TarjetaPanel';
import { EtiquetaEstado } from '../../componentes/panel/EtiquetaEstado';
import { BotonPanel } from '../../componentes/panel/BotonPanel';
import '../../estilos/panel.css';

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
    <EncabezadoPanel
      grupo="configuracion"
      icono={MessageSquareWarning}
      titulo="Reportar un problema"
      subtitulo="Cuéntanos qué ocurrió y consulta tus reportes enviados."
    />
    {exito && <div className="panel-alerta panel-alerta--exito" role="status">{exito}</div>}
    {errorEnvio && <div className="panel-alerta panel-alerta--error" role="alert">{errorEnvio}</div>}
    <TarjetaPanel titulo="Nuevo reporte" tituloId="nuevo-reporte">
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
          <BotonPanel type="submit" variante="primario" disabled={enviando}>{enviando ? 'Enviando...' : 'Enviar reporte'}</BotonPanel>
        </div>
      </form>
    </TarjetaPanel>
    <TarjetaPanel titulo="Mis reportes enviados" tituloId="reportes-enviados" ariaBusy={cargando}>
      {cargando && <div className="panel-cargando" role="status"><span className="panel-cargando-texto">Cargando tus reportes...</span><EsqueletoLista /></div>}
      {!cargando && errorCarga && <EstadoError icono={MessageSquareWarning} mensaje={errorCarga}
        onReintentar={() => { setCargando(true); setErrorCarga(''); setRevision(r => r + 1); }} />}
      {!cargando && !errorCarga && reportes.length === 0 && <EstadoVacio
        icono={MessageSquareWarning}
        titulo="Todavía no has enviado reportes"
        texto="Cuando reportes un problema, aparecerá aquí."
      />}
      <div className="panel-lista">{reportes.map(reporte => <article className="panel-item" key={reporte.id}>
        <div className="panel-estado-cuerpo"><h3 className="panel-item-titulo panel-reporte-asunto">{reporte.asunto}</h3>
          <p className="panel-item-texto"><time dateTime={reporte.creadaEn}>{fecha.format(new Date(reporte.creadaEn))}</time></p></div>
        <EtiquetaEstado texto={reporte.estado === 'abierto' ? 'Abierto' : reporte.estado} tono="aviso" />
      </article>)}</div>
    </TarjetaPanel>
  </div></div>;
}
