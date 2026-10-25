import { Outlet, useLocation } from 'react-router';
import Navbar from '../navbar/Navbar';
import Footer from '../footer/Footer';
import { Sidebar } from '../sidebar/Sidebar';
import { useAuth } from '../../contextos/AuthContext';

export function Layout() {
  const location = useLocation();
  const { usuario, cargando } = useAuth();

  const ocultarHYF = 
    location.pathname === '/login' || location.pathname === '/registro-negocio';

  if (cargando) {
    return (
      <div className="layout">
        <main className="contenido">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="layout">
      {!ocultarHYF && (usuario ? <Sidebar /> : <Navbar />)}
      
      <main className="contenido">
        <Outlet />
      </main>
      
      {!ocultarHYF && !usuario && <Footer />}
    </div>
  );
}