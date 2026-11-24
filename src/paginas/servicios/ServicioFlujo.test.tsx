import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import { api, ErrorApi } from '../../servicios/api';
import { MENSAJE_ERROR_SERVIDOR } from '../../servicios/mensajeDeError';
import { NuevoServicio } from './NuevoServicio';
import { MisServicios } from './MisServicios';
import {
  llamadasAlertas,
  mockearConfirmacion,
  mockearConfirmaciones,
  swalFireMock,
  ultimaAlerta,
} from '../../pruebas/mockAlertas';

vi.mock('../../servicios/api', () => ({ api: vi.fn(), ErrorApi: class extends Error { estado: number; constructor(estado: number, mensaje: string) { super(mensaje); this.estado = estado; } } }));
const mock = vi.mocked(api);
const datos = { id: 'uno', nombre: 'Corte', descripcion: 'Cabello', precio: 50, duracionMin: 30, activo: true };
const AVISO = 'Ya no tienes servicios activos: tu negocio no aparece para los clientes hasta que actives uno.';
const ERROR = 'No pudimos guardar los cambios. Intenta de nuevo.';
let servicio = { ...datos };
let visible = false;
function abrir(ruta = '/servicios/uno') {
  render(<MemoryRouter initialEntries={[ruta]}><Routes><Route path="/servicios/:id" element={<NuevoServicio />} /><Route path="/servicios" element={<MisServicios />} /></Routes></MemoryRouter>);
}
beforeEach(() => {
  mock.mockReset(); servicio = { ...datos }; visible = false;
  mock.mockImplementation(async (ruta, opciones) => {
    if (opciones?.method === 'PATCH') { servicio.activo = JSON.parse(String(opciones.body)).activo; return { visible }; }
    if (opciones?.method === 'PUT') { Object.assign(servicio, JSON.parse(String(opciones.body))); return servicio; }
    if (opciones?.method === 'DELETE') return undefined;
    if (ruta === '/negocios/mio') return { visible, perfilCompleto: true };
    if (ruta === '/negocios/mio/servicios' || ruta.includes('?estado=')) return [servicio];
    return servicio;
  });
});

it('edita datos por PUT y vuelve con alerta de éxito y precio actualizado', async () => {
  abrir();
  fireEvent.change(await screen.findByLabelText('Precio del servicio *'), { target: { value: '75' } });
  await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  expect(await screen.findByRole('heading', { name: 'Mis servicios' }, { timeout: 5000 })).toBeInTheDocument();
  expect(await screen.findByText('$75.00')).toBeInTheDocument();
  expect(ultimaAlerta()).toMatchObject({ icon: 'success', text: 'Cambios guardados.' });
  expect(mock).toHaveBeenCalledWith('/negocios/mio/servicios/uno', { method: 'PUT', body: JSON.stringify({ nombre: 'Corte', descripcion: 'Cabello', precio: 75, duracionMin: 30 }) });
});

it.each([['Nombre del servicio *', '', 'Escribe el nombre del servicio.'], ['Descripción del servicio *', '', 'Escribe una descripción.'], ['Precio del servicio *', '-1', 'El precio debe ser 0 o más.'], ['Duración del servicio *', '0', 'La duración debe ser de al menos 1 minuto.']])('valida %s al editar con el mensaje compartido y enfoca el campo', async (campo, valor, mensaje) => {
  abrir();
  const input = await screen.findByLabelText(campo);
  fireEvent.change(input, { target: { value: valor } });
  await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  expect(screen.getByRole('alert')).toHaveTextContent(mensaje);
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(document.activeElement).toBe(input);
  expect(ultimaAlerta()).toMatchObject({ icon: 'warning' });
  expect(mock.mock.calls.some(([, opciones]) => opciones?.method === 'PUT')).toBe(false);
});

it('informa que las reservas existentes conservan precio y duración', async () => {
  abrir();
  expect(await screen.findByText('Los cambios de precio o duración no afectan las reservas que ya existen.')).toBeInTheDocument();
});

