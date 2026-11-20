import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import { api, ErrorApi } from '../../servicios/api';
import { MENSAJE_ERROR_SERVIDOR } from '../../servicios/mensajeDeError';
import { NuevoServicio } from './NuevoServicio';
vi.mock('../../servicios/api', () => ({ api: vi.fn(), ErrorApi: class extends Error { estado: number; constructor(estado: number, mensaje: string) { super(mensaje); this.estado = estado; } } }));
const mock = vi.mocked(api);
const datos = { nombre: 'Corte', descripcion: 'Cabello', precio: 50, duracionMin: 30, activo: true };
function abrir(ruta = '/servicios/uno') {
  render(<MemoryRouter initialEntries={[ruta]}><Routes><Route path="/servicios/:id" element={<NuevoServicio />} /><Route path="/nuevo" element={<NuevoServicio />} /></Routes></MemoryRouter>);
}
beforeEach(() => { mock.mockReset(); });
it('404 impide editar y ofrece regreso', async () => {
  mock.mockRejectedValue(new ErrorApi(404, 'Interno'));
  abrir();
  expect(await screen.findByRole('alert')).toHaveTextContent('Este servicio no existe.');
  expect(screen.getByRole('link', { name: 'Volver a Mis servicios' })).toHaveAttribute('href', '/servicios');
  expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument();
});
it('recupera una carga fallida sin habilitar un formulario vacío', async () => {
  mock.mockRejectedValueOnce(new ErrorApi(503, 'Interno')).mockResolvedValue(datos);
  abrir();
  expect(await screen.findByRole('alert')).toHaveTextContent(MENSAJE_ERROR_SERVIDOR);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Intentar de nuevo' }));
  expect(await screen.findByLabelText('Nombre del servicio *')).toHaveValue('Corte');
});
it.each([
  [new ErrorApi(429, 'Demasiadas consultas; inténtalo más tarde.'), 'Demasiadas consultas; inténtalo más tarde.'],
  [new ErrorApi(500, 'Error interno'), MENSAJE_ERROR_SERVIDOR],
  [new TypeError('Failed to fetch'), 'No pudimos cargar los datos. Intenta de nuevo.'],
])('carga de servicio distingue 429, 500 y fallo de red', async (error, esperado) => {
  mock.mockRejectedValueOnce(error);
  abrir();
  expect(await screen.findByRole('alert')).toHaveTextContent(esperado);
});
it('edita sin depender de la carga del perfil', async () => {
  mock.mockImplementation(async ruta => { if (ruta === '/negocios/mio') throw new ErrorApi(503, 'Perfil caído'); return datos; });
  abrir();
  expect(await screen.findByLabelText('Nombre del servicio *')).toHaveValue('Corte');
  expect(mock).toHaveBeenCalledWith('/negocios/mio/servicios/uno');
});
it('recupera el perfil al crear sin permitir publicar durante el fallo', async () => {
  mock.mockRejectedValueOnce(new ErrorApi(503, 'Perfil')).mockResolvedValue({ perfilCompleto: true });
  abrir('/nuevo');
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Publicar servicio' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByText('Intentar de nuevo'));
  expect(await screen.findByRole('button', { name: 'Publicar servicio' })).toBeEnabled();
});
it('restaura nombre, descripción y foco del diálogo al publicar', async () => {
  mock.mockResolvedValue({ perfilCompleto: true });
  abrir('/nuevo');
  await screen.findByLabelText('Nombre del servicio *');
  for (const [label, value] of [['Nombre del servicio *', 'Corte'], ['Descripción del servicio *', 'Cabello'], ['Precio del servicio *', '50'], ['Duración del servicio *', '30']]) {
    await userEvent.type(screen.getByLabelText(label), value);
  }
  await userEvent.click(screen.getByRole('button', { name: 'Publicar servicio' }));
  const dialogo = await screen.findByRole('alertdialog', { name: 'Servicio publicado.' });
  expect(dialogo).toHaveAccessibleDescription('Corte ya forma parte de tu catálogo. Tus clientes podrán encontrarlo y reservarlo.');
  const ver = screen.getByRole('button', { name: 'Ver mis servicios' });
  expect(ver).toHaveFocus();
  await userEvent.tab({ shift: true });
  expect(screen.getByRole('button', { name: 'Crear otro servicio' })).toHaveFocus();
  await userEvent.tab();
  expect(ver).toHaveFocus();
});
