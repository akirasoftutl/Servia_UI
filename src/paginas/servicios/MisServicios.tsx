import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../../servicios/api';
import './Servicios.css';

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
  const [alerta, setAlerta] = useState('');

  const cargarServicios = async () => {
    setCargando(true);
    setError('');
    try {
      let ruta = '/negocios/mio/servicios';
      if (filtro === 'activos') ruta += '?estado=activos';
      if (filtro === 'inactivos') ruta += '?estado=inactivos';
      const data = await api<Servicio[]>(ruta);
      setServicios(data);
    } catch {
      setError('No pudimos cargar tus servicios. Intenta nuevamente.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarServicios();
  }, [filtro]);

  const handleToggleEstado = async (id: string, estadoActual: boolean, nombre: string) => {
    const accion = estadoActual ? 'desactivar' : 'activar';
    if (!window.confirm(`¿Seguro que quieres ${accion} "${nombre}"?`)) return;

    try {
      const respuesta = await api<{ visible: boolean }>(`/negocios/mio/servicios/${id}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ activo: !estadoActual }),
      });
      
      if (respuesta.visible === false) {
        setAlerta('Ya no tienes servicios activos: tu negocio no aparece para los clientes hasta que actives uno.');
      } else {
        setAlerta(`Servicio ${estadoActual ? 'desactivado' : 'activado'}.`);
      }
      cargarServicios();
    } catch (error: any) {
      alert(error.message || 'Error al cambiar el estado del servicio.');
    }
  };

  const handleEliminar = async (id: string, nombre: string) => {
    if (!window.confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;

    try {
      await api(`/negocios/mio/servicios/${id}`, { method: 'DELETE' });
      setAlerta('Servicio eliminado.');
      cargarServicios();
    } catch (error: any) {
      if (error.estado === 409) {
        if (window.confirm('Este servicio ya tuvo reservas, así que no se puede eliminar. ¿Quieres desactivarlo para que deje de ofrecerse?')) {
          await handleToggleEstado(id, true, nombre);
        }
      } else {
        alert(error.message || 'Error al eliminar el servicio.');
      }
    }
  };

  return (
    <div className="servicios-page">
      <div className="servicios-container">
        
        {alerta && <div className="alert alert-info rounded-4 mb-3">{alerta}</div>}

        <header className="servicios-header">
          <div>
            <span className="servicios-eyebrow">ADMINISTRACIÓN</span>
            <h1>Mis servicios</h1>
            <p>Organiza y administra los servicios de tu negocio.</p>
          </div>
          <Link to="/servicios/nuevo" className="btn-servia-primary">Crear servicio</Link>
        </header>

        <section className="servicios-panel">
          <div className="servicios-panel-header">
            <div>
              <h2>Tu catálogo</h2>
              <p>Consulta los servicios que tienes publicados.</p>
            </div>
            {!cargando && !error && (
              <span className="servicios-contador">{servicios.length} {servicios.length === 1 ? 'servicio' : 'servicios'}</span>
            )}
          </div>

          <div className="servicios-tabs">
            <button className={filtro === 'todos' ? 'active' : ''} onClick={() => setFiltro('todos')}>Todos</button>
            <button className={filtro === 'activos' ? 'active' : ''} onClick={() => setFiltro('activos')}>Activos</button>
            <button className={filtro === 'inactivos' ? 'active' : ''} onClick={() => setFiltro('inactivos')}>Inactivos</button>
          </div>

          {cargando && (
            <div className="servicios-feedback">
              <div className="spinner-border" role="status"></div>
              <p>Cargando tus servicios...</p>
            </div>
          )}

          {!cargando && error && (
            <div className="servicios-feedback">
              <div className="servicios-feedback-icon error">!</div>
              <h3>Algo salió mal</h3>
              <p>{error}</p>
              <button className="servicios-btn-secundario" onClick={cargarServicios}>Intentar de nuevo</button>
            </div>
          )}

          {!cargando && !error && servicios.length === 0 && (
            <div className="servicios-feedback">
              <div className="servicios-feedback-icon">✦</div>
              <h3>{filtro === 'todos' ? 'Tu catálogo está vacío' : `No tienes servicios ${filtro}`}</h3>
              <p>{filtro === 'todos' ? 'Comienza agregando tu primer servicio para que tus clientes puedan descubrirlo.' : 'No encontramos servicios en esta categoría.'}</p>
            </div>
          )}

          {!cargando && !error && servicios.length > 0 && (
            <div className="servicios-lista">
              {servicios.map((srv) => (
                <article key={srv.id} className="servicio-card">
                  
                  {/* Hacemos clic en el área principal para editar */}
                  <div className="servicio-card-principal" onClick={() => navigate(`/servicios/${srv.id}`)} style={{ cursor: 'pointer' }}>
                    <div className="servicio-icono"><span>✦</span></div>
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
                        <span><small>Duración</small><strong>{srv.duracionMin} min</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Botones de acción */}
                  <div className="d-flex gap-2 pe-3 align-items-center">
                    <button onClick={() => navigate(`/servicios/${srv.id}`)} className="btn btn-sm btn-servia-secondary">Editar</button>
                    <button onClick={() => handleToggleEstado(srv.id, srv.activo, srv.nombre)} className={`btn btn-sm ${srv.activo ? 'btn-outline-warning' : 'btn-outline-success'}`}>
                      {srv.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button onClick={() => handleEliminar(srv.id, srv.nombre)} className="btn btn-sm btn-outline-danger">Eliminar</button>
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