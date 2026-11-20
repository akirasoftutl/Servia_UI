import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { api, ErrorApi } from '../../servicios/api';
import { MENSAJE_ERROR_SERVIDOR } from '../../servicios/mensajeDeError';
import { DetalleCliente } from './DetalleCliente';
import { Clientes } from './Clientes';

vi.mock('../../servicios/api', async (importOriginal) => ({ ...await importOriginal<typeof import('../../servicios/api')>(), api: vi.fn() }));
const mock = vi.mocked(api);
const cliente = { clienteUid: 'ana', nombre: 'Datos del historial', telefono: '4770000000', correo: 'historial@correo.mx', totalReservas: 17, completadas: 9, canceladas: 4, ultimaReserva: '2030-11-04T02:00:00Z' };
const reserva = { id: 'r1', folio: 'SRV-ABC', servicioNombre: 'Corte clásico', inicio: '2030-11-04T02:00:00Z', fin: '2030-11-04T03:00:00Z', estado: 'rechazada_vencimiento', motivo: 'Se agotó el plazo' };
function abrir(ruta = '/clientes/ana') {
  const router = createMemoryRouter([
    { path: '/clientes', element: <Clientes /> },
    { path: '/clientes/:clienteUid', element: <DetalleCliente /> },
    { path: '/reservas/:id', element: <h1>Detalle de reserva</h1> },
  ], { initialEntries: [ruta] });
  render(<RouterProvider router={router} />); return router;
}
beforeEach(() => { mock.mockReset(); mock.mockResolvedValue({ cliente, items: [reserva], siguiente: null }); });
it('C3 carga directamente sin estado del router, muestra el bloque cliente e historial y navega a reserva', async () => {
  const router = abrir();
  expect(await screen.findByRole('heading', { name: 'Datos del historial' })).toBeInTheDocument();
  expect(mock).toHaveBeenCalledWith('/negocios/mio/clientes/ana/reservas?');
  expect(screen.getByRole('link', { name: cliente.telefono })).toHaveAttribute('href', 'tel:4770000000');
  expect(screen.getByRole('link', { name: cliente.correo })).toHaveAttribute('href', 'mailto:historial@correo.mx');
  expect(screen.getByText('Total de reservas: 17 · Completadas: 9 · Canceladas: 4')).toBeInTheDocument();
  expect(screen.getByText('Rechazada por vencimiento')).toBeInTheDocument();
  expect(screen.getByText('Motivo: Se agotó el plazo')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'Corte clásico · SRV-ABC' }));
  await screen.findByRole('heading', { name: 'Detalle de reserva' }); expect(router.state.location.pathname).toBe('/reservas/r1');
});
it('C3 abre un cliente desde la lista usando los datos del historial', async () => {
  mock.mockImplementation(async (ruta) => ruta.includes('/reservas') ? { cliente, items: [reserva], siguiente: null } : { items: [{ ...cliente, nombre: 'Nombre de la lista' }], siguiente: null });
  abrir('/clientes'); fireEvent.click(await screen.findByRole('link', { name: 'Nombre de la lista' }));
  expect(await screen.findByRole('heading', { name: 'Datos del historial' })).toBeInTheDocument();
  expect(screen.queryByText('Nombre de la lista')).not.toBeInTheDocument();
});
it('C3 carga más historial con el cursor de la API', async () => {
  mock.mockResolvedValueOnce({ cliente, items: [reserva], siguiente: 'v1.+/=' });
  abrir(); await screen.findByText('Datos del historial');
  mock.mockResolvedValueOnce({ cliente, items: [{ ...reserva, id: 'r2', folio: 'SRV-OTRO' }], siguiente: null });
  fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
  await screen.findByRole('link', { name: 'Corte clásico · SRV-OTRO' });
  expect(screen.getByRole('link', { name: 'Corte clásico · SRV-ABC' })).toBeInTheDocument();
  expect(new URL(mock.mock.lastCall![0], 'http://local').searchParams.get('cursor')).toBe('v1.+/=');
});
it('C4 traduce el 404 sin revelar si el cliente existe', async () => {
  mock.mockRejectedValue(new ErrorApi(404, 'El cliente no existe en tu negocio.')); abrir();
  expect(await screen.findByRole('alert')).toHaveTextContent('No encontramos a este cliente en tu negocio.');
});
it('C5 muestra carga y error recuperable sin alert', async () => {
  const alerta = vi.spyOn(window, 'alert').mockImplementation(() => {});
  mock.mockRejectedValueOnce(new Error('Sin red')); abrir();
  expect(screen.getByRole('status')).toHaveTextContent('Cargando historial...');
  await screen.findByRole('alert'); fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  await screen.findByText('Datos del historial'); expect(alerta).not.toHaveBeenCalled(); alerta.mockRestore();
});
it('C5 conserva los datos del cliente cuando el historial está vacío', async () => {
  mock.mockResolvedValue({ cliente, items: [], siguiente: null }); abrir();
  expect(await screen.findByText('No hay reservas en este historial.')).toBeInTheDocument();
  expect(screen.getByText('Datos del historial')).toBeInTheDocument();
});
it('F5 muestra fecha y rango horario de México sin repetir la preposición, incluso en UTC', async () => {
  abrir(); await waitFor(() => expect(screen.getByText('03/11/30 a las 20:00 – 21:00')).toBeInTheDocument());
});
it.each([
  [new ErrorApi(429, 'Demasiadas consultas de historial.'), 'Demasiadas consultas de historial.'],
  [new ErrorApi(500, 'Internal server error'), MENSAJE_ERROR_SERVIDOR],
  [new TypeError('Failed to fetch'), 'No pudimos cargar el historial. Intenta de nuevo.'],
])('distingue 429, 500 y red al cargar el historial del cliente', async (error, esperado) => {
  mock.mockRejectedValueOnce(error); abrir();
  expect(await screen.findByRole('alert')).toHaveTextContent(esperado);
});
