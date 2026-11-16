import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router'; // <-- IMPORTANTE: Agregado
import { api } from '../../servicios/api';
import { Reservas } from './Reservas';

vi.mock('../../servicios/api', () => ({ api: vi.fn() }));
const apiMock = vi.mocked(api);
const ahora = Date.parse('2030-11-03T14:00:00Z');

// Helper para renderizar con el Router
function renderReservas() {
  return render(
    <MemoryRouter>
      <Reservas />
    </MemoryRouter>
  );
}

function reserva(nombre = 'Ana', estado = 'pendiente', extra = {}) {
  return { id: nombre, folio: 'SRV-1', cliente: { nombre, telefono: null },
    servicio: { id: 'corte', nombre: 'Corte de cabello', precio: 100, duracionMin: 60 },
    inicio: '2030-11-04T02:00:00Z', fin: '2030-11-04T03:00:00Z', estado,
    venceEn: new Date(Date.now() + 61000).toISOString(), segundosRestantes: 61, ...extra };
}

function parametros(indice = apiMock.mock.calls.length - 1) {
  return new URL(apiMock.mock.calls[indice][0], 'http://api.local').searchParams;
}

function diferida() {
  let resolver!: (valor: unknown) => void;
  let rechazar!: (error: Error) => void;
  const promesa = new Promise((resolve, reject) => { resolver = resolve; rechazar = reject; });
  return { promesa, resolver, rechazar };
}

beforeEach(() => {
  apiMock.mockReset();
  apiMock.mockResolvedValue({ items: [reserva()], siguiente: null });
});

afterEach(() => vi.useRealTimers());

it('muestra el contrato de BE con fecha y ambas horas de México y estado en español', async () => {
  apiMock.mockResolvedValue({ items: [reserva('Ana', 'rechazada_vencimiento')], siguiente: null });
  renderReservas(); // <-- Usamos el helper
  expect(await screen.findByRole('heading', { name: 'Ana' })).toBeInTheDocument();
  expect(screen.getByText('Corte de cabello · 03/11/30 de 20:00 a 21:00')).toBeInTheDocument();
  expect(screen.getByText('Rechazada por vencimiento', { selector: 'span' })).toHaveClass('rechazada_vencimiento');
});

it('filtra por los seis estados y fecha mediante controles etiquetados', async () => {
  renderReservas();
  await screen.findByRole('heading', { name: 'Ana' });
  const selector = screen.getByLabelText('Estado');
  const estados = ['pendiente', 'confirmada', 'rechazada', 'rechazada_vencimiento', 'cancelada', 'completada'];
  expect(within(selector).getAllByRole('option')).toHaveLength(7);
  fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2030-11-03' } });
  for (const estado of estados) {
    fireEvent.change(selector, { target: { value: estado } });
    await waitFor(() => expect(parametros().get('estado')).toBe(estado));
    expect(parametros().get('desde')).toBe('2030-11-03');
    expect(parametros().get('hasta')).toBe('2030-11-03');
    await screen.findByRole('heading', { name: 'Ana' });
  }
});

it('mantiene las Pendientes primero según el orden entregado por la API', async () => {
  apiMock.mockResolvedValue({ items: [reserva('Pendiente'), reserva('Confirmada', 'confirmada')], siguiente: null });
  renderReservas();
  await screen.findByRole('heading', { name: 'Pendiente' });
  expect(parametros().has('estado')).toBe(false);
  expect(parametros().has('vista')).toBe(false);
  expect(screen.getAllByRole('article').map((r) => within(r).getByRole('heading').textContent)).toEqual(['Pendiente', 'Confirmada']);
});

it('normaliza Pendiente al abrir Próximas y conserva la fecha y el orden de BE', async () => {
  renderReservas();
  await screen.findByRole('heading', { name: 'Ana' });
  fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'pendiente' } });
  await waitFor(() => expect(parametros().get('estado')).toBe('pendiente'));
  fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2030-11-03' } });
  await waitFor(() => expect(parametros().get('desde')).toBe('2030-11-03'));
  apiMock.mockResolvedValue({ items: [reserva('Primera', 'confirmada'), reserva('Segunda', 'confirmada', { inicio: '2030-11-04T04:00:00Z' })], siguiente: null });
  fireEvent.click(screen.getByRole('tab', { name: 'Próximas' }));
  await screen.findByRole('heading', { name: 'Primera' });
  expect(parametros().get('vista')).toBe('proximas');
  expect(parametros().get('estado')).toBe('confirmada');
  expect(parametros().get('desde')).toBe('2030-11-03');
  expect(screen.getByLabelText('Estado')).toBeDisabled();
  expect(screen.getAllByRole('article').map((r) => within(r).getByRole('heading').textContent)).toEqual(['Primera', 'Segunda']);
});

it('anuncia la pestaña seleccionada y permite cambiarla con el teclado', async () => {
  renderReservas();
  await screen.findByRole('heading', { name: 'Ana' });
  const pendientes = screen.getByRole('tab', { name: 'Pendientes', selected: true });
  pendientes.focus();
  fireEvent.keyDown(pendientes, { key: 'ArrowRight' });
  expect(screen.getByRole('tab', { name: 'Próximas', selected: true })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'Home' });
  expect(screen.getByRole('tab', { name: 'Pendientes', selected: true })).toHaveFocus();
  expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'tab-pendientes');
  await screen.findByRole('heading', { name: 'Ana' });
});

