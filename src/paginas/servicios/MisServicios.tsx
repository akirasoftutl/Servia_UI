
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../../servicios/api';
import './Servicios.css'

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

  useEffect(() => {
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

    cargarServicios();
  }, [filtro]);

  return (
    <div className="servicios-page">
      <div className="servicios-container">

        {/* Encabezado */}
        <header className="servicios-header">
          <div>
            <span className="servicios-eyebrow">ADMINISTRACIÓN</span>
            <h1>Mis servicios</h1>
            <p>Organiza y administra los servicios de tu negocio.</p>
          </div>

          <Link to="/servicios/nuevo" className="btn-servia-primary">

            Crear servicio
          </Link>
        </header>

        {/* Panel principal */}
        <section className="servicios-panel">

          <div className="servicios-panel-header">
            <div>
              <h2>Tu catálogo</h2>
              <p>Consulta los servicios que tienes publicados.</p>
            </div>

            {!cargando && !error && (
              <span className="servicios-contador">
                {servicios.length} {servicios.length === 1 ? 'servicio' : 'servicios'}
              </span>
            )}
          </div>

          {/* Filtros */}
          <div className="servicios-tabs">
            <button
              className={filtro === 'todos' ? 'active' : ''}
              onClick={() => setFiltro('todos')}
            >
              Todos
            </button>

            <button
              className={filtro === 'activos' ? 'active' : ''}
              onClick={() => setFiltro('activos')}
            >
              Activos
            </button>

            <button
              className={filtro === 'inactivos' ? 'active' : ''}
              onClick={() => setFiltro('inactivos')}
            >
              Inactivos
            </button>
          </div>

          {/* Cargando */}
          {cargando && (
            <div className="servicios-feedback">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
              <p>Cargando tus servicios...</p>
            </div>
          )}

          {/* Error */}
          {!cargando && error && (
            <div className="servicios-feedback">
              <div className="servicios-feedback-icon error">!</div>
              <h3>Algo salió mal</h3>
              <p>{error}</p>
              <button
                className="servicios-btn-secundario"
                onClick={() => setFiltro(filtro)}
              >
                Intentar de nuevo
              </button>
            </div>
          )}

          {/* Sin resultados */}
          {!cargando && !error && servicios.length === 0 && (
            <div className="servicios-feedback">
              <div className="servicios-feedback-icon">✦</div>

              <h3>
                {filtro === 'todos' && 'Tu catálogo está vacío'}
                {filtro === 'activos' && 'No tienes servicios activos'}
                {filtro === 'inactivos' && 'No tienes servicios inactivos'}
              </h3>

              <p>
                {filtro === 'todos'
                  ? 'Comienza agregando tu primer servicio para que tus clientes puedan descubrirlo.'
                  : 'No encontramos servicios en esta categoría.'}
              </p>
            </div>
          )}

          {!cargando && !error && servicios.length > 0 && (
            <div className="servicios-lista">
              {servicios.map((srv) => (
                <article
                  key={srv.id}
                  className="servicio-card"
                  onClick={() => navigate(`/servicios/${srv.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/servicios/${srv.id}`);
                    }
                  }}
                >
                  <div className="servicio-card-principal">
                    <div className="servicio-icono">
                      <span>✦</span>
                    </div>

                    <div className="servicio-informacion">
                      <div className="servicio-titulo-fila">
                        <h3>{srv.nombre}</h3>
                        <span className={`servicio-estado ${srv.activo ? 'activo' : 'inactivo'}`}>
                          <span className="servicio-estado-punto" />
                          {srv.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>

                      <div className="servicio-datos">
                        <span>
                          <small>Precio</small>
                          <strong>${srv.precio.toFixed(2)}</strong>
                        </span>

                        <span className="servicio-dato-separador" />

                        <span>
                          <small>Duración</small>
                          <strong>{srv.duracionMin} min</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="servicio-card-flecha">
                    <span>›</span>
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
