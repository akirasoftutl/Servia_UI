import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { rutas } from '../../router';
const sesion = vi.hoisted(() => ({ usuario: null as { uid: string; email: string } | null, cargando: false, cerrarSesion: vi.fn() }));
vi.mock('../../contextos/AuthContext', () => ({ useAuth: () => sesion }));
vi.mock('../../servicios/api', () => ({ api: vi.fn(() => Promise.resolve({ nombre: 'Negocio de prueba' })), ErrorApi: class extends Error {} }));
vi.mock('../login/Login', () => ({ Login: () => <h1>Iniciar sesión</h1> }));

vi.mock('../horario/Horario.tsx', () => ({ Horario: () => <h1>Horario del negocio</h1> }));

beforeEach(() => { sesion.usuario = null; sesion.cargando = false; });
it('C1 redirige al login sin sesión', async () => {
  const router = createMemoryRouter(rutas, { initialEntries: ['/ayuda'] });
  render(<RouterProvider router={router} />);
  expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  expect(router.state.location.pathname).toBe('/login');
});
it('C1 espera a resolver la sesión antes de mostrar Ayuda', () => {
  sesion.cargando = true;
  render(<RouterProvider router={createMemoryRouter(rutas, { initialEntries: ['/ayuda'] })} />);
  expect(screen.queryByRole('heading', { name: 'Ayuda' })).not.toBeInTheDocument();
  expect(screen.getByText('Cargando...')).toBeVisible();
});
it.each([false, true])('C1/C4 abre Ayuda desde la barra, móvil=%s', async movil => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: movil, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
  sesion.usuario = { uid: 'negocio-prueba', email: 'negocio@example.test' };
  const router = createMemoryRouter(rutas, { initialEntries: ['/horario'] });
  render(<RouterProvider router={router} />);
  expect(screen.getByRole('heading', { name: 'Horario del negocio' })).toBeVisible();
  if (movil) await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
  await userEvent.click(screen.getByRole('button', { name: /Ayuda$/ }));
  expect(router.state.location.pathname).toBe('/ayuda');
  expect(screen.getByRole('heading', { name: 'Ayuda' })).toBeVisible();
  if (movil) {
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute('aria-expanded', 'false');
  }
});
