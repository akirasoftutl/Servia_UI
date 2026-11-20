import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { rutas } from '../../router';

const sesion = vi.hoisted(() => ({ usuario: null as { uid: string; email: string; providerData: unknown[] } | null, cargando: false, cerrarSesion: vi.fn() }));
vi.mock('../../contextos/AuthContext', () => ({ useAuth: () => sesion }));
vi.mock('../../servicios/api', () => ({ api: vi.fn(() => new Promise(() => {})), ErrorApi: class extends Error {} }));
vi.mock('../../servicios/firebase', () => ({ auth: null }));
vi.mock('../../componentes/layout/Layout.tsx', async () => {
  const { Outlet } = await import('react-router');
  return { Layout: () => <Outlet /> };
});
vi.mock('../login/Login', () => ({ Login: () => <h1>Iniciar sesión para entrar</h1> }));

const abrir = (ruta: string) => {
  const router = createMemoryRouter(rutas, { initialEntries: [ruta] });
  render(<RouterProvider router={router} />);
  return router;
};

beforeEach(() => { sesion.usuario = { uid: 'negocio-simulado', email: 'negocio@example.test', providerData: [] }; });

it('UI109 protege /configuracion sin sesión', async () => {
  sesion.usuario = null;
  const router = abrir('/configuracion');
  expect(await screen.findByText('Iniciar sesión para entrar')).toBeVisible();
  expect(router.state.location.pathname).toBe('/login');
});
it('UI109 abre /configuracion con sesión, ya no cae en el 404', async () => {
  const router = abrir('/configuracion');
  expect(await screen.findByRole('heading', { name: 'Configuración', level: 1 })).toBeVisible();
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(4);
  expect(router.state.location.pathname).toBe('/configuracion');
});
it.each([
  ['/ayuda', 'Ayuda'],
  ['/soporte', 'Reportar un problema'],
  ['/preferencias-notificaciones', 'Preferencias de notificaciones'],
])('UI109 conserva la ruta %s', async (ruta, titulo) => {
  const router = abrir(ruta);
  expect(await screen.findByRole('heading', { name: titulo, level: 1 })).toBeVisible();
  expect(router.state.location.pathname).toBe(ruta);
});
