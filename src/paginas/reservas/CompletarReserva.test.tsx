import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';
import { api, ErrorApi } from '../../servicios/api';
import { useAuth } from '../../contextos/AuthContext';
import { DetalleReserva } from './DetalleReserva';
import { formatearFecha, formatearHora } from './estados';

vi.mock('../../servicios/api', () => ({
  api: vi.fn(),
  ErrorApi: class extends Error {
    estado: number;
    constructor(estado: number, mensaje: string) { super(mensaje); this.estado = estado; }
  },
}));
vi.mock('../../contextos/AuthContext', () => ({ useAuth: vi.fn() }));

const apiMock = vi.mocked(api);
const cerrarSesion = vi.fn(async () => {});
const ruta = '/reservas/negocio/r78';
const completar = `${ruta}/completar`;
const inicio = '2030-11-20T18:00:00.000Z'; // Mediodía de México; las pruebas corren con TZ=UTC.
const textoBoton = 'Marcar como completada';
const textoExito = 'Reserva marcada como completada.';
const textoDialogo = '¿Marcar esta reserva como completada? Ya no se podrá modificar.';

function reserva(estado = 'confirmada', fecha = inicio) {
  return {
    id: 'r78', folio: 'SRV-7KQ2MX', estado, inicio: fecha, fin: '2030-11-20T19:00:00Z',
    cliente: { nombre: 'Ana López', telefono: '5512345678' },
    servicio: { nombre: 'Corte de cabello', precio: 100, duracionMin: 60 },
    venceEn: estado === 'pendiente' ? '2030-11-20T19:00:00Z' : null,
    segundosRestantes: null,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(inicio));
  apiMock.mockReset();
  cerrarSesion.mockClear();
  vi.mocked(useAuth).mockReturnValue({ usuario: null, cargando: false, cerrarSesion });
  apiMock.mockResolvedValue(reserva());
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});
afterEach(() => {
  expect(window.alert).not.toHaveBeenCalled();
  vi.useRealTimers();
});

