import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../contextos/AuthContext';

export function RutaProtegida() {
  const { usuario, cargando } = useAuth();

  // Mientras Firebase revisa si hay sesión, mostramos un mensaje
  if (cargando) return <div className="text-center mt-5"><h3>Cargando...</h3></div>;

  // Si no hay usuario, lo pateamos al login
  if (!usuario) return <Navigate to="/login" replace />;

  // Si hay usuario, mostramos la página que quería ver (Layout)
  return <Outlet />;
}