it('confirma desactivación y cancelar NO llama a PATCH', async () => {
  abrir();
  const desactivar = await screen.findByRole('button', { name: 'Desactivar' });
  mockearConfirmacion(false);
  await userEvent.click(desactivar);
  expect(ultimaAlerta()).toMatchObject({
    title: 'Desactivar servicio',
    text: '¿Desactivar «Corte»? Los clientes ya no podrán reservarlo. Sus reservas existentes no cambian.',
    showCancelButton: true,
  });
  expect(mock.mock.calls.some(([, opciones]) => opciones?.method === 'PATCH')).toBe(false);
});

it.each(['/servicios/uno', '/servicios'])('desactiva desde %s y añade RN-11 al éxito anunciado', async ruta => {
  abrir(ruta);
  mockearConfirmacion(true);
  await userEvent.click(await screen.findByRole('button', { name: 'Desactivar' }));
  await waitFor(() => expect(ultimaAlerta()).toMatchObject({ icon: 'success', text: `Servicio desactivado. ${AVISO}` }));
  expect(await screen.findByText(ruta === '/servicios' ? 'Inactivo' : 'Estado: Inactivo')).toBeInTheDocument();
  expect(mock).toHaveBeenCalledWith('/negocios/mio/servicios/uno/estado', { method: 'PATCH', body: JSON.stringify({ activo: false }) });
});

it('activa el servicio inactivo y muestra el nuevo estado sin aviso RN-11', async () => {
  servicio.activo = false; visible = true;
  abrir();
  await userEvent.click(await screen.findByRole('button', { name: 'Activar' }));
  await waitFor(() => expect(ultimaAlerta()).toMatchObject({ icon: 'success', text: 'Servicio activado.' }));
  expect(screen.getByText('Estado: Activo')).toBeInTheDocument();
  expect(String(ultimaAlerta()?.text)).not.toContain(AVISO);
  expect(mock).toHaveBeenCalledWith('/negocios/mio/servicios/uno/estado', { method: 'PATCH', body: JSON.stringify({ activo: true }) });
});

it.each(['/servicios/uno', '/servicios'])('elimina desde %s con confirmación y RN-11 tras consultar perfil', async ruta => {
  abrir(ruta);
  mockearConfirmacion(true);
  await userEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
  expect(await screen.findByRole('heading', { name: 'Mis servicios' })).toBeInTheDocument();
  expect(llamadasAlertas()[0]).toMatchObject({
    title: 'Eliminar servicio',
    text: '¿Eliminar «Corte»? Esta acción no se puede deshacer.',
    showCancelButton: true,
  });
  expect(ultimaAlerta()).toMatchObject({ icon: 'success', text: `Servicio eliminado. ${AVISO}` });
  expect(mock).toHaveBeenCalledWith('/negocios/mio');
  expect(mock).toHaveBeenCalledWith('/negocios/mio/servicios/uno', { method: 'DELETE' });
});

it('elimina sin aviso RN-11 cuando quedan servicios activos', async () => {
  visible = true; abrir();
  mockearConfirmacion(true);
  await userEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
  await waitFor(() => expect(ultimaAlerta()).toMatchObject({ icon: 'success', text: 'Servicio eliminado.' }));
  expect(String(ultimaAlerta()?.text)).not.toContain(AVISO);
});

it('reintenta la visibilidad sin repetir el DELETE ya exitoso', async () => {
  const implementacion = mock.getMockImplementation()!;
  mock.mockImplementation(async (ruta, opciones) => { if (ruta === '/negocios/mio') throw new ErrorApi(503, 'Perfil'); return implementacion(ruta, opciones); });
  abrir();
  mockearConfirmacion(true);
  await userEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
  await waitFor(() => expect(ultimaAlerta()).toMatchObject({
    icon: 'error',
    text: 'Servicio eliminado. No pudimos consultar la visibilidad del negocio. Intenta de nuevo.',
  }));
  mock.mockImplementation(implementacion);
  await userEvent.click(screen.getByRole('button', { name: 'Consultar visibilidad de nuevo' }));
  await waitFor(() => expect(ultimaAlerta()).toMatchObject({ icon: 'success', text: expect.stringContaining(AVISO) }));
  expect(mock.mock.calls.filter(([, opciones]) => opciones?.method === 'DELETE')).toHaveLength(1);
});

