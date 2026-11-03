import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import { CircleAlert, Clock, Plus, Tags } from 'lucide-react';
import { api } from '../../servicios/api';
import { EsqueletoLista, IlustracionEstado } from '../../componentes/panel/EstadosPanel';
import './Servicios.css';
import { AccionesServicio } from './AccionesServicio';

// Iniciales del servicio para la ficha decorativa de cada tarjeta.
function iniciales(nombre: string) {
  const palabras = nombre.trim().split(/\s+/);
  const importantes = palabras.filter((palabra) => palabra.length > 2);
  return (importantes.length ? importantes : palabras).slice(0, 2).map((palabra) => palabra.charAt(0).toUpperCase()).join('');
}

interface Servicio {
  id: string;
  nombre: string;
  precio: number;
  duracionMin: number;
  activo: boolean;
}

export function MisServicios() {
  const navigate = useNavigate();

  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [filtro, setFiltro] = useState<'todos' | 'activos' | 'inactivos'>('todos');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const { state } = useLocation();
  const [alerta, setAlerta] = useState<string>(state?.mensaje ?? '');

  const [revision, setRevision] = useState(0);
  // Resumen del catálogo completo para el encabezado; solo se actualiza con la vista «Todos».
  const [resumen, setResumen] = useState<{ total: number; activos: number } | null>(null);
  useEffect(() => {
    let vigente = true;
    let ruta = '/negocios/mio/servicios';
    if (filtro !== 'todos') ruta += `?estado=${filtro}`;
    void api<Servicio[]>(ruta).then(data => {
      if (vigente) {
        setServicios(data); setError('');
        if (filtro === 'todos') setResumen({ total: data.length, activos: data.filter((s) => s.activo).length });
      }
    }).catch(() => {
      if (vigente) setError('No pudimos cargar tus servicios. Intenta nuevamente.');
    }).finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [filtro, revision]);
  const cargarServicios = () => setRevision(prev => prev + 1);

  const cambiarFiltro = (nuevo: typeof filtro) => {
    if (nuevo === filtro) return;
    setCargando(true);
    setError('');
    setFiltro(nuevo);
  };

  return (
    <div className="panel-pagina">
      <div className="panel-contenedor">
        
        {alerta && <div role="status" className="panel-alerta panel-alerta--info">{alerta}</div>}

        <header className="panel-encabezado">
          <div className="panel-encabezado-textos">
            <span className="panel-eyebrow"><Tags aria-hidden="true" />ADMINISTRACIÓN</span>
            <h1 className="panel-titulo">Mis servicios</h1>
            <p className="panel-subtitulo">Organiza y administra los servicios de tu negocio.</p>
            <dl className="panel-metricas">
              <div className="panel-metrica">
                <dt>En catálogo</dt>
                <dd>{resumen?.total ?? '—'}</dd>
              </div>
              <div className="panel-metrica">
                <dt>Activos</dt>
                <dd>{resumen?.activos ?? '—'}</dd>
              </div>
            </dl>
          </div>
          <div className="panel-encabezado-acciones">
            <Link to="/servicios/nuevo" className="btn-servia-primary"><Plus aria-hidden="true" />Crear servicio</Link>
          </div>
        </header>

        <section className="panel-tarjeta">
          <div className="panel-tarjeta-encabezado">
            <div>
              <h2 className="panel-tarjeta-titulo">Tu catálogo</h2>
              <p className="panel-tarjeta-subtitulo">Consulta los servicios que tienes publicados.</p>
            </div>
            {!cargando && !error && (
              <span className="panel-contador">{servicios.length} {servicios.length === 1 ? 'servicio' : 'servicios'}</span>
            )}
          </div>

          <div className="panel-pestanas">
            <button className={filtro === 'todos' ? 'active' : ''} onClick={() => cambiarFiltro('todos')}>Todos</button>
            <button className={filtro === 'activos' ? 'active' : ''} onClick={() => cambiarFiltro('activos')}>Activos</button>
            <button className={filtro === 'inactivos' ? 'active' : ''} onClick={() => cambiarFiltro('inactivos')}>Inactivos</button>
          </div>

          {cargando && (
            <div className="panel-cargando">
              <EsqueletoLista filas={3} />
              <div className="panel-cargando-texto">
                <div className="spinner-border" role="status"></div>
                <p className="m-0">Cargando tus servicios...</p>
              </div>
            </div>
          )}

          {!cargando && error && (
            <div className="panel-estado panel-estado--error">
              <IlustracionEstado icono={CircleAlert} error />
              <div className="panel-estado-cuerpo">
                <h3 className="panel-estado-titulo">Algo salió mal</h3>
                <p className="panel-estado-texto">{error}</p>
                <button className="btn-servia-secondary" onClick={() => { setCargando(true); setError(''); void cargarServicios(); }}>Intentar de nuevo</button>
              </div>
            </div>
          )}

          {!cargando && !error && servicios.length === 0 && (
            <div className="panel-estado">
              <IlustracionEstado icono={Tags} />
              <div className="panel-estado-cuerpo">
              <h3 className="panel-estado-titulo">{filtro === 'todos' ? 'Tu catálogo está vacío' : `No tienes servicios ${filtro}`}</h3>
              <p className="panel-estado-texto">{filtro === 'todos' ? 'Comienza agregando tu primer servicio para que tus clientes puedan descubrirlo.' : 'No encontramos servicios en esta categoría.'}</p>
            </div>
            </div>
          )}

          {!cargando && !error && servicios.length > 0 && (
            <div className="panel-lista">
              {servicios.map((srv) => (
                <article key={srv.id} className="panel-item servicio-card">
                  
                  {/* Hacemos clic en el área principal para editar */}
                  <Link className="servicio-card-principal" to={`/servicios/${srv.id}`}>
                    <div className={`servicio-icono ${srv.activo ? '' : 'servicio-icono--inactivo'}`} aria-hidden="true">{iniciales(srv.nombre)}</div>
                    <div className="servicio-informacion">
                      <div className="servicio-titulo-fila">
                        <h3>{srv.nombre}</h3>
                        <span className={`servicio-estado ${srv.activo ? 'activo' : 'inactivo'}`}>
                          <span className="servicio-estado-punto" />
                          {srv.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <div className="servicio-datos">
                        <span><small>Precio</small><strong>${srv.precio.toFixed(2)}</strong></span>
                        <span className="servicio-dato-separador" />
                        <span><small>Duración</small><strong><Clock aria-hidden="true" />{srv.duracionMin} min</strong></span>
                      </div>
                    </div>
                  </Link>

                  {/* Botones de acción */}
                  <div className="servicio-acciones">
                    <button onClick={() => navigate(`/servicios/${srv.id}`)} className="btn-servia-secondary btn-servia-sm">Editar</button>
                    <AccionesServicio id={srv.id} nombre={srv.nombre} activo={srv.activo}
                      alMensaje={setAlerta}
                      alCambiarEstado={activo => {
                        setServicios(prev => prev.map(servicio => servicio.id === srv.id ? { ...servicio, activo } : servicio));
                        void cargarServicios();
                      }}
                      alEliminar={mensaje => { setAlerta(mensaje); void cargarServicios(); }} />
                  </div>

                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}