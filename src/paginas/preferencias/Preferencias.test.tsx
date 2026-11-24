import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { api, ErrorApi } from '../../servicios/api';
import { MENSAJE_ERROR_SERVIDOR } from '../../servicios/mensajeDeError';
import { Preferencias } from './Preferencias';
import { ultimaAlerta } from '../../pruebas/mockAlertas';

vi.mock('../../servicios/api', () => ({ api: vi.fn(), ErrorApi: class extends Error { estado: number; constructor(estado: number, mensaje: string) { super(mensaje); this.estado = estado; } } }));
const mock = vi.mocked(api);

// 1. Agregamos recordatorioCita al estado inicial
const inicial = { nuevaSolicitud: false, reservaCancelada: true, recordatorioCita: true };

beforeEach(() => mock.mockReset().mockResolvedValue(inicial));

it('carga guardadas, guarda cada tipo con contrato real y conserva al recargar', async () => {
  let persistidas = { ...inicial };
  mock.mockImplementation(async (_ruta, opciones) => {
    if (opciones?.method === 'PUT') persistidas = JSON.parse(opciones.body as string);
    return { ...persistidas };
  });
  const vista = render(<Preferencias />);
  
  // Verificamos los 3 interruptores
  expect(await screen.findByRole('switch', { name: 'Nueva solicitud' })).toHaveAttribute('aria-checked', 'false');
  expect(screen.getByRole('switch', { name: 'Reserva cancelada por el cliente' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByRole('switch', { name: 'Recordatorio de cita' })).toHaveAttribute('aria-checked', 'true');
  
  await userEvent.click(screen.getByRole('switch', { name: 'Nueva solicitud' }));
  await waitFor(() => expect(ultimaAlerta()).toMatchObject({ icon: 'success', text: 'Preferencias guardadas.' }));
  
  // 2. Actualizamos el expect del PUT
  expect(mock).toHaveBeenCalledWith('/notificaciones/preferencias', { method: 'PUT', body: JSON.stringify({ nuevaSolicitud: true, reservaCancelada: true, recordatorioCita: true }) });
  
  await userEvent.click(screen.getByRole('switch', { name: 'Reserva cancelada por el cliente' }));
  
  // 3. Actualizamos el expect del estado persistido
  await waitFor(() => expect(persistidas).toEqual({ nuevaSolicitud: true, reservaCancelada: false, recordatorioCita: true }));
  
  vista.unmount(); render(<Preferencias />);
  expect(await screen.findByRole('switch', { name: 'Reserva cancelada por el cliente' })).toHaveAttribute('aria-checked', 'false');
  expect(mock).toHaveBeenCalledWith('/notificaciones/preferencias');
});

// 4. NUEVO TEST para el recordatorio
it('el interruptor de recordatorio de cita aparece, hace PUT y maneja error', async () => {
  let persistidas = { ...inicial };
  mock.mockImplementation(async (_ruta, opciones) => {
    if (opciones?.method === 'PUT') persistidas = JSON.parse(opciones.body as string);
    return { ...persistidas };
  });
  render(<Preferencias />);
  
  const switchRecordatorio = await screen.findByRole('switch', { name: 'Recordatorio de cita' });
  expect(switchRecordatorio).toHaveAttribute('aria-checked', 'true');
  
  // Cambiarlo hace el PUT
  await userEvent.click(switchRecordatorio);
  await waitFor(() => expect(ultimaAlerta()).toMatchObject({ icon: 'success', text: 'Preferencias guardadas.' }));
  expect(mock).toHaveBeenCalledWith('/notificaciones/preferencias', { method: 'PUT', body: JSON.stringify({ nuevaSolicitud: false, reservaCancelada: true, recordatorioCita: false }) });
  
  // Si falla, vuelve a su valor y muestra el error
  mock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  await userEvent.click(screen.getByRole('switch', { name: 'Recordatorio de cita' })); 
  await waitFor(() => expect(ultimaAlerta()).toMatchObject({ icon: 'error', text: 'No se pudo conectar. Inténtalo de nuevo.' }));
  expect(screen.getByRole('switch', { name: 'Recordatorio de cita' })).toHaveAttribute('aria-checked', 'false');
});

it('falla al guardar: muestra error español y restaura el interruptor sin tocar los otros', async () => {
  mock.mockResolvedValueOnce(inicial).mockRejectedValueOnce(new ErrorApi(500, 'No se pudieron guardar las preferencias.'));
  render(<Preferencias />);
  await userEvent.click(await screen.findByRole('switch', { name: 'Nueva solicitud' }));
  await waitFor(() => expect(ultimaAlerta()).toMatchObject({ icon: 'error', text: MENSAJE_ERROR_SERVIDOR }));
  expect(screen.getByRole('switch', { name: 'Nueva solicitud' })).toHaveAttribute('aria-checked', 'false');
  expect(screen.getByRole('switch', { name: 'Reserva cancelada por el cliente' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByRole('switch', { name: 'Recordatorio de cita' })).toHaveAttribute('aria-checked', 'true');
});

it('sin conexión al cargar muestra el texto exacto y permite reintentar', async () => {
  mock.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(inicial);
  render(<Preferencias />);
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar. Inténtalo de nuevo.');
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByRole('switch', { name: 'Nueva solicitud' })).toHaveAttribute('aria-checked', 'false');
});

it('sin conexión al guardar revierte y muestra texto exacto', async () => {
  mock.mockResolvedValueOnce(inicial).mockRejectedValueOnce(new TypeError('Failed to fetch'));
  render(<Preferencias />);
  await userEvent.click(await screen.findByRole('switch', { name: 'Reserva cancelada por el cliente' }));
  await waitFor(() => expect(ultimaAlerta()).toMatchObject({ icon: 'error', text: 'No se pudo conectar. Inténtalo de nuevo.' }));
  expect(screen.getByRole('switch', { name: 'Reserva cancelada por el cliente' })).toHaveAttribute('aria-checked', 'true');
});

it('usa estados y clases compartidas del panel y bloquea cambios mientras guarda', async () => {
  let resolver!: (valor: unknown) => void;
  mock.mockReturnValueOnce(new Promise(resolve => { resolver = resolve; }));
  const vista = render(<Preferencias />);
  expect(screen.getByRole('status', { name: 'Cargando preferencias' }).querySelector('.panel-esqueleto-fila')).toBeInTheDocument();
  expect(vista.container.querySelector('.panel-pagina .panel-contenedor .panel-encabezado .panel-titulo')).toHaveTextContent('Preferencias de notificaciones');
  expect(vista.container.querySelector('.panel-tarjeta')).toBeInTheDocument();
  await act(async () => resolver(inicial));
  mock.mockReturnValueOnce(new Promise(resolve => { resolver = resolve; }));
  await userEvent.click(screen.getByRole('switch', { name: 'Nueva solicitud' }));
  for (const control of screen.getAllByRole('switch')) expect(control).toBeDisabled();
  expect(screen.getByText('Guardando preferencias...')).toBeVisible();
  await act(async () => resolver({ nuevaSolicitud: true, reservaCancelada: true, recordatorioCita: true }));
  expect(ultimaAlerta()).toMatchObject({ icon: 'success', text: 'Preferencias guardadas.' });
  const fuente = readFileSync('src/paginas/preferencias/Preferencias.tsx', 'utf8');
  expect(fuente).not.toMatch(/style=|\b\d+(?:px|rem)\b|#[\da-f]{3,8}\b|alert\(/i);
  expect(fuente).toContain("import '../../estilos/panel.css'");
  const compartido = readFileSync('src/estilos/panel.css', 'utf8').split('/* Interruptor compartido:')[1];
  expect(compartido).toBeDefined();
  expect(compartido).not.toMatch(/\b\d+(?:px|rem)\b|#[\da-f]{3,8}\b|rgba?\(/i);
  expect([...vista.container.querySelectorAll('[class]')].flatMap(n => [...n.classList]).every(c => c.startsWith('panel-') || c.startsWith('btn-servia-') || c.startsWith('lucide'))).toBe(true);
});