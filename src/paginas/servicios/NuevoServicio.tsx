import {
  useState,
  useEffect,
  useRef,
  type FormEvent,
  type ChangeEvent
} from 'react';

import { CircleAlert, PackagePlus, ShieldAlert } from 'lucide-react';
import { EsqueletoEncabezado, EsqueletoLista, EstadoError } from '../../componentes/panel/EstadosPanel';
import { EncabezadoPanel } from '../../componentes/panel/EncabezadoPanel';
import { BotonPanel } from '../../componentes/panel/BotonPanel';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { api, ErrorApi, subirImagenServicio, type ImagenServicio } from '../../servicios/api';
import { mensajeDeError } from '../../servicios/mensajeDeError';
import './Servicios.css';
import { AccionesServicio } from './AccionesServicio';
import { ImagenesServicio } from './ImagenesServicio';
import { AVISO_IMAGENES_FALLIDAS, liberarPendiente, type ArchivoPendiente } from './imagenes';
import { CategoriaServicio } from './CategoriaServicio';
import {
  SIN_CATEGORIA, camposDeCategoria, categoriaDelServicio, errorDeCategoria, useCatalogoCategorias,
  type CategoriaDeServicio, type CategoriaElegida,
} from './categorias';

interface PerfilNegocio {
  perfilCompleto: boolean;
  camposFaltantes: string[];
  categoriaId?: string | null;
}

// Al pasar de /servicios/nuevo a /servicios/:id (p. ej. si fallan las imágenes al crear) el
// formulario se vuelve a montar desde cero con los datos del servicio ya creado.
export function NuevoServicio() {
  const { id } = useParams();
  return <FormularioServicio key={id ?? 'nuevo'} />;
}

