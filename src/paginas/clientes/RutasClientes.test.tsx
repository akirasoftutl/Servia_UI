import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { rutas } from '../../router';
import { api } from '../../servicios/api';
vi.mock('../../servicios/api', () => ({ api: vi.fn() }));
vi.mock('../../contextos/AuthContext', () => ({ useAuth: () => ({ usuario: { uid: 'negocio' }, cargando: false, cerrarSesion: vi.fn() }) }));
vi.mock('../../servicios/firebase', () => ({ auth: null, firebaseConfigurado: false }));
it.each(['/clientes', '/clientes/ana'])('registra %s dentro de RutaProtegida y funciona al recargar', async (ruta) => {
  vi.mocked(api).mockResolvedValue({ cliente: { nombre: 'Ana', ultimaReserva: '2030-11-04T02:00:00Z' }, items: [], siguiente: null });
  const protegida = rutas[0].children!.find((r) => r.children?.some((h) => h.path === 'mi-perfil'))!;
  expect(protegida.children?.some((r) => r.path === (ruta === '/clientes' ? 'clientes' : 'clientes/:clienteUid'))).toBe(true);
  render(<RouterProvider router={createMemoryRouter(rutas, { initialEntries: [ruta] })} />);
  expect(await screen.findByRole('heading', { name: ruta === '/clientes' ? 'Clientes' : 'Detalle del cliente', level: 1 })).toBeInTheDocument();
});
