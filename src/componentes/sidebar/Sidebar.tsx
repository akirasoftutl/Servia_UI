import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import './Sidebar.css';
import { useAuth } from '../../contextos/AuthContext';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC = () => {
  const [activeItem, setActiveItem] = useState<string>('dashboard');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { cerrarSesion } = useAuth();
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
          id: 'reservas',
          label: 'Reservas',
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
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'OPERACIONES',
      items: [
        {
          id: 'horario',
          label: 'Horario',
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
    <aside className="sidebar">
      <div className="sidebar-header">
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
                const isActive = activeItem === item.id;
                return (
                  <li key={item.id} className="nav-item">
                    <button
                      className={`nav-link ${isActive ? 'active' : ''}`}
                      onClick={() => setActiveItem(item.id)}
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
            <button className="dropdown-item" onClick={() => { setIsUserMenuOpen(false); navigate('/mi-perfil'); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>Mi Perfil</span>
            </button>

            <button className="dropdown-item" onClick={() => { setIsUserMenuOpen(false); console.log('Configuración'); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Configuración</span>
            </button>

            <div className="dropdown-divider"></div>

            <button className="dropdown-item danger" onClick={async () => { setIsUserMenuOpen(false); await cerrarSesion(); navigate('/login'); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Cerrar sesión</span>
            </button>
          </div>
        )}

        <div 
          className={`user-card ${isUserMenuOpen ? 'open' : ''}`}
          onClick={() => setIsUserMenuOpen((prev) => !prev)}
          style={{ cursor: 'pointer' }}
        >
          <div className="avatar">U</div>
          <div className="user-info">
            <span className="user-name">Urielees</span>
            <span className="user-email">admin@servia.com</span>
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
        </div>
      </div>
    </aside>
  );
};