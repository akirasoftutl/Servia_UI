import { Outlet, useLocation } from 'react-router';
import Navbar from '../navbar/Navbar';
import Footer from '../footer/Footer';

export function Layout() {
  const location = useLocation();


  const ocultarHYF = 
    location.pathname === '/login' || location.pathname === '/registro-negocio';

  return (
    <div className="layout">
      {!ocultarHYF && <Navbar />}
      
      <main className="contenido">
        <Outlet />
      </main>
      
      {!ocultarHYF && <Footer />}
    </div>
  );
}