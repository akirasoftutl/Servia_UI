import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../servicios/api';

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
      } catch (err) {
        setError('No pudimos cargar tus servicios.');
      } finally {
        setCargando(false);
      }
    };
    cargarServicios();
  }, [filtro]);

  const handleFiltroChange = (nuevoFiltro: 'todos' | 'activos' | 'inactivos') => {
    setFiltro(nuevoFiltro);
  };

  if (cargando) return <div className="text-center mt-5"><h3>Cargando servicios...</h3></div>;
  if (error) return (
    <div className="text-center mt-5">
      <div className="alert alert-danger">{error}</div>
      <button className="btn btn-outline-danger" onClick={() => setFiltro(filtro)}>Reintentar</button>
    </div>
  );

  return (
    <div className="container py-5" style={{ maxWidth: '900px' }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold mb-0">Mis Servicios</h2>
        <Link to="/servicios/nuevo" className="btn text-white fw-bold px-4" style={{ backgroundColor: '#e27441', borderRadius: '8px' }}>
          + Nuevo servicio
        </Link>
      </div>

      {/* Filtros */}
      <div className="d-flex gap-2 mb-4">
        <button 
          className={`btn ${filtro === 'todos' ? 'btn-dark' : 'btn-outline-dark'}`} 
          onClick={() => handleFiltroChange('todos')}
        >
          Todos
        </button>
        <button 
          className={`btn ${filtro === 'activos' ? 'btn-dark' : 'btn-outline-dark'}`} 
          onClick={() => handleFiltroChange('activos')}
        >
          Activos
        </button>
        <button 
          className={`btn ${filtro === 'inactivos' ? 'btn-dark' : 'btn-outline-dark'}`} 
          onClick={() => handleFiltroChange('inactivos')}
        >
          Inactivos
        </button>
      </div>

      {/* Lista / Tabla */}
      <div className="card shadow-sm border-0 rounded-4">
        <div className="card-body p-0">
          {servicios.length === 0 ? (
            <div className="text-center p-5">
              <h5 className="text-muted mb-3">
                {filtro === 'todos' && 'Aún no tienes servicios. Publica el primero.'}
                {filtro === 'activos' && 'No tienes servicios activos.'}
                {filtro === 'inactivos' && 'No tienes servicios inactivos.'}
              </h5>
              {filtro === 'todos' && (
                <Link to="/servicios/nuevo" className="btn text-white" style={{ backgroundColor: '#e27441' }}>
                  Publicar el primero
                </Link>
              )}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="py-3 px-4">Servicio</th>
                    <th className="py-3">Precio</th>
                    <th className="py-3">Duración</th>
                    <th className="py-3">Estado</th>
                    <th className="py-3 px-4 text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {servicios.map((srv) => (
                    <tr key={srv.id} onClick={() => navigate(`/servicios/${srv.id}`)} style={{ cursor: 'pointer' }}>
                      <td className="px-4 fw-semibold">{srv.nombre}</td>
                      <td>${srv.precio.toFixed(2)}</td>
                      <td>{srv.duracionMin} min</td>
                      <td>
                        <span className={`badge ${srv.activo ? 'bg-success' : 'bg-secondary'}`}>
                          {srv.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 text-end">
                        <button className="btn btn-sm btn-outline-secondary">Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}