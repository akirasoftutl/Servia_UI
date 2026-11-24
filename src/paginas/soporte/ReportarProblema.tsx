import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageSquareWarning } from 'lucide-react';
import { api } from '../../servicios/api';
import { alertaDeError, exito } from '../../servicios/alertas';
import { mensajeDeError } from '../../servicios/mensajeDeError';
import { EsqueletoLista, EstadoError, EstadoVacio } from '../../componentes/panel/EstadosPanel';
import { EncabezadoPanel } from '../../componentes/panel/EncabezadoPanel';
import { TarjetaPanel } from '../../componentes/panel/TarjetaPanel';
import { EtiquetaEstado } from '../../componentes/panel/EtiquetaEstado';
import { BotonPanel } from '../../componentes/panel/BotonPanel';
import { ErrorCampo } from '../../componentes/panel/ErrorCampo';
import {
  atributosErrorCampo,
  contarCaracteres,
  idErrorCampo,
  longitudEntre,
  notificarErroresFormulario,
  type ErroresFormulario,
} from '../../utilidades/validacion';
import '../../estilos/panel.css';

interface Reporte { id: string; asunto: string; estado: 'abierto'; creadaEn: string }
type CampoReporte = 'asunto' | 'descripcion';
const ORDEN_CAMPOS: readonly CampoReporte[] = ['asunto', 'descripcion'];
const MAPA_IDS: Record<CampoReporte, string> = { asunto: 'reporte-asunto', descripcion: 'reporte-descripcion' };
const fecha = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'medium', timeStyle: 'short' });

export function ReportarProblema() {
  const [asunto, setAsunto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [errores, setErrores] = useState<ErroresFormulario<CampoReporte>>({});
  const [enviando, setEnviando] = useState(false);
  const [revision, setRevision] = useState(0);
  const bloqueo = useRef(false);
  const largoAsunto = contarCaracteres(asunto, true);
  const largoDescripcion = contarCaracteres(descripcion, true);

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

  function validar(): ErroresFormulario<CampoReporte> {
    const nuevos: ErroresFormulario<CampoReporte> = {};
    const errAsunto = longitudEntre(asunto, 5, 100, {
      contarCodigoPuntos: true,
      mensaje: 'El asunto debe tener entre 5 y 100 caracteres.',
    });
    if (errAsunto) nuevos.asunto = errAsunto;
    const errDescripcion = longitudEntre(descripcion, 20, 1000, {
      contarCodigoPuntos: true,
      mensaje: 'La descripción debe tener entre 20 y 1000 caracteres.',
    });
    if (errDescripcion) nuevos.descripcion = errDescripcion;
    return nuevos;
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (bloqueo.current) return;
    const nuevos = validar();
    setErrores(nuevos);
    if (!notificarErroresFormulario(nuevos, ORDEN_CAMPOS, { mapaIds: MAPA_IDS, mostrarAviso: true })) return;
    bloqueo.current = true;
    setEnviando(true);
    try {
      const reporte = await api<Reporte>('/soporte/reportes', {
        method: 'POST',
        body: JSON.stringify({ asunto: asunto.trim(), descripcion: descripcion.trim() }),
      });
      setReportes(actuales => [reporte, ...actuales.filter(r => r.id !== reporte.id)]);
      setAsunto(''); setDescripcion(''); setErrores({});
      await exito('Tu reporte se envió correctamente.');
    } catch (error: unknown) {
      await alertaDeError(error, 'No pudimos enviar tu reporte. Revisa tu conexión e intenta de nuevo.');
    } finally { bloqueo.current = false; setEnviando(false); }
  }

  return <div className="panel-pagina"><div className="panel-contenedor">
    <EncabezadoPanel
      grupo="configuracion"
      icono={MessageSquareWarning}
      titulo="Reportar un problema"
      subtitulo="Cuéntanos qué ocurrió y consulta tus reportes enviados."
    />
    <TarjetaPanel titulo="Nuevo reporte" tituloId="nuevo-reporte">
      <form onSubmit={enviar} noValidate>
        <label className="form-label" htmlFor="reporte-asunto">Asunto</label>
        <input
          className={`form-control${errores.asunto ? ' is-invalid' : ''}`}
          id="reporte-asunto"
          value={asunto}
          disabled={enviando}
          required
          {...atributosErrorCampo('reporte-asunto', errores.asunto, 'asunto-ayuda')}
          onChange={e => { setAsunto(e.target.value); if (errores.asunto) setErrores(prev => ({ ...prev, asunto: undefined })); }}
        />
        <ErrorCampo id={idErrorCampo('reporte-asunto')} mensaje={errores.asunto} />
        <p className="panel-ayuda" id="asunto-ayuda">{largoAsunto}/100 caracteres. El asunto debe tener entre 5 y 100 caracteres.</p>
        <label className="form-label" htmlFor="reporte-descripcion">Descripción</label>
        <textarea
          className={`form-control${errores.descripcion ? ' is-invalid' : ''}`}
          id="reporte-descripcion"
          value={descripcion}
          disabled={enviando}
          required
          {...atributosErrorCampo('reporte-descripcion', errores.descripcion, 'descripcion-ayuda')}
          onChange={e => { setDescripcion(e.target.value); if (errores.descripcion) setErrores(prev => ({ ...prev, descripcion: undefined })); }}
        />
        <ErrorCampo id={idErrorCampo('reporte-descripcion')} mensaje={errores.descripcion} />
        <p className="panel-ayuda" id="descripcion-ayuda">{largoDescripcion}/1000 caracteres. La descripción debe tener entre 20 y 1000 caracteres.</p>
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
