import { Bell } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import './Sidebar.css';
import '../../estilos/panel.css';
import { api } from '../../servicios/api';
import { useAuth } from '../../contextos/AuthContext';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  ruta?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

/** Un ítem está activo en su ruta y en las que cuelgan de ella (/reservas/:id, /servicios/nuevo). */
const esRutaActiva = (ruta: string | undefined, pathname: string) =>
  !!ruta && (pathname === ruta || pathname.startsWith(`${ruta}/`));

export const Sidebar: React.FC = () => {
  const [angosta, setAngosta] = useState(() => window.matchMedia?.('(max-width: 650px)').matches ?? false);
  const [abierta, setAbierta] = useState(false);
  const botonMenu = useRef<HTMLButtonElement>(null);
  const barra = useRef<HTMLElement>(null);

  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 650px)');
    if (!media) return;
    const actualizar = () => { setAngosta(media.matches); setAbierta(false); };
    media.addEventListener('change', actualizar);
    return () => media.removeEventListener('change', actualizar);
  }, []);

  useEffect(() => {
    if (!angosta || !abierta) return;
    const activador = botonMenu.current;
    const contenido = barra.current?.closest('.layout')?.querySelector('main');
    contenido?.setAttribute('inert', '');
    const controles = () => Array.from(barra.current?.querySelectorAll<HTMLElement>('button, input') ?? []);
    controles()[0]?.focus();
    const teclado = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setAbierta(false); }
      if (event.key === 'Tab') {
        const elementos = controles();
        const primero = elementos[0];
        const ultimo = elementos.at(-1);
        if (event.shiftKey && document.activeElement === primero) { event.preventDefault(); ultimo?.focus(); }
        else if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primero?.focus(); }
      }
    };
    document.addEventListener('keydown', teclado);
    return () => {
      contenido?.removeAttribute('inert');
      document.removeEventListener('keydown', teclado);
      activador?.focus();
    };
  }, [angosta, abierta]);

  const { pathname } = useLocation();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { cerrarSesion, usuario } = useAuth();
  const [negocio, setNegocio] = useState<{ uid: string; nombre: string } | null>(null);
  const uid = usuario?.uid;
  const correo = usuario?.email ?? '';
  const nombre = negocio?.uid === uid ? negocio?.nombre || correo : correo;

  useEffect(() => {
    if (!uid) return;
    let vigente = true;
    api<{ nombre: string }>('/negocios/mio').then(
      perfil => { if (vigente) setNegocio({ uid, nombre: perfil.nombre }); },
      () => { if (vigente) setNegocio(null); },
    );
    return () => { vigente = false; };
  }, [uid]);
  const navigate = useNavigate();

  // Cerrar el menú si se hace clic fuera del contenedor 'user-profile'
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);


  const navGroups: NavGroup[] = [
    {
      title: 'PRINCIPAL',
      items: [
        {
          id: 'resumen',
          label: 'Resumen',
          ruta: '/resumen',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="7" height="9" x="3" y="3" rx="1" />
              <rect width="7" height="5" x="14" y="3" rx="1" />
              <rect width="7" height="9" x="14" y="12" rx="1" />
              <rect width="7" height="5" x="3" y="16" rx="1" />
            </svg>
          ),
        },
        {
          id: 'reservas',
          label: 'Reservas',
          ruta: '/reservas',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          ),
        },
        {
          id: 'servicios',
          label: 'Servicios',
          ruta: '/servicios',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          ),
        },
        { id: 'clientes', label: 'Clientes', ruta: '/clientes', icon: <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="4" /><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
      ],
    },
    {
      title: 'OPERACIONES',
      items: [
        { id: 'soporte', label: 'Reportar un problema', ruta: '/soporte', icon: <span aria-hidden="true">?</span> },
        { id: 'preferencias-notificaciones', label: 'Notificaciones', ruta: '/preferencias-notificaciones', icon: <Bell aria-hidden="true" /> },
        { id: 'ayuda', label: 'Ayuda', ruta: '/ayuda', icon: <span aria-hidden="true">?</span> },
        { id: 'estadisticas', label: 'Estadísticas', ruta: '/estadisticas', icon: <span aria-hidden="true">▥</span> },
        { id: 'bloqueos', label: 'Bloqueos', ruta: '/bloqueos', icon: <span aria-hidden="true">▣</span> },
        {
          id: 'horario',
          label: 'Horario',
          ruta: '/horario',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
          ),
        },
      ],
    },
  ];

  return (
    <>
    <header className="panel-barra-movil">
      <button ref={botonMenu} className="btn-servia-secondary" aria-label={abierta ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={abierta} aria-controls="panel-navegacion" onClick={() => setAbierta(!abierta)}>☰</button>
      <span>Servia</span>
    </header>
    {angosta && abierta && <button className="panel-menu-fondo" aria-label="Cerrar menú al tocar fuera" tabIndex={-1} onClick={() => setAbierta(false)} />}
    <aside ref={barra} id="panel-navegacion" aria-label="Navegación del panel" className="sidebar panel-barra-lateral" hidden={angosta && !abierta}>
      <div className="sidebar-header">
        {angosta && <button className="btn-servia-secondary" aria-label="Cerrar menú" onClick={() => setAbierta(false)}>×</button>}
        <div className="brand">
          <h1 className="brand-title">Servia</h1>
        </div>

      </div>

      <div className="search-container">
        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="Buscar..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <nav className="sidebar-nav">
        {navGroups.map((group) => (
          <div key={group.title} className="nav-group">
            <h2 className="group-title">{group.title}</h2>
            <ul className="nav-list">
              {group.items.map((item) => {
                const isActive = esRutaActiva(item.ruta, pathname);
                return (
                  <li key={item.id} className="nav-item">
                    <button
                      className={`nav-link ${isActive ? 'active' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => {
                        setAbierta(false);
                        if (item.ruta) navigate(item.ruta);
                      }}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>


      <div className="user-profile" ref={userMenuRef}>
        {isUserMenuOpen && (
          <div className="user-dropdown-menu">
            <button className="dropdown-item" onClick={() => { setIsUserMenuOpen(false); setAbierta(false); navigate('/mi-perfil'); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>Mi Perfil</span>
            </button>

            <button className="dropdown-item" onClick={() => { setIsUserMenuOpen(false); setAbierta(false); console.log('Configuración'); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Configuración</span>
            </button>

            <div className="dropdown-divider"></div>

            <button className="dropdown-item danger" onClick={async () => { setIsUserMenuOpen(false); setAbierta(false); await cerrarSesion(); navigate('/login'); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Cerrar sesión</span>
            </button>
          </div>
        )}

        <button type="button"
          aria-label="Menú de la cuenta"
          className={`user-card ${isUserMenuOpen ? 'open' : ''}`}
          onClick={() => setIsUserMenuOpen((prev) => !prev)}
          style={{ cursor: 'pointer' }}
        >
          <div className="avatar">{nombre.charAt(0).toLocaleUpperCase()}</div>
          <div className="user-info">
            <span className="user-name" title={nombre}>{nombre}</span>
            <span className="user-email" title={correo}>{correo}</span>
          </div>
          <svg 
            className={`chevron-icon ${isUserMenuOpen ? 'rotated' : ''}`} 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
          >
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </button>
      </div>
    </aside>
    </>
  );
};