it.each(['/servicios/uno', '/servicios'])('409 en %s ofrece desactivar sin segunda confirmación ni borrar otra vez', async ruta => {
  const implementacion = mock.getMockImplementation()!;
  mock.mockImplementation(async (ruta, opciones) => { if (opciones?.method === 'DELETE') throw new ErrorApi(409, 'Reservas'); return implementacion(ruta, opciones); });
  abrir(ruta);
  mockearConfirmaciones(true, true);
  await userEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
  await waitFor(() => expect(ultimaAlerta()).toMatchObject({ icon: 'success', text: expect.stringContaining('Servicio desactivado.') }));
  expect(llamadasAlertas()[1]).toMatchObject({
    title: 'Desactivar servicio',
    text: 'Este servicio ya tuvo reservas, así que no se puede eliminar. Puedes desactivarlo para que deje de ofrecerse.',
  });
  expect(mock.mock.calls.filter(([, opciones]) => opciones?.method === 'DELETE')).toHaveLength(1);
});

it.each(['PUT', 'PATCH', 'DELETE'])('muestra el error del servidor ante fallo 500 en %s y permite reintentar', async metodo => {
  const implementacion = mock.getMockImplementation()!;
  mock.mockImplementation(async (ruta, opciones) => { if (opciones?.method === metodo) throw new ErrorApi(500, 'Detalle privado'); return implementacion(ruta, opciones); });
  abrir(); await screen.findByLabelText('Nombre del servicio *');
  if (metodo === 'PUT') {
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  } else {
    const accion = metodo === 'PATCH' ? 'Desactivar' : 'Eliminar';
    mockearConfirmacion(true);
    await userEvent.click(screen.getByRole('button', { name: accion }));
  }
  await waitFor(() => expect(ultimaAlerta()).toMatchObject({ icon: 'error', text: MENSAJE_ERROR_SERVIDOR }));
  expect(String(ultimaAlerta()?.text)).not.toContain('Detalle privado');

  mock.mockImplementation(implementacion);
  if (metodo === 'PUT') {
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(ultimaAlerta()).toMatchObject({ icon: 'success', text: 'Cambios guardados.' }));
  } else {
    const accion = metodo === 'PATCH' ? 'Desactivar' : 'Eliminar';
    mockearConfirmacion(true);
    await userEvent.click(screen.getByRole('button', { name: accion }));
    await waitFor(() => expect(ultimaAlerta()).toMatchObject({
      icon: 'success',
      text: expect.stringContaining(metodo === 'PATCH' ? 'Servicio desactivado.' : 'Servicio eliminado.'),
    }));
  }
});

it.each([
  ['PUT', new ErrorApi(429, 'Demasiados cambios; espera un momento.'), 'Demasiados cambios; espera un momento.'],
  ['PUT', new TypeError('Failed to fetch'), ERROR],
  ['PATCH', new ErrorApi(429, 'Demasiados cambios; espera un momento.'), 'Demasiados cambios; espera un momento.'],
  ['PATCH', new TypeError('Failed to fetch'), ERROR],
  ['DELETE', new ErrorApi(429, 'Demasiadas solicitudes.'), 'Demasiadas solicitudes.'],
  ['DELETE', new TypeError('Failed to fetch'), ERROR],
])('muestra el mensaje de 429 o red en %s', async (metodo, error, esperado) => {
  const implementacion = mock.getMockImplementation()!;
  mock.mockImplementation(async (ruta, opciones) => { if (opciones?.method === metodo) throw error; return implementacion(ruta, opciones); });
  abrir(); await screen.findByLabelText('Nombre del servicio *');
  if (metodo === 'PUT') {
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  } else {
    const accion = metodo === 'PATCH' ? 'Desactivar' : 'Eliminar';
    mockearConfirmacion(true);
    await userEvent.click(screen.getByRole('button', { name: accion }));
  }
  await waitFor(() => expect(ultimaAlerta()).toMatchObject({ icon: 'error', text: esperado }));
});

