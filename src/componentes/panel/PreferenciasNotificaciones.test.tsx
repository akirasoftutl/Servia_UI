import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreferenciasNotificaciones } from './PreferenciasNotificaciones';

// Solo se simula `fetch`: el módulo `api` real corre con el contrato de Servia_BE#112.
const json = (estado: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } });
const porOmision = { nuevaSolicitud: true, reservaCancelada: true, recordatorioCita: true };
const cuerpoPut = (fetchMock: ReturnType<typeof vi.fn>) => fetchMock.mock.calls.filter(([, o]) => o?.method === 'PUT').map(([, o]) => JSON.parse(o.body as string));
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => vi.unstubAllGlobals());

it('muestra «Recordatorio de cita» activado por omisión con su descripción y la aclaración de la bandeja', async () => {
  fetchMock.mockResolvedValue(json(200, porOmision));
  render(<PreferenciasNotificaciones />);
  const interruptor = await screen.findByRole('switch', { name: 'Recordatorio de cita' });
  expect(interruptor).toHaveAttribute('aria-checked', 'true');
  expect(interruptor).toHaveAccessibleDescription('Poco antes de una cita confirmada.');
  expect(screen.getAllByRole('switch')).toHaveLength(3);
  expect(screen.getByText(/siempre aparecerán en tu bandeja/i)).toBeVisible();
});

it('apagarlo manda los tres campos en el PUT, muestra el éxito y no toca los otros dos', async () => {
  fetchMock.mockImplementation(async (_url: string, o?: RequestInit) =>
    o?.method === 'PUT' ? json(200, { ...porOmision, recordatorioCita: false }) : json(200, porOmision));
  render(<PreferenciasNotificaciones />);
  await userEvent.click(await screen.findByRole('switch', { name: 'Recordatorio de cita' }));
  expect(await screen.findByText('Preferencias guardadas.')).toBeVisible();
  expect(cuerpoPut(fetchMock)).toEqual([{ nuevaSolicitud: true, reservaCancelada: true, recordatorioCita: false }]);
  expect(screen.getByRole('switch', { name: 'Recordatorio de cita' })).toHaveAttribute('aria-checked', 'false');
  expect(screen.getByRole('switch', { name: 'Nueva solicitud' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByRole('switch', { name: 'Reserva cancelada por el cliente' })).toHaveAttribute('aria-checked', 'true');
});

it('cambiar otro interruptor conserva el valor guardado del recordatorio en el PUT', async () => {
  const guardado = { nuevaSolicitud: true, reservaCancelada: true, recordatorioCita: false };
  fetchMock.mockImplementation(async (_url: string, o?: RequestInit) =>
    o?.method === 'PUT' ? json(200, { ...guardado, nuevaSolicitud: false }) : json(200, guardado));
  render(<PreferenciasNotificaciones />);
  expect(await screen.findByRole('switch', { name: 'Recordatorio de cita' })).toHaveAttribute('aria-checked', 'false');
  await userEvent.click(screen.getByRole('switch', { name: 'Nueva solicitud' }));
  await waitFor(() => expect(cuerpoPut(fetchMock)).toEqual([{ nuevaSolicitud: false, reservaCancelada: true, recordatorioCita: false }]));
});

it('si la API responde 400, revierte el recordatorio y muestra el mensaje en español', async () => {
  fetchMock.mockImplementation(async (_url: string, o?: RequestInit) =>
    o?.method === 'PUT' ? json(400, { message: 'recordatorioCita debe ser un valor booleano', statusCode: 400 }) : json(200, porOmision));
  render(<PreferenciasNotificaciones />);
  await userEvent.click(await screen.findByRole('switch', { name: 'Recordatorio de cita' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('recordatorioCita debe ser un valor booleano');
  expect(screen.getByRole('switch', { name: 'Recordatorio de cita' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.queryByText('Preferencias guardadas.')).not.toBeInTheDocument();
});

it('sin red al guardar revierte el recordatorio y muestra el error de conexión', async () => {
  fetchMock.mockImplementation(async (_url: string, o?: RequestInit) => {
    if (o?.method === 'PUT') throw new TypeError('Failed to fetch');
    return json(200, porOmision);
  });
  render(<PreferenciasNotificaciones />);
  await userEvent.click(await screen.findByRole('switch', { name: 'Recordatorio de cita' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar. Inténtalo de nuevo.');
  expect(screen.getByRole('switch', { name: 'Recordatorio de cita' })).toHaveAttribute('aria-checked', 'true');
});

it('se opera con teclado (Espacio) y cada interruptor queda dentro de la lista de preferencias', async () => {
  fetchMock.mockImplementation(async (_url: string, o?: RequestInit) =>
    o?.method === 'PUT' ? json(200, { ...porOmision, recordatorioCita: false }) : json(200, porOmision));
  render(<PreferenciasNotificaciones />);
  const interruptor = await screen.findByRole('switch', { name: 'Recordatorio de cita' });
  interruptor.focus();
  await userEvent.keyboard(' ');
  await waitFor(() => expect(cuerpoPut(fetchMock)).toHaveLength(1));
  expect(within(interruptor.closest('article')!).getByRole('heading', { name: 'Recordatorio de cita' })).toBeVisible();
});
