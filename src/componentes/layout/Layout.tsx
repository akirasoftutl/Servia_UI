import { Outlet, useLocation } from 'react-router';
import Navbar from '../navbar/Navbar';
import Footer from '../footer/Footer';
import { Sidebar } from '../sidebar/Sidebar';
import { useAuth } from '../../contextos/AuthContext';
import { NotificacionesProvider } from '../../contextos/NotificacionesProvider';
import './Layout.css';

export function Layout() {
  const { usuario } = useAuth();
  return <ContenidoLayout key={usuario?.uid ?? 'sin-sesion'} />;
}

function ContenidoLayout() {
  const location = useLocation();
  const { usuario, cargando } = useAuth();

  const ocultarHYF = 
    location.pathname === '/login' || 
    location.pathname === '/registro-negocio';

  if (cargando) {
    return (
      <div className="layout">
        <main className="contenido">
          <Outlet />
        </main>
      </div>
    );
  }

  const showSidebar = !ocultarHYF && !!usuario;

  const cuerpo = (
    <div className={`layout ${showSidebar ? 'layout--with-sidebar' : ''}`}>
      {!ocultarHYF && (usuario ? <Sidebar /> : <Navbar />)}
      
      <main className="contenido">
        <Outlet />
      </main>
      
      {!ocultarHYF && !usuario && <Footer />}
    </div>
  );

  return showSidebar ? <NotificacionesProvider>{cuerpo}</NotificacionesProvider> : cuerpo;
}