function FormularioServicio() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { state } = useLocation();
  const esEdicion = Boolean(id);

  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    duracion: '',
  });

  const [activo, setActivo] = useState(true);
  const [aviso, setAviso] = useState<string>(state?.aviso ?? '');
  const [errorGuardar, setErrorGuardar] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [publicando, setPublicando] = useState(false);
  const [servicioPublicado, setServicioPublicado] = useState(false);
  const [perfilCompleto, setPerfilCompleto] = useState(true);
  const [camposFaltantes, setCamposFaltantes] = useState<string[]>([]);
  // Categoría del servicio (HU-N28, HU-N31 a HU-N34): lo elegido, lo que había al abrir y lo guardado.
  const [categoria, setCategoria] = useState<CategoriaElegida>(SIN_CATEGORIA);
  const [categoriaInicial, setCategoriaInicial] = useState<CategoriaElegida>(SIN_CATEGORIA);
  const [categoriaGuardada, setCategoriaGuardada] = useState<{ id: string; nombre: string } | null>(null);
  const [categoriaNegocioId, setCategoriaNegocioId] = useState<string | null | undefined>(undefined);
  // Imágenes (HU-N27): las guardadas en edición y, al crear, las elegidas que se suben tras crear el servicio.
  const [imagenes, setImagenes] = useState<ImagenServicio[]>([]);
  const [pendientes, setPendientes] = useState<ArchivoPendiente[]>([]);
  const pendientesRef = useRef(pendientes);
  useEffect(() => { pendientesRef.current = pendientes; }, [pendientes]);
  useEffect(() => () => pendientesRef.current.forEach(liberarPendiente), []);
  const [subiendoImagenes, setSubiendoImagenes] = useState(false);
  const [errorCarga, setErrorCarga] = useState('');
  const [intento, setIntento] = useState(0);
  const botonExito = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (servicioPublicado) botonExito.current?.focus();
  }, [servicioPublicado]);
  const [mensajeExito, setMensajeExito] = useState('');
  // Al editar, la categoría del negocio no viene en la carga del servicio: el hook consulta el perfil.
  const catalogo = useCatalogoCategorias(!cargando && !errorCarga, categoriaNegocioId, esEdicion);

  useEffect(() => {
    let vigente = true;
    const cargarDatos = async () => {
      try {
        if (esEdicion && id) {
          // La edición no depende de la disponibilidad del perfil.
          const servicio = await api<{ nombre: string; descripcion: string; precio: number; duracionMin: number; activo: boolean; imagenes?: ImagenServicio[] } & CategoriaDeServicio>(`/negocios/mio/servicios/${id}`);
          if (!vigente) return;
          setActivo(servicio.activo);
          setImagenes(servicio.imagenes ?? []);
          const guardada = categoriaDelServicio(servicio);
          setCategoria(guardada); setCategoriaInicial(guardada);
          setCategoriaGuardada(servicio.categoriaServicio ?? null);
          setForm({ nombre: servicio.nombre, descripcion: servicio.descripcion,
            precio: String(servicio.precio), duracion: String(servicio.duracionMin) });
        } else {
          const perfil = await api<PerfilNegocio>('/negocios/mio');
          if (!vigente) return;
          setPerfilCompleto(perfil.perfilCompleto);
          setCamposFaltantes(perfil.camposFaltantes || []);
          setCategoriaNegocioId(perfil.categoriaId ?? null);
        }
      } catch (error) {
        if (vigente) setErrorCarga(error instanceof ErrorApi && error.estado === 404 && esEdicion
          ? 'Este servicio no existe.' : mensajeDeError(error, 'No pudimos cargar los datos. Intenta de nuevo.'));
      } finally {
        if (vigente) setCargando(false);
      }
    };
    void cargarDatos();
    return () => { vigente = false; };
  }, [esEdicion, id, intento]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrores((prev) => ({ ...prev, [name]: '' }));
  };

  const validar = (): boolean => {
    const nuevosErrores: Record<string, string> = {};
    if (!form.nombre.trim()) nuevosErrores.nombre = 'Escribe el nombre del servicio.';
    if (!form.descripcion.trim()) nuevosErrores.descripcion = 'Escribe una descripción.';
    
    const precioNum = Number(form.precio);
    if (form.precio === '' || !Number.isFinite(precioNum) || precioNum < 0) {
      nuevosErrores.precio = 'El precio debe ser 0 o más.';
    }

    const duracionNum = Number(form.duracion);
    if (form.duracion === '' || !Number.isFinite(duracionNum) || duracionNum < 1 || !Number.isInteger(duracionNum)) {
      nuevosErrores.duracion = 'La duración debe ser de al menos 1 minuto.';
    }

    const errorCategoria = catalogo.estado === 'listo' ? errorDeCategoria(categoria) : '';
    if (errorCategoria) nuevosErrores.categoria = errorCategoria;

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  // Sube una por una las imágenes elegidas al crear. Devuelve false si alguna falla.
  const subirPendientes = async (servicioId: string): Promise<boolean> => {
    setSubiendoImagenes(true);
    let todas = true;
    for (const pendiente of pendientes) {
      try {
        await subirImagenServicio(servicioId, pendiente.archivo);
      } catch {
        todas = false;
      }
    }
    setSubiendoImagenes(false);
    return todas;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validar()) return;

    setPublicando(true);
    setErrorGuardar('');
    let payloadEnviado: object = {};
    try {
      const payload = {
        nombre: form.nombre,
        descripcion: form.descripcion,
        precio: Number(form.precio),
        duracionMin: Number(form.duracion),
        // Con el catálogo caído no se toca la categoría: al editar se conserva la que ya tenía.
        ...(catalogo.estado === 'listo' ? camposDeCategoria(categoria, categoriaInicial, esEdicion) : {}),
      };

      payloadEnviado = payload;
      if (esEdicion) {
        await api(`/negocios/mio/servicios/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        navigate('/servicios', { state: { mensaje: 'Cambios guardados.' } });
        return;
      } else {
        const creado = await api<{ id: string }>('/negocios/mio/servicios', { method: 'POST', body: JSON.stringify(payload) });
        if (pendientes.length > 0 && !(await subirPendientes(creado.id))) {
          // El servicio ya existe: se edita ahí para agregar las imágenes que faltan.
          navigate(`/servicios/${creado.id}`, { replace: true, state: { aviso: AVISO_IMAGENES_FALLIDAS } });
          return;
        }
        setMensajeExito('Servicio publicado.');
      }
      setServicioPublicado(true);

    } catch (error) {
      if (!esEdicion && error instanceof ErrorApi && error.estado === 409) {
        setPerfilCompleto(false);
        setCamposFaltantes([error.message]);
      } else if (error instanceof ErrorApi && error.estado === 400 && ('categoriaServicioId' in payloadEnviado || 'categoriaPersonalizada' in payloadEnviado)) {
        // 400 de validación con categoría de por medio: se muestra junto al campo.
        setErrores(prev => ({ ...prev, categoria: error.message }));
      } else {
        setErrorGuardar(mensajeDeError(error, esEdicion
          ? 'No pudimos guardar los cambios. Intenta de nuevo.'
          : 'No pudimos guardar el servicio. Intenta de nuevo.'));
      }
    } finally {
      setPublicando(false);
    }
  };

  const crearOtroServicio = () => {
    setServicioPublicado(false);
    setForm({ nombre: '', descripcion: '', precio: '', duracion: '' });
    setErrores({});
    setCategoria(SIN_CATEGORIA);
    pendientes.forEach(liberarPendiente);
    setPendientes([]);
  };

  if (cargando) {
    return (
      <div className="panel-pagina">
        <div className="panel-contenedor">
          <EsqueletoEncabezado />
          <div className="panel-tarjeta panel-cargando">
            <EsqueletoLista filas={2} />
            <div className="panel-cargando-texto">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
              <p className="m-0">Preparando formulario...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (errorCarga) return <div className="panel-pagina">
    <div className="panel-contenedor">
      <EstadoError
        icono={CircleAlert}
        mensaje={errorCarga}
        textoReintentar="Intentar de nuevo"
        onReintentar={errorCarga !== 'Este servicio no existe.' ? () => { setCargando(true); setErrorCarga(''); setIntento(intento + 1); } : undefined}
        accionSecundaria={<BotonPanel variante="secundario" to="/servicios">Volver a Mis servicios</BotonPanel>}
      />
    </div>
  </div>;

  return (
    <div className="panel-pagina">
      <div className="panel-contenedor">

        {!perfilCompleto && !esEdicion && (
          <div className="panel-alerta panel-alerta--aviso servicio-alerta-perfil">
            <div className="panel-alerta-icono" aria-hidden="true">
              <ShieldAlert />
            </div>
            <div className="panel-alerta-contenido">
              <strong className="d-block">Completa tu perfil para publicar servicios.</strong>
              <p>Campos pendientes: <strong>{camposFaltantes.join(', ')}</strong></p>
            </div>
            <BotonPanel variante="primario" tamano="sm" to="/mi-perfil" className="panel-alerta-accion">Completar mi perfil</BotonPanel>
          </div>
        )}

        <div inert={servicioPublicado}>
            <EncabezadoPanel
              grupo="negocio"
              icono={PackagePlus}
              titulo={esEdicion ? 'Editar servicio' : 'Nuevo servicio'}
              subtitulo={esEdicion ? 'Actualiza la información de tu servicio.' : 'Agrega un nuevo servicio a tu negocio y permite que más clientes conozcan lo que ofreces.'}
            >
              {/* Vista previa de cómo se verá el servicio en el catálogo */}
              {(form.precio !== '' || form.duracion !== '') && <dl className="panel-metricas">
                {form.precio !== '' && Number(form.precio) >= 0 && <div className="panel-metrica">
                  <dt>precio</dt>
                  <dd>{`$${Number(form.precio).toFixed(2)}`}</dd>
                </div>}
                {form.duracion !== '' && <div className="panel-metrica">
                  <dt>min</dt>
                  <dd>{form.duracion}</dd>
                </div>}
              </dl>}
            </EncabezadoPanel>

          <div className="panel-tarjeta">
            {aviso && <p role="status" className="panel-alerta panel-alerta--info">{aviso}</p>}
            {errorGuardar && <p role="alert" className="panel-alerta panel-alerta--error">{errorGuardar}</p>}
            {esEdicion && <section aria-label="Estado del servicio" className="servicio-estado-edicion">
              <p className={`servicio-estado ${activo ? 'activo' : 'inactivo'}`}>Estado: {activo ? 'Activo' : 'Inactivo'}</p>
              <AccionesServicio key={id} id={id!} nombre={form.nombre} activo={activo}
                alCambiarEstado={setActivo} alMensaje={setAviso}
                alEliminar={mensaje => navigate('/servicios', { state: { mensaje } })} />
            </section>}
            <form onSubmit={handleSubmit} noValidate>
              <fieldset disabled={(!perfilCompleto && !esEdicion) || publicando}>
                <section className="servicio-seccion">
                  <h2 className="panel-tarjeta-titulo">Información del servicio</h2>
                  <p className="panel-tarjeta-subtitulo servicio-seccion-subtitulo">Completa los datos principales de tu servicio.</p>

                  <div className="mb-4">
                    <label htmlFor="nombre" className="form-label">Nombre del servicio *</label>
                    <input id="nombre" type="text" name="nombre" className={`form-control ${errores.nombre ? 'is-invalid' : ''}`} value={form.nombre} onChange={handleChange} placeholder="Ej. Corte de cabello" required />
                    {errores.nombre && <div className="invalid-feedback">{errores.nombre}</div>}
                  </div>

                  <div className="mb-4">
                    <label htmlFor="descripcion" className="form-label">Descripción del servicio *</label>
                    <textarea id="descripcion" name="descripcion" rows={4} maxLength={500} className={`form-control ${errores.descripcion ? 'is-invalid' : ''}`} value={form.descripcion} onChange={handleChange} placeholder="Describe en qué consiste el servicio..." required />
                    <div className="servicio-campo-pie">
                      {errores.descripcion ? <span className="panel-error-campo">{errores.descripcion}</span> : <span className="panel-ayuda">Describe brevemente lo que ofreces.</span>}
                      <span className="panel-ayuda">{form.descripcion.length}/500</span>
                    </div>
                  </div>
                </section>

                <section className="servicio-seccion">
                  <h2 className="panel-tarjeta-titulo">Precio y duración</h2>
                  <p className="panel-tarjeta-subtitulo servicio-seccion-subtitulo">Establece el costo y el tiempo aproximado de realización.</p>
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label htmlFor="precio" className="form-label">Precio del servicio *</label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input id="precio" type="number" name="precio" className={`form-control ${errores.precio ? 'is-invalid' : ''}`} value={form.precio} onChange={handleChange} placeholder="0.00" min="0" step="0.01" required />
                      </div>
                      {errores.precio && <div className="panel-error-campo">{errores.precio}</div>}
                      <small className="panel-ayuda mt-2 d-block">Precio en pesos mexicanos (MXN).</small>
                    </div>

                    <div className="col-12 col-md-6">
                      <label htmlFor="duracion" className="form-label">Duración del servicio *</label>
                      <div className="input-group">
                        <input id="duracion" type="number" name="duracion" className={`form-control ${errores.duracion ? 'is-invalid' : ''}`} value={form.duracion} onChange={handleChange} placeholder="30" min="1" step="1" required />
                        <span className="input-group-text">Minutos</span>
                      </div>
                      {errores.duracion && <div className="panel-error-campo">{errores.duracion}</div>}
                      <small className="panel-ayuda mt-2 d-block">Tiempo aproximado para realizar el servicio.</small>
                    </div>
                  </div>
                </section>

                <section className="servicio-seccion">
                  <h2 className="panel-tarjeta-titulo">Categoría</h2>
                  <p className="panel-tarjeta-subtitulo servicio-seccion-subtitulo">Elige una categoría o escribe la tuya.</p>
                  <CategoriaServicio valor={categoria} catalogo={catalogo} error={errores.categoria ?? ''}
                    actual={categoriaGuardada}
                    alCambiar={nueva => { setCategoria(nueva); setErrores(prev => ({ ...prev, categoria: '' })); }} />
                </section>

                {esEdicion && <p className="panel-alerta panel-alerta--info">Los cambios de precio o duración no afectan las reservas que ya existen.</p>}
                <ImagenesServicio servicioId={id} imagenes={imagenes} alCambiarImagenes={setImagenes}
                  pendientes={pendientes} alCambiarPendientes={setPendientes} />
              </fieldset>

              <div className="panel-formulario-acciones">
                <Link to="/servicios" className="btn-servia-secondary">Cancelar</Link>
                <button type="submit" className="btn-servia-primary" disabled={(!perfilCompleto && !esEdicion) || publicando}>
                  {publicando ? (<><span className="spinner-border spinner-border-sm me-2" />{subiendoImagenes ? 'Subiendo imágenes...' : 'Guardando...'}</>) : (<>{esEdicion ? 'Guardar cambios' : 'Publicar servicio'}</>)}
                </button>
              </div>
            </form>

            <div className="panel-nota-pie">
              <span className="panel-nota-pie-punto" aria-hidden="true">●</span>
              <span>Publica tus servicios y conecta con nuevos clientes.</span>
            </div>
          </div>
        </div>

        {servicioPublicado && (
          <div className="panel-dialogo-fondo" role="alertdialog" aria-modal="true" aria-labelledby="servicio-alerta-titulo" aria-describedby="servicio-alerta-texto"
            onKeyDown={(event) => {
              if (event.key === 'Tab') {
                const botones = event.currentTarget.querySelectorAll<HTMLButtonElement>('button');
                const destino = event.shiftKey ? botones[botones.length - 1] : botones[0];
                if (document.activeElement === (event.shiftKey ? botones[0] : botones[botones.length - 1])) { event.preventDefault(); destino?.focus(); }
              }
            }}>
            <div className="panel-dialogo">
              <div className="panel-dialogo-icono" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              </div>
              <h2 id="servicio-alerta-titulo" className="panel-dialogo-titulo">{mensajeExito}</h2>
              <p id="servicio-alerta-texto" className="panel-dialogo-texto"><strong>{form.nombre}</strong> ya forma parte de tu catálogo. Tus clientes podrán encontrarlo y reservarlo.</p>
              <div className="panel-dialogo-acciones panel-dialogo-acciones--columna">
                <button ref={botonExito} type="button" className="btn-servia-primary" onClick={() => navigate('/servicios')}>Ver mis servicios</button>
                {!esEdicion && <button type="button" className="btn-servia-secondary" onClick={crearOtroServicio}>Crear otro servicio</button>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}