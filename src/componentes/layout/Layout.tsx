import { Outlet, useLocation } from 'react-router';
import Navbar from '../navbar/Navbar';
import Footer from '../footer/Footer';

export function Layout() {
  const location = useLocation();

  const esPaginaLogin = location.pathname === '/login';
  return (
    <div className="layout">
      {!esPaginaLogin && <Navbar />}
      
      <main className="contenido">
        <Outlet />
      </main>
      
      {!esPaginaLogin && <Footer />}
    </div>
  );
}