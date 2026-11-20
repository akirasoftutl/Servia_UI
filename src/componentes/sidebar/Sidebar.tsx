import { CalendarCheck, CalendarOff, ChartColumn, ChevronRight, Clock, Inbox, LayoutDashboard, LogOut, Menu, Scissors, Settings, UserRound, Users, X, type LucideIcon } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import './Sidebar.css';
import '../../estilos/panel.css';
import { api } from '../../servicios/api';
import { useAuth } from '../../contextos/AuthContext';
import { useNotificaciones } from '../../contextos/notificacionesContexto';

interface NavItem {
  id: string;
  label: string;
  icono: LucideIcon;
  ruta?: string;
  badge?: number;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

/** Un ítem está activo en su ruta y en las que cuelgan de ella (/reservas/:id, /servicios/nuevo). */
const esRutaActiva = (ruta: string | undefined, pathname: string) =>
  !!ruta && (pathname === ruta || pathname.startsWith(`${ruta}/`));

const RUTAS_DE_CONFIGURACION = ['/configuracion', '/ayuda', '/soporte', '/preferencias-notificaciones'];

// Debe coincidir con el punto de corte del cajón en panel.css (@media (max-width: 900px)).
const CONSULTA_CAJON = '(max-width: 900px)';

export const Sidebar: React.FC = () => {
  const [angosta, setAngosta] = useState(() => window.matchMedia?.(CONSULTA_CAJON).matches ?? false);
  const [abierta, setAbierta] = useState(false);
  const botonMenu = useRef<HTMLButtonElement>(null);
  const barra = useRef<HTMLElement>(null);

  useEffect(() => {
    const media = window.matchMedia?.(CONSULTA_CAJON);
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
    const controles = () => Array.from(barra.current?.querySelectorAll<HTMLElement>('button') ?? []);
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
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { cerrarSesion, usuario } = useAuth();
  const { noLeidas } = useNotificaciones();
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
      title: 'OPERACIÓN DIARIA',
      items: [
        { id: 'resumen', label: 'Resumen', ruta: '/resumen', icono: LayoutDashboard },
        { id: 'reservas', label: 'Reservas', ruta: '/reservas', icono: CalendarCheck },
        { id: 'clientes', label: 'Clientes', ruta: '/clientes', icono: Users },
        { id: 'avisos', label: 'Avisos', ruta: '/avisos', icono: Inbox, badge: noLeidas },
      ],
    },
    {
      title: 'MI NEGOCIO',
      items: [
        { id: 'servicios', label: 'Servicios', ruta: '/servicios', icono: Scissors },
        { id: 'horario', label: 'Horario', ruta: '/horario', icono: Clock },
        { id: 'bloqueos', label: 'Bloqueos', ruta: '/bloqueos', icono: CalendarOff },
        { id: 'estadisticas', label: 'Estadísticas', ruta: '/estadisticas', icono: ChartColumn },
      ],
    },
  ];
  // Ayuda, Soporte y Preferencias ya no están en el menú; sus cabeceras dicen «Configuración», así que ese botón queda activo.
  const configuracionActiva = RUTAS_DE_CONFIGURACION.some((ruta) => esRutaActiva(ruta, pathname));

  return (
    <>
    <header className="panel-barra-movil">
      <button ref={botonMenu} className="panel-boton-icono" aria-label={abierta ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={abierta} aria-controls="panel-navegacion" onClick={() => setAbierta(!abierta)}><Menu aria-hidden="true" /></button>
      <span className="panel-barra-movil-marca">Servia</span>
    </header>
    {angosta && abierta && <button className="panel-menu-fondo" aria-label="Cerrar menú al tocar fuera" tabIndex={-1} onClick={() => setAbierta(false)} />}
    <aside ref={barra} id="panel-navegacion" aria-label="Navegación del panel" className="sidebar panel-barra-lateral" hidden={angosta && !abierta}>
      <div className="sidebar-header">
        <div className="brand">
          <h1 className="brand-title">Servia</h1>
        </div>
        {angosta && <button className="panel-boton-icono" aria-label="Cerrar menú" onClick={() => setAbierta(false)}><X aria-hidden="true" /></button>}

      </div>

      <nav className="sidebar-nav">
        {navGroups.map((group) => (
          <div key={group.title} className="nav-group">
            <h2 className="group-title">{group.title}</h2>
            <ul className="nav-list">
              {group.items.map((item) => {
                const isActive = esRutaActiva(item.ruta, pathname);
                const Icono = item.icono;
                return (
                  <li key={item.id} className="nav-item">
                    <button
                      className={`nav-link ${isActive ? 'active' : ''}`}
                      aria-label={item.badge ? `${item.label}, ${item.badge} ${item.badge === 1 ? 'aviso sin leer' : 'avisos sin leer'}` : undefined}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => {
                        setAbierta(false);
                        if (item.ruta) navigate(item.ruta);
                      }}
                    >
                      <Icono aria-hidden="true" />
                      <span>{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="panel-sidebar-globo" aria-hidden="true">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <nav className="sidebar-config" aria-label="Configuración">
        <button
          className={`nav-link ${configuracionActiva ? 'active' : ''}`}
          aria-current={configuracionActiva ? 'page' : undefined}
          onClick={() => { setIsUserMenuOpen(false); setAbierta(false); navigate('/configuracion'); }}
        >
          <Settings aria-hidden="true" />
          <span>Configuración</span>
        </button>
      </nav>

      <div className="user-profile" ref={userMenuRef}>
        {isUserMenuOpen && (
          <div className="user-dropdown-menu">
            <button className="dropdown-item" onClick={() => { setIsUserMenuOpen(false); setAbierta(false); navigate('/mi-perfil'); }}>
              <UserRound aria-hidden="true" />
              <span>Mi Perfil</span>
            </button>

            <div className="dropdown-divider"></div>

            <button className="dropdown-item danger" onClick={async () => { setIsUserMenuOpen(false); setAbierta(false); await cerrarSesion(); navigate('/login'); }}>
              <LogOut aria-hidden="true" />
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
          <ChevronRight aria-hidden="true" className={`chevron-icon ${isUserMenuOpen ? 'rotated' : ''}`} />
        </button>
      </div>
    </aside>
    </>
  );
};
