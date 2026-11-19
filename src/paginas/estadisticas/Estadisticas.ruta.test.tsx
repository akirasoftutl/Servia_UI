import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { rutas } from '../../router';

const sesion = vi.hoisted(() => ({ usuario: null as { uid: string } | null, cargando: false }));
vi.mock('../../contextos/AuthContext', () => ({ useAuth: () => sesion }));
vi.mock('../../servicios/api', () => ({ api: vi.fn(() => new Promise(() => {})), ErrorApi: class extends Error {} }));
vi.mock('../../componentes/layout/Layout.tsx', async () => {
  const { Outlet } = await import('react-router');
  return { Layout: () => <Outlet /> };
});
vi.mock('../login/Login', () => ({ Login: () => <h1>Iniciar sesión para entrar</h1> }));

it('protege Estadísticas sin sesión', async () => {
  sesion.usuario = null;
  const router = createMemoryRouter(rutas, { initialEntries: ['/estadisticas'] });
  render(<RouterProvider router={router} />);
  expect(await screen.findByText('Iniciar sesión para entrar')).toBeVisible();
  expect(router.state.location.pathname).toBe('/login');
});
it('abre la página de Estadísticas con sesión', async () => {
  sesion.usuario = { uid: 'negocio-simulado' };
  const router = createMemoryRouter(rutas, { initialEntries: ['/estadisticas'] });
  render(<RouterProvider router={router} />);
  expect(await screen.findByRole('heading', { name: 'Estadísticas', level: 1 })).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('Cargando estadísticas...');
});
