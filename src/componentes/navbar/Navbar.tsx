import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contextos/AuthContext';
import './Navbar.css';

function Navbar() {
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { usuario, cerrarSesion } = useAuth();

  const handleLogout = async () => {
    await cerrarSesion();
    navigate('/login');
  };

  const handleLoginClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuOpen(false);
    navigate('/login');
  };

  const handleRegistrarClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuOpen(false);
    navigate('/registro-negocio');
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const tiposDeNegocios: string[] = [
    'Barberías Masculino',
    'Peluquerías Unisex',
    'Colorimetría y Alaciados',
    'Tratamientos Capilares',
    'Spas y Centros de Relajación',
    'Cosmetología y Facialistas',
    'Salones de Depilación ',
    'Bronceado y Cuidado de la Piel',
    'Salones de Uñas',
    'Cejas y Microblading',
    'Diseño de Pestañas',
    'Gimnasios Tradicionales',
    'Estudios de Yoga y Pilates',
    'Entrenamiento Funcional',
    'Academias de Danza, Baile',
    'Maquillaje Profesional',
    'Peinados para Eventos',
    'Asesoría de Imagen',
    'Clases de Automaquillaje'
  ];

  const caracteristicas: string[] = [
    'Programación', 'Punto de venta',
    'Reputación Online', 'Marketing y promociones', 'Pagos en línea',
  ];

  return (
    <header className="navbar">
      <div className="navbar__backdrop" />

      <a href="/" className="navbar__logo">
        Servia
      </a>

      <nav className="navbar__links">
        <div className="dropdown">
          <a href="#negocios" className="dropdown__toggle">Tipos de negocios</a>
          <div className="dropdown__menu">
            {tiposDeNegocios.map((item, index) => (
              <a key={index} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}>{item}</a>
            ))}
          </div>
        </div>

        <div className="dropdown">
          <a href="#caracteristicas" className="dropdown__toggle">Características</a>
          <div className="dropdown__menu">
            {caracteristicas.map((item, index) => (
              <a key={index} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}>{item}</a>
            ))}
          </div>
        </div>

        <a href="#precios">Precios</a>
      </nav>

      <div className="navbar__actions">
        {usuario && (
          <button type="button" className="btn btn--outline" onClick={handleLogout}>
            Cerrar sesión
          </button>
        )}

        <a href="#marketplace" className="btn btn--outline marketplace">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 10h18l-2-6H5l-2 6Z" />
            <path d="M5 10v10h14V10M9 20v-6h6v6M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
          </svg>
          Marketplace
        </a>

        <a href="/login" className="btn btn--dark" onClick={handleLoginClick}>
          Inicia sesión
        </a>

        <div className="menu-container" ref={menuRef}>
          <button
            className="btn btn--outline menu-button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label="Abrir o cerrar menú"
          >
            Menú
            <span className={`hamburger ${menuOpen ? 'is-open' : ''}`}>
              <span />
              <span />
              <span />
            </span>
          </button>

          <div className={`menu-dropdown ${menuOpen ? 'is-visible' : ''}`}>
            <div className="menu-dropdown__section">
              <span className="menu-dropdown__title">Para empresas</span>
              <a href="/registro-negocio" className="menu-dropdown__link--purple" onClick={handleRegistrarClick}>
                Regístrate
              </a>
              <a href="#casa" onClick={() => setMenuOpen(false)}>Casa</a>
              <a href="#descarga" onClick={() => setMenuOpen(false)}>Descarga la aplicación</a>
              <a href="#blog" onClick={() => setMenuOpen(false)}>Blog</a>
              <a href="#ayuda" onClick={() => setMenuOpen(false)}>Ayuda y soporte</a>

              <a href="#idioma" className="menu-dropdown__language" onClick={() => setMenuOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                español (MX)
              </a>
            </div>
          </div>
        </div>

      </div>
    </header>
  );
}

export default Navbar;