async function mostrar(datos = reserva()) {
  apiMock.mockResolvedValueOnce(datos);
  let vista!: ReturnType<typeof render>;
  await act(async () => {
    vista = render(
      <MemoryRouter initialEntries={['/reservas/r78']}>
        <Routes>
          <Route path="/reservas/:id" element={<DetalleReserva />} />
          <Route path="/login" element={<h1>Inicia sesión</h1>} />
          <Route path="/reservas" element={<h1>Reservas</h1>} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return vista;
}
async function pulsar(elemento: HTMLElement) {
  await act(async () => { fireEvent.click(elemento); });
}
async function abrir() { await pulsar(screen.getByRole('button', { name: textoBoton })); }
async function confirmar() { await pulsar(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Confirmar' })); }
function patches() { return apiMock.mock.calls.filter(([, opciones]) => opciones?.method === 'PATCH'); }

describe('MVP-27 completar reserva', () => {
  it.each([
    ['confirmada', '2030-11-20T17:59:59Z', true],
    ['confirmada', inicio, true],
    ['confirmada', '2030-11-20T18:00:01Z', false],
    ['pendiente', inicio, false],
    ['rechazada', inicio, false],
    ['rechazada_vencimiento', inicio, false],
    ['cancelada', inicio, false],
    ['completada', inicio, false],
  ])('C1 visibilidad en %s a %s: %s', async (estado, fecha, visible) => {
    await mostrar(reserva(estado, fecha));
    expect(screen.queryByRole('button', { name: textoBoton }) !== null).toBe(visible);
    expect(patches()).toHaveLength(0);
  });

  it('C1 usa el ahora vivo y habilita justo al inicio sin recargar', async () => {
    vi.setSystemTime(new Date(Date.parse(inicio) - 1000));
    const vista = await mostrar();
    expect(screen.queryByRole('button', { name: textoBoton })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar reserva' })).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.getByRole('button', { name: textoBoton })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Cancelar reserva' })).not.toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledTimes(1);
    vista.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('C2 presenta folio, cliente, fecha y hora; Cancelar no envía', async () => {
    await mostrar();
    await abrir();
    const modal = screen.getByRole('alertdialog');
    expect(modal).toHaveAttribute('aria-modal', 'true');
    expect(within(modal).getByRole('heading')).toHaveTextContent(textoDialogo);
    for (const dato of ['SRV-7KQ2MX', 'Ana López', formatearFecha(inicio), formatearHora(inicio)]) {
      expect(modal).toHaveTextContent(dato);
    }
    expect(patches()).toHaveLength(0);
    await pulsar(within(modal).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(patches()).toHaveLength(0);
    expect(screen.getByText('Confirmada')).toBeInTheDocument();
  });

  it('C2 Escape cierra sin enviar', async () => {
    await mostrar();
    await abrir();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(patches()).toHaveLength(0);
  });

  it('C3 PATCH sin cuerpo bloquea durante el envío y usa el 200 sin otro GET', async () => {
    await mostrar();
    let resolver!: (datos: unknown) => void;
    apiMock.mockReturnValueOnce(new Promise(resolve => { resolver = resolve; }));
    await abrir();
    await confirmar();
    const modal = screen.getByRole('alertdialog');
    expect(within(modal).getByRole('button', { name: 'Confirmando...' })).toBeDisabled();
    expect(within(modal).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: textoBoton })).toBeDisabled();
    await pulsar(within(modal).getByRole('button', { name: 'Confirmando...' }));
    expect(patches()).toEqual([[completar, { method: 'PATCH' }]]);
    expect(apiMock).toHaveBeenCalledTimes(2);
    await act(async () => { resolver({ ...reserva('completada'), servicio: { nombre: 'Servicio actualizado', precio: 200, duracionMin: 60 } }); });
    expect(screen.getByRole('status')).toHaveTextContent(textoExito);
    expect(screen.getByRole('status')).toHaveClass('panel-alerta', 'panel-alerta--exito');
    expect(screen.getByText('Servicio actualizado')).toBeInTheDocument();
    expect(screen.getByText('Completada')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(apiMock).toHaveBeenCalledTimes(2);
  });

  it('C4 una Completada cargada no ofrece ninguna acción (RN-54)', async () => {
    await mostrar(reserva('completada'));
    expect(screen.getByText('Completada')).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByRole('link', { name: 'Volver a reservas' })).toHaveAttribute('href', '/reservas');
    expect(patches()).toHaveLength(0);
  });

  it('C5 409 conserva message, cierra y recarga el detalle vigente', async () => {
    await mostrar();
    apiMock.mockRejectedValueOnce(new ErrorApi(409, 'La reserva ya fue completada.'));
    apiMock.mockResolvedValueOnce(reserva('completada'));
    await abrir();
    await confirmar();
    expect(screen.getByRole('alert')).toHaveTextContent('La reserva ya fue completada.');
    expect(screen.getByRole('alert')).toHaveClass('panel-alerta--error');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('Completada')).toBeInTheDocument();
    expect(apiMock.mock.calls).toEqual([[ruta], [completar, { method: 'PATCH' }], [ruta]]);
  });

  it.each([
    [new ErrorApi(404, 'Mensaje interno distinto'), 'La reserva no existe.'],
    [new TypeError('Failed to fetch'), 'No se pudo conectar. Inténtalo de nuevo.'],
  ])('C5 muestra el error traducido %s y permite reintentar', async (error, texto) => {
    await mostrar();
    apiMock.mockRejectedValueOnce(error);
    await abrir();
    await confirmar();
    const modal = screen.getByRole('alertdialog');
    expect(within(modal).getByRole('alert')).toHaveTextContent(texto);
    expect(within(modal).getByRole('button', { name: 'Confirmar' })).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledTimes(2);
    apiMock.mockResolvedValueOnce(reserva('completada'));
    await confirmar();
    expect(screen.getByRole('status')).toHaveTextContent(textoExito);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('C5 401 cierra la sesión antes de volver al inicio de sesión', async () => {
    await mostrar();
    apiMock.mockRejectedValueOnce(new ErrorApi(401, 'Sesión expirada'));
    await abrir();
    await confirmar();
    expect(cerrarSesion).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledTimes(2);
  });

  it('C6 comparte diálogo y botones de aceptar, sin estilos nuevos', async () => {
    const vista = await mostrar(reserva('pendiente'));
    await pulsar(screen.getByRole('button', { name: 'Aceptar Reserva' }));
    const referencia = screen.getByRole('alertdialog');
    const clases = (modal: HTMLElement) => [modal.className, ...Array.from(modal.querySelectorAll('div, h3, p, button'), e => e.className)];
    const clasesReferencia = clases(referencia);
    vista.unmount();
    await mostrar();
    expect(screen.getByRole('button', { name: textoBoton })).toHaveClass('btn-servia-primary');
    await abrir();
    const modal = screen.getByRole('alertdialog');
    expect(clases(modal)).toEqual(clasesReferencia);
    expect(modal.querySelector('[style]')).toBeNull();
    expect(within(modal).getByRole('button', { name: 'Confirmar' })).toHaveClass('btn-servia-primary');
    expect(within(modal).getByRole('button', { name: 'Cancelar' })).toHaveClass('btn-servia-secondary');
  });
});
