import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';
import { api, ErrorApi } from '../../servicios/api';
import { useAuth } from '../../contextos/AuthContext';
import { DetalleReserva } from './DetalleReserva';
import { formatearFecha, formatearHora } from './estados';
import { mockearConfirmacion, ultimaAlerta } from '../../pruebas/mockAlertas';

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
  vi.mocked(useAuth).mockReturnValue({
    usuario: null,
    cargando: false,
    cerrarSesion,
    iniciarSesionConGoogle: vi.fn(),
    leerBienvenidaGoogle: () => null,
    limpiarBienvenidaGoogle: () => {},
  });
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
async function abrir(confirmada = true) {
  mockearConfirmacion(confirmada);
  await pulsar(screen.getByRole('button', { name: textoBoton }));
}
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

  it('C2 presenta folio, cliente, fecha y hora en la confirmación; Cancelar no envía', async () => {
    await mostrar();
    await abrir(false);
    const alerta = ultimaAlerta();
    expect(alerta).toMatchObject({ title: textoDialogo, showCancelButton: true });
    for (const dato of ['SRV-7KQ2MX', 'Ana López', formatearFecha(inicio), formatearHora(inicio)]) {
      expect(String(alerta?.text)).toContain(dato);
    }
    expect(patches()).toHaveLength(0);
    expect(screen.getByText('Confirmada')).toBeInTheDocument();
  });

  it('C3 PATCH sin cuerpo bloquea durante el envío y usa el 200 sin otro GET', async () => {
    await mostrar();
    let resolver!: (datos: unknown) => void;
    apiMock.mockReturnValueOnce(new Promise(resolve => { resolver = resolve; }));
    await abrir(true);
    const boton = screen.getByRole('button', { name: 'Confirmando...' });
    expect(boton).toBeDisabled();
    await pulsar(boton);
    expect(patches()).toEqual([[completar, { method: 'PATCH' }]]);
    expect(apiMock).toHaveBeenCalledTimes(2);
    await act(async () => { resolver({ ...reserva('completada'), servicio: { nombre: 'Servicio actualizado', precio: 200, duracionMin: 60 } }); });
    expect(ultimaAlerta()).toMatchObject({ icon: 'success', text: textoExito });
    expect(screen.getByText('Servicio actualizado')).toBeInTheDocument();
    expect(screen.getByText('Completada')).toBeInTheDocument();
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

  it('C5 409 muestra el mensaje en alerta de error y recarga el detalle vigente', async () => {
    await mostrar();
    apiMock.mockRejectedValueOnce(new ErrorApi(409, 'La reserva ya fue completada.'));
    apiMock.mockResolvedValueOnce(reserva('completada'));
    await abrir(true);
    expect(ultimaAlerta()).toMatchObject({ icon: 'error', text: 'La reserva ya fue completada.' });
    expect(screen.getByText('Completada')).toBeInTheDocument();
    expect(apiMock.mock.calls).toEqual([[ruta], [completar, { method: 'PATCH' }], [ruta]]);
  });

  it.each([
    [new ErrorApi(404, 'Mensaje interno distinto'), 'La reserva no existe.'],
    [new TypeError('Failed to fetch'), 'No se pudo conectar. Inténtalo de nuevo.'],
  ])('C5 muestra el error traducido %s y permite reintentar', async (error, texto) => {
    await mostrar();
    apiMock.mockRejectedValueOnce(error);
    await abrir(true);
    expect(ultimaAlerta()).toMatchObject({ icon: 'error', text: texto });
    expect(screen.getByRole('button', { name: textoBoton })).toBeEnabled();
    expect(apiMock).toHaveBeenCalledTimes(2);
    apiMock.mockResolvedValueOnce(reserva('completada'));
    await abrir(true);
    expect(ultimaAlerta()).toMatchObject({ icon: 'success', text: textoExito });
  });

  it('C5 401 cierra la sesión antes de volver al inicio de sesión', async () => {
    await mostrar();
    apiMock.mockRejectedValueOnce(new ErrorApi(401, 'Sesión expirada'));
    await abrir(true);
    expect(cerrarSesion).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledTimes(2);
  });

  it('C6 usa la misma alerta de confirmación que Aceptar y botón primario del panel', async () => {
    const vista = await mostrar(reserva('pendiente'));
    mockearConfirmacion(false);
    await pulsar(screen.getByRole('button', { name: 'Aceptar Reserva' }));
    const alertaAceptar = ultimaAlerta();
    vista.unmount();

    await mostrar();
    expect(screen.getByRole('button', { name: textoBoton })).toHaveClass('btn-servia-primary');
    await abrir(false);
    const alertaCompletar = ultimaAlerta();
    expect(alertaCompletar?.customClass).toEqual(alertaAceptar?.customClass);
    expect(alertaCompletar?.confirmButtonText).toBe('Confirmar');
    expect(alertaCompletar?.cancelButtonText).toBe('Cancelar');
  });
});
