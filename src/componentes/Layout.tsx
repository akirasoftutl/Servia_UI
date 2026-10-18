import { Outlet, Link, useNavigate } from 'react-router'; 
import { useAuth } from '../contextos/AuthContext';

export function Layout() {
  const { usuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await cerrarSesion();
    navigate('/login');
  };

  return (
    <div>
      <header className="encabezado d-flex justify-content-between align-items-center">
        <Link to="/" className="marca">
          Servia <small>Panel del negocio</small>
        </Link>
        
        {usuario && (
          <button onClick={handleLogout} className="btn btn-outline-danger btn-sm">
            Cerrar sesión
          </button>
        )}
      </header>
      
      <main className="contenido">
        <Outlet />
      </main>
    </div>
  );
}