import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { api, ErrorApi } from '../../servicios/api';
import { MENSAJE_ERROR_SERVIDOR } from '../../servicios/mensajeDeError';
import { Clientes } from './Clientes';

vi.mock('../../servicios/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../servicios/api')>()),
  api: vi.fn(),
}));
const mock = vi.mocked(api);
const cliente = { clienteUid: 'ana', nombre: 'Ana Pérez', telefono: '4771234567', correo: 'ana@correo.mx', totalReservas: 13, completadas: 7, canceladas: 2, ultimaReserva: '2030-11-04T02:00:00Z' };
function abrir() { return render(<MemoryRouter><Clientes /></MemoryRouter>); }
async function avanzar(ms = 0) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
beforeEach(() => { vi.useFakeTimers(); mock.mockReset(); mock.mockResolvedValue({ items: [cliente], siguiente: null }); });
afterEach(() => vi.useRealTimers());

it('C1 muestra contacto, totales distintos y enlace al cliente', async () => {
  abrir(); await avanzar();
  expect(screen.getByRole('link', { name: 'Ana Pérez' })).toHaveAttribute('href', '/clientes/ana');
  expect(screen.getByRole('link', { name: cliente.telefono })).toHaveAttribute('href', 'tel:4771234567');
  expect(screen.getByRole('link', { name: cliente.correo })).toHaveAttribute('href', 'mailto:ana@correo.mx');
  expect(screen.getByText('Total de reservas: 13 · Completadas: 7 · Canceladas: 2')).toBeInTheDocument();
  expect(screen.getByText('Última reserva: 03/11/30 a las 20:00')).toBeInTheDocument();
});
it('C2 espera 300 ms, mínimo dos caracteres y borra resultados y cursor al buscar', async () => {
  mock.mockResolvedValue({ items: [cliente], siguiente: 'v1.+/=' });
  abrir(); await avanzar();
  fireEvent.click(screen.getByRole('button', { name: 'Cargar más' })); await avanzar();
  expect(new URL(mock.mock.lastCall![0], 'http://local').searchParams.get('cursor')).toBe('v1.+/=');
  const input = screen.getByLabelText('Buscar por nombre');
  fireEvent.change(input, { target: { value: 'A' } });
  expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument();
  await avanzar(300); expect(mock).toHaveBeenCalledTimes(2);
  fireEvent.change(input, { target: { value: 'An' } }); await avanzar(100);
  fireEvent.change(input, { target: { value: 'Ana' } }); await avanzar(299);
  expect(mock).toHaveBeenCalledTimes(2);
  mock.mockResolvedValue({ items: [cliente], siguiente: null });
  await avanzar(1); expect(mock).toHaveBeenCalledTimes(3);
  const params = new URL(mock.mock.lastCall![0], 'http://local').searchParams;
  expect(params.get('q')).toBe('Ana'); expect(params.has('cursor')).toBe(false);
  fireEvent.change(input, { target: { value: '' } }); await avanzar();
  expect(new URL(mock.mock.lastCall![0], 'http://local').searchParams.has('q')).toBe(false);
});
it('C2 concatena páginas sin perder clientes y conserva q', async () => {
  abrir(); await avanzar();
  mock.mockResolvedValueOnce({ items: [cliente], siguiente: 'opaco' });
  fireEvent.change(screen.getByLabelText('Buscar por nombre'), { target: { value: 'Ana' } }); await avanzar(300);
  mock.mockResolvedValueOnce({ items: [{ ...cliente, clienteUid: 'otra', nombre: 'Ana López' }], siguiente: null });
  fireEvent.click(screen.getByRole('button', { name: 'Cargar más' })); await avanzar();
  expect(screen.getByText('Ana Pérez')).toBeInTheDocument(); expect(screen.getByText('Ana López')).toBeInTheDocument();
  const params = new URL(mock.mock.lastCall![0], 'http://local').searchParams;
  expect(params.get('q')).toBe('Ana'); expect(params.get('cursor')).toBe('opaco');
  expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument();
});
it('C2 descarta respuestas anteriores durante la espera', async () => {
  let resolver!: (valor: unknown) => void;
  mock.mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));
  abrir(); await avanzar();
  fireEvent.change(screen.getByLabelText('Buscar por nombre'), { target: { value: 'Lu' } });
  await act(async () => resolver({ items: [cliente], siguiente: 'viejo' }));
  expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument(); expect(screen.getByRole('status')).toHaveTextContent('Cargando clientes');
  mock.mockResolvedValue({ items: [], siguiente: null }); await avanzar(300);
  expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument();
});
it('C5 muestra cargando con el patrón de Reservas', () => {
  abrir(); expect(screen.getByRole('status')).toHaveTextContent('Cargando clientes...');
  expect(document.querySelector('.panel-estado .spinner-border')).toBeInTheDocument();
});
it('C5 muestra vacío', async () => {
  mock.mockResolvedValue({ items: [], siguiente: null }); abrir(); await avanzar();
  expect(screen.getByText('Aquí aparecerán las personas que reserven contigo.')).toHaveClass('panel-estado-texto');
});
it('distingue búsqueda sin resultados del estado vacío sin clientes', async () => {
  mock.mockResolvedValue({ items: [cliente], siguiente: null });
  abrir(); await avanzar();
  mock.mockResolvedValue({ items: [], siguiente: null });
  const input = screen.getByLabelText('Buscar por nombre');
  fireEvent.change(input, { target: { value: 'Zzz' } });
  await avanzar(300);
  expect(screen.getByRole('heading', { name: 'Sin resultados' })).toHaveClass('panel-estado-titulo');
  expect(screen.getByText('No encontramos clientes con ese nombre.')).toHaveClass('panel-estado-texto');
  expect(screen.queryByRole('heading', { name: 'Aún no hay clientes' })).not.toBeInTheDocument();
  fireEvent.change(input, { target: { value: '' } });
  await avanzar();
  expect(screen.getByRole('heading', { name: 'Aún no hay clientes' })).toHaveClass('panel-estado-titulo');
  expect(screen.queryByRole('heading', { name: 'Sin resultados' })).not.toBeInTheDocument();
});
it('C5 muestra error y permite reintentar sin alert', async () => {
  const alerta = vi.spyOn(window, 'alert').mockImplementation(() => {});
  mock.mockRejectedValueOnce(new Error('Sin red')); abrir(); await avanzar();
  expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar los clientes.');
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' })); await avanzar();
  expect(screen.getByText('Ana Pérez')).toBeInTheDocument(); expect(alerta).not.toHaveBeenCalled(); alerta.mockRestore();
});
it.each([
  [new ErrorApi(429, 'Demasiadas consultas de clientes.'), 'Demasiadas consultas de clientes.'],
  [new ErrorApi(500, 'Internal server error'), MENSAJE_ERROR_SERVIDOR],
  [new TypeError('Failed to fetch'), 'No pudimos cargar los clientes. Intenta de nuevo.'],
])('distingue 429, 500 y red al cargar clientes', async (error, esperado) => {
  mock.mockRejectedValueOnce(error); abrir(); await avanzar();
  expect(screen.getByRole('alert')).toHaveTextContent(esperado);
});
