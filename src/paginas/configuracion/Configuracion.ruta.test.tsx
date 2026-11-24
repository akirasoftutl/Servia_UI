import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { rutas } from '../../router';
import { api, ErrorApi } from '../../servicios/api';
import { MENSAJE_ERROR_SERVIDOR } from '../../servicios/mensajeDeError';
import { ultimaAlerta } from '../../pruebas/mockAlertas';

const sesion = vi.hoisted(() => ({ usuario: null as { uid: string; email: string; providerData: unknown[] } | null, cargando: false, cerrarSesion: vi.fn() }));
vi.mock('../../contextos/AuthContext', () => ({ useAuth: () => sesion }));

// 1. Mejoramos el mock de api para poder controlar sus respuestas
vi.mock('../../servicios/api', () => ({
  api: vi.fn(),
  ErrorApi: class extends Error { estado: number; constructor(estado: number, mensaje: string) { super(mensaje); this.estado = estado; } }
}));

vi.mock('../../servicios/firebase', () => ({ auth: null }));
vi.mock('../../componentes/layout/Layout.tsx', async () => {
  const { Outlet } = await import('react-router');
  return { Layout: () => <Outlet /> };
});
vi.mock('../login/Login', () => ({ Login: () => <h1>Iniciar sesión para entrar</h1> }));

const mockApi = vi.mocked(api);

// 2. Agregamos recordatorioCita a los datos de prueba
const preferencias = { nuevaSolicitud: true, reservaCancelada: true, recordatorioCita: true };

const abrir = (ruta: string) => {
  const router = createMemoryRouter(rutas, { initialEntries: [ruta] });
  render(<RouterProvider router={router} />);
  return router;
};

beforeEach(() => { 
  sesion.usuario = { uid: 'negocio-simulado', email: 'negocio@example.test', providerData: [] }; 
  mockApi.mockReset();
  // Solo las preferencias responden; las demás tarjetas siguen cargando, como antes de UI#132.
  mockApi.mockImplementation((ruta: string) =>
    (ruta === '/notificaciones/preferencias' ? Promise.resolve(preferencias) : new Promise(() => {})) as ReturnType<typeof api>);
});

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

// 3. NUEVO TEST: Verifica que el interruptor de recordatorio de cita funciona
it('UI132 muestra el interruptor de recordatorio de cita, lo cambia y guarda', async () => {
  abrir('/configuracion');
  
  const switchRecordatorio = await screen.findByRole('switch', { name: 'Recordatorio de cita' });
  expect(switchRecordatorio).toHaveAttribute('aria-checked', 'true');

  await userEvent.click(switchRecordatorio);
  
  await waitFor(() => expect(ultimaAlerta()).toMatchObject({ icon: 'success', text: 'Preferencias guardadas.' }));
  expect(mockApi).toHaveBeenCalledWith('/notificaciones/preferencias', {
    method: 'PUT',
    body: JSON.stringify({ ...preferencias, recordatorioCita: false })
  });
});

// 4. NUEVO TEST: Verifica el control de errores
it('UI132 si falla al guardar el recordatorio, revierte y muestra error', async () => {
  abrir('/configuracion');
  
  const switchRecordatorio = await screen.findByRole('switch', { name: 'Recordatorio de cita' });
  
  mockApi.mockImplementation((ruta: string, opciones?: RequestInit) =>
    (opciones?.method === 'PUT' ? Promise.reject(new ErrorApi(500, 'No se pudieron guardar las preferencias.'))
      : ruta === '/notificaciones/preferencias' ? Promise.resolve(preferencias) : new Promise(() => {})) as ReturnType<typeof api>);

  await userEvent.click(switchRecordatorio);
  
  await waitFor(() => expect(ultimaAlerta()).toMatchObject({ icon: 'error', text: MENSAJE_ERROR_SERVIDOR }));
  expect(screen.getByRole('switch', { name: 'Recordatorio de cita' })).toHaveAttribute('aria-checked', 'true');
});