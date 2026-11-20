import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ReportarProblema } from './ReportarProblema';
import { api, ErrorApi } from '../../servicios/api';
vi.mock('../../servicios/api', async original => ({ ...await original<typeof import('../../servicios/api')>(), api: vi.fn() }));
const apiMock = vi.mocked(api);
const reporte = { id: 'r1', asunto: 'Error del panel', estado: 'abierto', creadaEn: '2026-11-20T02:00:00Z' };
beforeEach(() => { apiMock.mockReset().mockResolvedValue([]); });
async function montar() {
  const vista = render(<ReportarProblema />);
  await screen.findByText('Todavía no has enviado reportes');
  return vista;
}
function llenar(asunto = reporte.asunto, descripcion = 'No puedo consultar mis servicios.') {
  fireEvent.change(screen.getByLabelText('Asunto'), { target: { value: asunto } });
  fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: descripcion } });
}
const enviar = () => fireEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }));
it.each([
  ['abcd', 'd'.repeat(20)], ['a'.repeat(101), 'd'.repeat(20)], ['abcde', 'd'.repeat(19)], ['abcde', 'd'.repeat(1001)],
  ['  abcd  ', 'd'.repeat(20)], ['abcde', ' '.repeat(20)], ['', ''],
])('C1 no envía fuera de rango (%s)', async (asunto, descripcion) => {
  await montar(); llenar(asunto, descripcion); enviar();
  expect(apiMock).toHaveBeenCalledTimes(1);
  expect(apiMock).not.toHaveBeenCalledWith('/soporte/reportes', expect.anything());
  expect(document.querySelector('[aria-invalid="true"]')).toBeInTheDocument();
});
it.each([[5,20],[100,1000]])('C1/C2 envía límites %i/%i recortados, sin uid, muestra éxito y lista con fecha de México', async (a, d) => {
  await montar();
  const asunto = 'a'.repeat(a); const descripcion = 'd'.repeat(d);
  apiMock.mockResolvedValueOnce({ ...reporte, asunto });
  llenar(`  ${asunto}  `, `  ${descripcion}  `);
  expect(screen.getByText(`${a}/100 caracteres. El asunto debe tener entre 5 y 100 caracteres.`)).toBeInTheDocument();
  enviar();
  expect(await screen.findByText('Tu reporte se envió correctamente.')).toHaveClass('panel-alerta--exito');
  expect(apiMock).toHaveBeenLastCalledWith('/soporte/reportes', { method: 'POST', body: JSON.stringify({ asunto, descripcion }) });
  const item = screen.getByRole('article');
  expect(within(item).getByRole('heading')).toHaveTextContent(asunto);
  expect(within(item).getByText('Abierto')).toHaveClass('panel-insignia--aviso');
  expect(item.querySelector('time')).toHaveAttribute('datetime', reporte.creadaEn);
  expect(item.querySelector('time')).toHaveTextContent(/19 nov 2026/);
  expect(screen.getByLabelText('Asunto')).toHaveValue('');
});
it.each([new ErrorApi(400, 'Datos inválidos'), new ErrorApi(500, 'Internal server error'), new TypeError('Failed to fetch')])('C3 error de API/red en español sin alert', async error => {
  const alerta = vi.spyOn(window, 'alert').mockImplementation(() => {});
  await montar(); apiMock.mockRejectedValueOnce(error); llenar(); enviar();
  expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos enviar tu reporte. Revisa tu conexión e intenta de nuevo.');
  expect(screen.getByLabelText('Asunto')).toHaveValue(reporte.asunto);
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  expect(alerta).not.toHaveBeenCalled(); alerta.mockRestore();
});
it('C4 usa las superficies, cabecera, campos y botones compartidos', async () => {
  const { container } = await montar();
  expect(container.querySelector('.panel-pagina > .panel-contenedor > .panel-encabezado .panel-titulo')).toHaveTextContent('Reportar un problema');
  expect(container.querySelectorAll('.panel-tarjeta')).toHaveLength(2);
  expect(screen.getByLabelText('Asunto')).toHaveClass('form-control');
  expect(screen.getByRole('button', { name: 'Enviar reporte' })).toHaveClass('btn-servia-primary');
  expect(container.querySelector('[style]')).toBeNull();
});
it('C4 carga, error en español y reintento sin mostrar vacío falso', async () => {
  let rechazar!: (error: Error) => void;
  apiMock.mockImplementationOnce(() => new Promise((_, reject) => { rechazar = reject; }));
  render(<ReportarProblema />);
  expect(screen.getByRole('status')).toHaveTextContent('Cargando tus reportes');
  expect(screen.queryByText('Todavía no has enviado reportes')).not.toBeInTheDocument();
  await act(async () => rechazar(new TypeError('Failed to fetch')));
  expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tus reportes. Intenta de nuevo.');
  apiMock.mockResolvedValueOnce([reporte]);
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByRole('article')).toHaveTextContent(reporte.asunto);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('evita envíos duplicados y conserva el POST si termina antes que el GET', async () => {
  let listar!: (datos: unknown) => void; let crear!: (datos: unknown) => void;
  apiMock.mockImplementationOnce(() => new Promise(resolve => { listar = resolve; }));
  apiMock.mockImplementationOnce(() => new Promise(resolve => { crear = resolve; }));
  render(<ReportarProblema />); llenar(); enviar();
  expect(screen.getByRole('button', { name: 'Enviando...' })).toBeDisabled();
  fireEvent.submit(screen.getByLabelText('Asunto').closest('form')!);
  expect(apiMock).toHaveBeenCalledTimes(2);
  await act(async () => crear(reporte));
  await act(async () => listar([]));
  expect(screen.getAllByRole('article')).toHaveLength(1);
});