it.each([
  [new ErrorApi(429, 'Demasiadas consultas; inténtalo más tarde.'), 'Demasiadas consultas; inténtalo más tarde.'],
  [new ErrorApi(500, 'Error interno'), MENSAJE_ERROR_SERVIDOR],
  [new TypeError('Failed to fetch'), 'No pudimos cargar tus servicios. Intenta nuevamente.'],
])('MisServicios distingue 429, 500 y red al cargar el catálogo', async (error, esperado) => {
  mock.mockRejectedValueOnce(error);
  abrir('/servicios');
  expect(await screen.findByText(esperado)).toBeInTheDocument();
});

it('la tarjeta es un enlace nativo y abre edición con Enter', async () => {
  abrir('/servicios');
  const enlace = await screen.findByRole('link', { name: /Corte.*Activo/ });
  expect(enlace).toHaveAttribute('href', '/servicios/uno');
  enlace.focus(); await userEvent.keyboard('{Enter}');
  expect(await screen.findByRole('heading', { name: 'Editar servicio' })).toBeInTheDocument();
});

it('409 de un servicio inactivo conserva la desactivación al aceptar', async () => {
  servicio.activo = false;
  const implementacion = mock.getMockImplementation()!;
  mock.mockImplementation(async (ruta, opciones) => { if (opciones?.method === 'DELETE') throw new ErrorApi(409, 'Reservas'); return implementacion(ruta, opciones); });
  abrir();
  mockearConfirmaciones(true, true);
  await userEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
  await waitFor(() => expect(ultimaAlerta()).toMatchObject({ icon: 'success', text: expect.stringContaining('Servicio desactivado.') }));
  expect(mock).toHaveBeenCalledWith('/negocios/mio/servicios/uno/estado', { method: 'PATCH', body: JSON.stringify({ activo: false }) });
});

it('cancelar eliminación conserva el servicio y no envía DELETE', async () => {
  abrir();
  mockearConfirmacion(false);
  await userEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
  expect(ultimaAlerta()).toMatchObject({ title: 'Eliminar servicio', showCancelButton: true });
  expect(mock.mock.calls.some(([, opciones]) => opciones?.method === 'DELETE')).toBe(false);
});

it('muestra Guardando... durante el PUT y restablece el botón mientras la alerta de éxito sigue abierta', async () => {
  let resolverPut!: (valor: unknown) => void;
  let cerrarAlerta!: () => void;
  const implementacion = mock.getMockImplementation()!;
  mock.mockImplementation(async (ruta, opciones) => {
    if (opciones?.method === 'PUT') {
      return new Promise((resolve) => { resolverPut = resolve; });
    }
    return implementacion(ruta, opciones);
  });
  swalFireMock.mockImplementationOnce(
    () => new Promise((resolve) => {
      cerrarAlerta = () => resolve({ isConfirmed: true, isDenied: false, isDismissed: false, value: true });
    }),
  );

  abrir();
  await userEvent.click(await screen.findByRole('button', { name: 'Guardar cambios' }));

  // Control negativo: mientras la petición está en curso, el botón sí muestra Guardando...
  expect(screen.getByRole('button', { name: 'Guardando...' })).toBeDisabled();

  await act(async () => resolverPut(servicio));
  await waitFor(() => expect(swalFireMock).toHaveBeenCalledTimes(1));

  // Con la alerta abierta, el botón ya volvió a Guardar cambios y aún no navega
  expect(screen.queryByRole('button', { name: 'Guardando...' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
  expect(screen.queryByRole('heading', { name: 'Mis servicios' })).not.toBeInTheDocument();

  await act(async () => cerrarAlerta());
  expect(await screen.findByRole('heading', { name: 'Mis servicios' })).toBeInTheDocument();
});
