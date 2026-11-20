import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { api } from '../../servicios/api';
import { Clientes } from './Clientes';
import { iniciales } from './clientes';

vi.mock('../../servicios/api', () => ({ api: vi.fn() }));
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
  expect(screen.getByText('Última visita: 03/11/30 a las 20:00')).toBeInTheDocument();
});
it('D17 la tarjeta tiene avatar con iniciales y tres mini-métricas con el valor de cada una', async () => {
  abrir(); await avanzar();
  const tarjeta = screen.getByRole('link', { name: 'Ana Pérez' }).closest('article')!;
  expect(tarjeta.querySelector('.clientes-avatar')).toHaveTextContent(/^AP$/);
  const kpis = tarjeta.querySelector('dl[aria-label="Resumen de reservas de Ana Pérez"]')!;
  const valor = (etiqueta: string) => within(kpis as HTMLElement).getByText(etiqueta).closest('div')!.querySelector('dd')!.textContent;
  expect(valor('Reservas')).toBe('13');
  expect(valor('Completadas')).toBe('7');
  expect(valor('Canceladas')).toBe('2');
});
it('D17 sin teléfono ni correo no deja enlaces vacíos y marca las canceladas solo si hay', async () => {
  mock.mockResolvedValue({ items: [{ ...cliente, telefono: null, correo: null, canceladas: 0 }], siguiente: null });
  abrir(); await avanzar();
  expect(document.querySelector('a[href^="tel:"], a[href^="mailto:"]')).toBeNull();
  expect(screen.getByText('Canceladas').closest('.clientes-kpi')).not.toHaveClass('clientes-kpi--peligro');
});
it('D17 las iniciales usan la primera y la última palabra, o un signo si no hay nombre', () => {
  expect(iniciales('Carlos Alberto Mendoza')).toBe('CM');
  expect(iniciales('  ana ')).toBe('A');
  expect(iniciales('Álvaro Núñez')).toBe('ÁN');
  expect(iniciales('')).toBe('?');
});
it('D17 la cabecera cuenta clientes y reservas cargadas, con «+» si faltan páginas, y enlaza a Reservas', async () => {
  mock.mockResolvedValue({ items: [cliente, { ...cliente, clienteUid: 'b', nombre: 'Beto', totalReservas: 4 }], siguiente: 'mas' });
  abrir(); await avanzar();
  const metricas = document.querySelector('dl[aria-label="Resumen de clientes"]')!;
  const cifra = (etiqueta: string) => within(metricas as HTMLElement).getByText(etiqueta, { selector: 'dt' }).closest('.panel-metrica')!.querySelector('dd')!.textContent;
  expect(cifra('clientes')).toBe('2+');
  expect(cifra('reservas acumuladas')).toBe('17+');
  expect(screen.getByText('2+ clientes')).toHaveClass('panel-contador');
  expect(screen.getByRole('link', { name: 'Ver reservas' })).toHaveAttribute('href', '/reservas');
});
it('D17 sin clientes la cabecera no muestra contadores', async () => {
  mock.mockResolvedValue({ items: [], siguiente: null }); abrir(); await avanzar();
  expect(document.querySelector('.panel-metricas')).toBeNull();
  expect(document.querySelector('.panel-contador')).toBeNull();
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
