import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { api, ErrorApi } from '../../servicios/api';
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
  const indicador = (etiqueta: string) => screen.getByText(etiqueta, { selector: 'dt' }).closest('.cliente-stat')!.querySelector('dd')!.textContent;
  expect(indicador('Total de reservas')).toBe('17');
  expect(indicador('Completadas')).toBe('9');
  expect(indicador('Canceladas')).toBe('4');
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
it('F5 muestra día, rango horario y fecha larga de México, incluso en UTC', async () => {
  abrir(); await waitFor(() => expect(screen.getByText('20:00 – 21:00')).toBeInTheDocument());
  expect(screen.getByText('03 nov')).toHaveClass('cliente-reserva-dia');
  expect(screen.getByText(/domingo, 3 de noviembre de 2030 · 60 min/)).toBeInTheDocument();
});
it('D18 la ficha muestra avatar, botones de contacto y los cuatro indicadores con la última visita en México', async () => {
  abrir(); await screen.findByRole('heading', { name: 'Datos del historial' });
  const ficha = screen.getByRole('region', { name: 'Datos del cliente' });
  expect(ficha.querySelector('.cliente-perfil-avatar')).toHaveTextContent(/^DH$/);
  expect(within(ficha).getByRole('link', { name: cliente.telefono })).toHaveClass('cliente-contacto-chip');
  expect(within(ficha).getByRole('link', { name: cliente.correo })).toHaveClass('cliente-contacto-chip');
  expect(within(ficha).getAllByRole('term').map((t) => t.textContent)).toEqual(['Total de reservas', 'Completadas', 'Canceladas', 'Última reserva']);
  const visita = within(ficha).getByText('Última reserva', { selector: 'dt' }).closest('.cliente-stat')!;
  expect(visita.querySelector('dd')).toHaveTextContent('3 nov 2030');
  expect(visita).toHaveTextContent('A las 20:00 h');
});
it('D18 cada reserva del historial lleva el folio como etiqueta y el estado como insignia, sin romper el nombre del enlace', async () => {
  abrir(); const enlace = await screen.findByRole('link', { name: 'Corte clásico · SRV-ABC' });
  expect(enlace.querySelector('.cliente-reserva-folio')).toHaveTextContent('SRV-ABC');
  const item = enlace.closest('article')!;
  expect(within(item).getByText('Rechazada por vencimiento')).toHaveClass('reserva-badge', 'rechazada_vencimiento');
  expect(screen.getByText('1 reserva')).toHaveClass('panel-contador');
});
it('D18 sin teléfono ni correo la ficha no muestra botones de contacto', async () => {
  mock.mockResolvedValue({ cliente: { ...cliente, telefono: null, correo: null }, items: [reserva], siguiente: null }); abrir();
  await screen.findByRole('heading', { name: 'Datos del historial' });
  expect(document.querySelector('.cliente-contacto-chip')).toBeNull();
});