it('actualiza el reloj cada segundo, solo en Pendientes, y consulta al vencer una sola vez', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(ahora);
  apiMock.mockResolvedValueOnce({ items: [reserva(), reserva('Confirmada', 'confirmada'), reserva('Vencida', 'rechazada_vencimiento')], siguiente: null })
    .mockResolvedValue({ items: [reserva('Ana', 'rechazada_vencimiento')], siguiente: null });
  const { unmount } = renderReservas();
  await act(async () => {});
  expect(screen.getAllByText(/restantes/)).toHaveLength(1);
  expect(screen.getByText(/1m 1s restantes/)).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(screen.getByText(/1m 0s restantes/)).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
  expect(apiMock).toHaveBeenCalledTimes(2);
  expect(screen.queryByText(/restantes/)).not.toBeInTheDocument();
  expect(screen.getByText('Rechazada por vencimiento', { selector: 'span' })).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(apiMock).toHaveBeenCalledTimes(2);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it('refresca una Pendiente ya vencida al recibirla sin mostrar un plazo negativo ni entrar en bucle', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(ahora);
  apiMock.mockResolvedValue({ items: [reserva('Ana', 'pendiente', { venceEn: new Date(ahora - 1000).toISOString() })], siguiente: null });
  renderReservas();
  await act(async () => {});
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(apiMock).toHaveBeenCalledTimes(2);
  expect(screen.queryByText(/restantes|Vencida/)).not.toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(apiMock).toHaveBeenCalledTimes(2);
});

it('consume el cursor opaco, vuelve a la página anterior y lo reinicia al cambiar filtros o vista', async () => {
  apiMock.mockImplementation(async (ruta) => ({ items: [reserva(ruta.includes('cursor=') ? 'Página dos' : 'Página uno')], siguiente: ruta.includes('cursor=') ? null : 'v1.+/=' }));
  renderReservas();
  await screen.findByRole('heading', { name: 'Página uno' });
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  await screen.findByRole('heading', { name: 'Página dos' });
  expect(parametros().get('cursor')).toBe('v1.+/=');
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
  await screen.findByRole('heading', { name: 'Página uno' });
  expect(parametros().has('cursor')).toBe(false);
  for (const cambio of ['estado', 'fecha', 'vista']) {
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByRole('heading', { name: 'Página dos' });
    expect(parametros().get('cursor')).toBe('v1.+/=');
    if (cambio !== 'estado') expect(parametros().get('estado')).toBe('confirmada');
    if (cambio === 'vista') expect(parametros().get('desde')).toBe('2030-11-03');
    if (cambio === 'estado') fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'confirmada' } });
    if (cambio === 'fecha') fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2030-11-03' } });
    if (cambio === 'vista') fireEvent.click(screen.getByRole('tab', { name: 'Próximas' }));
    await screen.findByRole('heading', { name: 'Página uno' });
    expect(parametros().has('cursor')).toBe(false);
    if (cambio !== 'estado') expect(parametros().get('estado')).toBe('confirmada');
    if (cambio === 'vista') expect(parametros().get('desde')).toBe('2030-11-03');
  }
});

it.each(['éxito', 'error'])('descarta el %s de una petición antigua sin ocultar la carga vigente', async (resultado) => {
  const antigua = diferida();
  const nueva = diferida();
  apiMock.mockReturnValueOnce(antigua.promesa).mockReturnValueOnce(nueva.promesa);
  renderReservas();
  await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'confirmada' } });
  await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(2));
  await act(async () => {
    if (resultado === 'éxito') antigua.resolver({ items: [reserva('Antigua')], siguiente: 'viejo' });
    else antigua.rechazar(new Error('Sin conexión'));
  });
  expect(screen.getByRole('status')).toHaveTextContent('Cargando reservas');
  await act(async () => nueva.resolver({ items: [reserva('Vigente', 'confirmada')], siguiente: null }));
  expect(screen.getByRole('heading', { name: 'Vigente' })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByText('Antigua')).not.toBeInTheDocument();
});

it('descarta una respuesta antigua que llega después de la vigente', async () => {
  const antigua = diferida();
  apiMock.mockReturnValueOnce(antigua.promesa).mockResolvedValue({ items: [reserva('Vigente', 'confirmada')], siguiente: null });
  renderReservas();
  await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'confirmada' } });
  await screen.findByRole('heading', { name: 'Vigente' });
  await act(async () => antigua.resolver({ items: [reserva('Antigua')], siguiente: 'viejo' }));
  expect(screen.getByRole('heading', { name: 'Vigente' })).toBeInTheDocument();
  expect(screen.queryByText('Antigua')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument();
});

it('muestra carga, vacío y error, y reintenta conservando los filtros', async () => {
  apiMock.mockRejectedValueOnce(new Error('Sin conexión'))
       .mockResolvedValueOnce({ items: [], siguiente: null })
       .mockRejectedValueOnce(new Error('Sin conexión con filtro'))
       .mockResolvedValue({ items: [reserva()], siguiente: null });
  renderReservas();
  expect(screen.getByRole('status')).toHaveTextContent('Cargando reservas');
  expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar');
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText('No tienes reservas pendientes.')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2030-11-03' } });
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  await screen.findByRole('heading', { name: 'Ana' });
  expect(parametros().get('desde')).toBe('2030-11-03');
});