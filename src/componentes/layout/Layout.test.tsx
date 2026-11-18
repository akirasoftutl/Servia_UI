import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';
import { Layout } from './Layout';

const sesion = vi.hoisted(() => ({ usuario: { uid: 'negocio' } as { uid: string } | null, cargando: false }));
vi.mock('../../contextos/AuthContext', () => ({ useAuth: () => sesion }));
vi.mock('../sidebar/Sidebar', () => ({ Sidebar: () => <button>Menú del panel</button> }));
vi.mock('../navbar/Navbar', () => ({ default: () => <button>Navegación pública</button> }));
vi.mock('../footer/Footer', () => ({ default: () => <footer>Pie público</footer> }));

function mostrar(ruta = '/reservas') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path={ruta} element={<Layout />}>
          <Route index element={<p>Contenido de la página</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('Layout', () => {
  beforeEach(() => {
    sesion.usuario = { uid: 'negocio' };
    sesion.cargando = false;
  });

  it('muestra el sidebar y el contenido de la ruta con sesión iniciada', () => {
    mostrar();
    expect(screen.getByRole('button', { name: 'Menú del panel' })).toBeInTheDocument();
    expect(screen.getByText('Contenido de la página')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Navegación pública' })).not.toBeInTheDocument();
  });

  it('muestra la navegación y el pie públicos para un visitante', () => {
    sesion.usuario = null;
    mostrar();
    expect(screen.getByRole('button', { name: 'Navegación pública' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Pie público');
    expect(screen.queryByRole('button', { name: 'Menú del panel' })).not.toBeInTheDocument();
  });

  it('oculta la navegación pública en login y registro', () => {
    sesion.usuario = null;
    mostrar('/login');
    expect(screen.queryByRole('button', { name: 'Navegación pública' })).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    expect(screen.getByText('Contenido de la página')).toBeInTheDocument();
  });
});
