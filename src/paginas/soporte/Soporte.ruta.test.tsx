import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { rutas } from '../../router';
import { api } from '../../servicios/api';
vi.mock('../../servicios/api', () => ({ api: vi.fn() }));
vi.mock('../../contextos/AuthContext', () => ({ useAuth: () => ({ usuario: { uid: 'negocio' }, cargando: false, cerrarSesion: vi.fn() }) }));
vi.mock('../../servicios/firebase', () => ({ auth: null, firebaseConfigurado: false }));
it('registra soporte protegido, ya no está en la barra y conserva su patrón', async () => {
  vi.mocked(api).mockImplementation(async ruta => ruta === '/negocios/mio' ? { nombre: 'Mi negocio' } : []);
  const protegida = rutas[0].children!.find(r => r.children?.some(h => h.path === 'mi-perfil'))!;
  expect(protegida.children?.some(r => r.path === 'soporte')).toBe(true);
  const router = createMemoryRouter(rutas, { initialEntries: ['/soporte'] });
  render(<RouterProvider router={router} />);
  expect(await screen.findByRole('heading', { name: 'Reportar un problema', level: 1 })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reportar un problema' })).not.toBeInTheDocument();
  expect(document.querySelector('.panel-barra-lateral')).not.toHaveTextContent('Reportar un problema');
  expect(router.state.location.pathname).toBe('/soporte');
});
