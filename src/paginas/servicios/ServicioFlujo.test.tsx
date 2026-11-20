import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import { api, ErrorApi } from '../../servicios/api';
import { MENSAJE_ERROR_SERVIDOR } from '../../servicios/mensajeDeError';
import { NuevoServicio } from './NuevoServicio';
import { MisServicios } from './MisServicios';
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
async function confirmar(accion: string) {
  const dialogo = await screen.findByRole('alertdialog');
  await userEvent.click(within(dialogo).getByRole('button', { name: accion }));
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
it('edita datos por PUT y vuelve con éxito y precio actualizado', async () => {
  abrir();
  fireEvent.change(await screen.findByLabelText('Precio del servicio *'), { target: { value: '75' } });
  await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  expect(await screen.findByRole('heading', { name: 'Mis servicios' }, { timeout: 5000 })).toBeInTheDocument();
  expect(await screen.findByText('$75.00')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Cambios guardados.');
  expect(mock).toHaveBeenCalledWith('/negocios/mio/servicios/uno', { method: 'PUT', body: JSON.stringify({ nombre: 'Corte', descripcion: 'Cabello', precio: 75, duracionMin: 30 }) });
});
it.each([['Nombre del servicio *', '', 'Escribe el nombre del servicio.'], ['Descripción del servicio *', '', 'Escribe una descripción.'], ['Precio del servicio *', '-1', 'El precio debe ser 0 o más.'], ['Duración del servicio *', '0', 'La duración debe ser de al menos 1 minuto.']])('valida %s al editar con el mensaje compartido', async (campo, valor, mensaje) => {
  abrir();
  fireEvent.change(await screen.findByLabelText(campo), { target: { value: valor } });
  await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  expect(screen.getByText(mensaje)).toBeInTheDocument();
  expect(mock.mock.calls.some(([, opciones]) => opciones?.method === 'PUT')).toBe(false);
});
it('informa que las reservas existentes conservan precio y duración', async () => {
  abrir();
  expect(await screen.findByText('Los cambios de precio o duración no afectan las reservas que ya existen.')).toBeInTheDocument();
});
it('confirma desactivación, permite cancelar y retiene/restaura foco', async () => {
  abrir();
  const desactivar = await screen.findByRole('button', { name: 'Desactivar' });
  await userEvent.click(desactivar);
  const dialogo = screen.getByRole('alertdialog', { name: 'Desactivar servicio' });
  expect(dialogo).toHaveAccessibleDescription('¿Desactivar «Corte»? Los clientes ya no podrán reservarlo. Sus reservas existentes no cambian.');
  expect(within(dialogo).getByRole('button', { name: 'Desactivar' })).toHaveFocus();
  await userEvent.tab({ shift: true });
  expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  await userEvent.keyboard('{Escape}');
  expect(desactivar).toHaveFocus();
  expect(mock.mock.calls.some(([, opciones]) => opciones?.method === 'PATCH')).toBe(false);
});
it.each(['/servicios/uno', '/servicios'])('desactiva desde %s y añade RN-11 al éxito anunciado', async ruta => {
  abrir(ruta);
  await userEvent.click(await screen.findByRole('button', { name: 'Desactivar' }));
  await confirmar('Desactivar');
  expect(await screen.findByRole('status')).toHaveTextContent(`Servicio desactivado. ${AVISO}`);
  expect(await screen.findByText(ruta === '/servicios' ? 'Inactivo' : 'Estado: Inactivo')).toBeInTheDocument();
  expect(mock).toHaveBeenCalledWith('/negocios/mio/servicios/uno/estado', { method: 'PATCH', body: JSON.stringify({ activo: false }) });
});
it('activa el servicio inactivo y muestra el nuevo estado sin aviso RN-11', async () => {
  servicio.activo = false; visible = true;
  abrir();
  await userEvent.click(await screen.findByRole('button', { name: 'Activar' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Servicio activado.');
  expect(screen.getByText('Estado: Activo')).toBeInTheDocument();
  expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
  expect(mock).toHaveBeenCalledWith('/negocios/mio/servicios/uno/estado', { method: 'PATCH', body: JSON.stringify({ activo: true }) });
});
it.each(['/servicios/uno', '/servicios'])('elimina desde %s con confirmación y RN-11 tras consultar perfil', async ruta => {
  abrir(ruta);
  await userEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
  expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription('¿Eliminar «Corte»? Esta acción no se puede deshacer.');
  await confirmar('Eliminar');
  expect(await screen.findByRole('heading', { name: 'Mis servicios' })).toBeInTheDocument();
  expect(await screen.findByRole('status')).toHaveTextContent(`Servicio eliminado. ${AVISO}`);
  expect(mock).toHaveBeenCalledWith('/negocios/mio');
  expect(mock).toHaveBeenCalledWith('/negocios/mio/servicios/uno', { method: 'DELETE' });
});
it('elimina sin aviso RN-11 cuando quedan servicios activos', async () => {
  visible = true; abrir();
  await userEvent.click(await screen.findByRole('button', { name: 'Eliminar' })); await confirmar('Eliminar');
  expect(await screen.findByRole('status')).toHaveTextContent('Servicio eliminado.');
  expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
});
it('reintenta la visibilidad sin repetir el DELETE ya exitoso', async () => {
  const implementacion = mock.getMockImplementation()!;
  mock.mockImplementation(async (ruta, opciones) => { if (ruta === '/negocios/mio') throw new ErrorApi(503, 'Perfil'); return implementacion(ruta, opciones); });
  abrir();
  await userEvent.click(await screen.findByRole('button', { name: 'Eliminar' })); await confirmar('Eliminar');
  expect(await screen.findByRole('alert')).toHaveTextContent('Servicio eliminado. No pudimos consultar la visibilidad del negocio. Intenta de nuevo.');
  mock.mockImplementation(implementacion);
  await userEvent.click(screen.getByRole('button', { name: 'Consultar visibilidad de nuevo' }));
  expect(await screen.findByRole('status')).toHaveTextContent(AVISO);
  expect(mock.mock.calls.filter(([, opciones]) => opciones?.method === 'DELETE')).toHaveLength(1);
});
it.each(['/servicios/uno', '/servicios'])('409 en %s ofrece desactivar sin segunda confirmación ni borrar otra vez', async ruta => {
  const implementacion = mock.getMockImplementation()!;
  mock.mockImplementation(async (ruta, opciones) => { if (opciones?.method === 'DELETE') throw new ErrorApi(409, 'Reservas'); return implementacion(ruta, opciones); });
  abrir(ruta);
  await userEvent.click(await screen.findByRole('button', { name: 'Eliminar' })); await confirmar('Eliminar');
  const dialogo = await screen.findByRole('alertdialog');
  await waitFor(() => expect(dialogo).toHaveAccessibleDescription('Este servicio ya tuvo reservas, así que no se puede eliminar. Puedes desactivarlo para que deje de ofrecerse.'));
  await userEvent.click(within(dialogo).getByRole('button', { name: 'Desactivar' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Servicio desactivado.');
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(mock.mock.calls.filter(([, opciones]) => opciones?.method === 'DELETE')).toHaveLength(1);
});
it.each(['PUT', 'PATCH', 'DELETE'])('muestra el error del servidor ante fallo 500 en %s y permite reintentar', async metodo => {
  const implementacion = mock.getMockImplementation()!;
  mock.mockImplementation(async (ruta, opciones) => { if (opciones?.method === metodo) throw new ErrorApi(500, 'Detalle privado'); return implementacion(ruta, opciones); });
  abrir(); await screen.findByLabelText('Nombre del servicio *');
  if (metodo === 'PUT') await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  else { const accion = metodo === 'PATCH' ? 'Desactivar' : 'Eliminar'; await userEvent.click(screen.getByRole('button', { name: accion })); await confirmar(accion); }
  expect(await screen.findByRole('alert')).toHaveTextContent(MENSAJE_ERROR_SERVIDOR);
  expect(screen.queryByText('Detalle privado')).not.toBeInTheDocument();
  mock.mockImplementation(implementacion);
  if (metodo === 'PUT') { await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' })); expect(await screen.findByRole('status')).toHaveTextContent('Cambios guardados.'); }
  else { const accion = metodo === 'PATCH' ? 'Desactivar' : 'Eliminar'; await userEvent.click(screen.getByRole('button', { name: accion })); await confirmar(accion); expect(await screen.findByRole('status')).toHaveTextContent(metodo === 'PATCH' ? 'Servicio desactivado.' : 'Servicio eliminado.'); }
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
  if (metodo === 'PUT') await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  else { const accion = metodo === 'PATCH' ? 'Desactivar' : 'Eliminar'; await userEvent.click(screen.getByRole('button', { name: accion })); await confirmar(accion); }
  expect(await screen.findByRole('alert')).toHaveTextContent(esperado);
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
  await userEvent.click(await screen.findByRole('button', { name: 'Eliminar' })); await confirmar('Eliminar');
  await waitFor(() => expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription('Este servicio ya tuvo reservas, así que no se puede eliminar. Puedes desactivarlo para que deje de ofrecerse.'));
  await confirmar('Desactivar');
  expect(await screen.findByRole('status')).toHaveTextContent('Servicio desactivado.');
  expect(mock).toHaveBeenCalledWith('/negocios/mio/servicios/uno/estado', { method: 'PATCH', body: JSON.stringify({ activo: false }) });
});
it('cancelar eliminación conserva el servicio y no envía DELETE', async () => {
  abrir();
  await userEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(mock.mock.calls.some(([, opciones]) => opciones?.method === 'DELETE')).toBe(false);
});
