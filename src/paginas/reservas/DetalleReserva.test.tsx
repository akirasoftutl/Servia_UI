import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';
import { api, ErrorApi } from '../../servicios/api';
import { MENSAJE_ERROR_SERVIDOR } from '../../servicios/mensajeDeError';
import { DetalleReserva } from './DetalleReserva';
import { calcularTiempoRestante, formatearFecha, formatearHora } from './estados';

vi.mock('../../servicios/api', () => ({
  api: vi.fn(),
  ErrorApi: class ErrorApi extends Error {
    estado: number;
    datos?: unknown;
    constructor(estado: number, mensaje: string, datos?: unknown) {
      super(mensaje);
      this.name = 'ErrorApi';
      this.estado = estado;
      this.datos = datos;
    }
  },
}));

vi.mock('../../contextos/AuthContext', () => ({ useAuth: () => ({ cerrarSesion: vi.fn() }) }));

const apiMock = vi.mocked(api);

function reserva(extra: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    folio: 'SRV-123',
    estado: 'pendiente',
    inicio: '2030-11-04T02:00:00Z',
    fin: '2030-11-04T03:00:00Z',
    servicio: { nombre: 'Corte de cabello', precio: 100, duracionMin: 60 },
    cliente: { nombre: 'Ana López', telefono: '5512345678', correo: 'ana@example.com' },
    venceEn: new Date(Date.now() + 61_000).toISOString(),
    segundosRestantes: 61,
    observaciones: 'Prefiere tarde',
    ...extra,
  };
}

function pendiente<T>() {
  let resolver!: (valor: T) => void;
  let rechazar!: (error: Error) => void;
  const promesa = new Promise<T>((resolve, reject) => { resolver = resolve; rechazar = reject; });
  return { promesa, resolver, rechazar };
}

let colaDetalle: unknown[] = [];
let respuestaPatch: unknown | Promise<unknown> | Error | null = null;
let alerta: ReturnType<typeof vi.spyOn>;

function responderDetalle(...respuestas: unknown[]) { colaDetalle = respuestas; }
function responderPatch(respuesta: unknown | Promise<unknown> | Error | null) { respuestaPatch = respuesta; }
function llamadas(ruta: string) { return apiMock.mock.calls.filter(([rutaLlamada]) => rutaLlamada === ruta); }

beforeEach(() => {
  apiMock.mockReset();
  colaDetalle = [reserva()];
  respuestaPatch = null;
  alerta = vi.spyOn(window, 'alert').mockImplementation(() => {});
  apiMock.mockImplementation(async (ruta, opciones) => {
    if (opciones?.method === 'PATCH') {
      if (respuestaPatch instanceof Error) throw respuestaPatch;
      if (respuestaPatch instanceof Promise) return respuestaPatch;
      const motivo = opciones.body ? JSON.parse(String(opciones.body)).motivo : undefined;
      if (ruta.endsWith('/aceptar')) colaDetalle[colaDetalle.length - 1] = reserva({ estado: 'confirmada', segundosRestantes: null });
      if (ruta.endsWith('/rechazar')) colaDetalle[colaDetalle.length - 1] = reserva({ estado: 'rechazada', segundosRestantes: null, motivo });
      if (ruta.endsWith('/cancelar')) colaDetalle[colaDetalle.length - 1] = reserva({ estado: 'cancelada', segundosRestantes: null, motivo });
      return respuestaPatch ?? {};
    }
    const respuesta = colaDetalle.length > 1 ? colaDetalle.shift() : colaDetalle[0];
    if (respuesta instanceof Error) throw respuesta;
    return respuesta;
  });
});

afterEach(() => {
  expect(alerta).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

function mostrar() {
  return render(
    <MemoryRouter initialEntries={['/reservas/detalle/r1']}>
      <Routes>
        <Route path="/reservas/detalle/:id" element={<DetalleReserva />} />
        <Route path="/reservas" element={<h1>Lista de reservas</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

async function listo(datos?: unknown) {
  if (datos !== undefined) responderDetalle(datos);
  mostrar();
  await screen.findByRole('heading', { name: 'Reserva SRV-123' });
}

describe('DetalleReserva', () => {
  it('MVP-27 completa tras confirmar y usa el detalle devuelto sin otro GET', async () => {
    await listo(reserva({ estado: 'confirmada', inicio: '2020-01-01T12:00:00Z', segundosRestantes: null }));
    responderPatch(reserva({ estado: 'completada', segundosRestantes: null }));
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como completada' }));
    expect(llamadas('/reservas/negocio/r1/completar')).toHaveLength(0);
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Reserva marcada como completada.');
    expect(apiMock).toHaveBeenCalledWith('/reservas/negocio/r1/completar', { method: 'PATCH' });
    expect(screen.getByText('Completada')).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(llamadas('/reservas/negocio/r1')).toHaveLength(1);
  });

  it('muestra el estado de carga mientras llega el detalle', async () => {
    const carga = pendiente();
    responderDetalle(carga.promesa);
    mostrar();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reserva SRV-123' })).not.toBeInTheDocument();
    await act(async () => carga.resolver(reserva()));
    expect(await screen.findByRole('heading', { name: 'Reserva SRV-123' })).toBeInTheDocument();
  });

  it('muestra un error específico y la salida cuando la reserva no existe', async () => {
    responderDetalle(new ErrorApi(404, 'No encontrada'));
    mostrar();
    expect(await screen.findByText('No encontramos esta reserva.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a reservas' })).toHaveAttribute('href', '/reservas');
  });

  it('muestra un error genérico si falla la carga', async () => {
    responderDetalle(new Error('Sin conexión'));
    mostrar();
    expect(await screen.findByText('No pudimos cargar la reserva. Intenta de nuevo.')).toBeInTheDocument();
  });

  it.each([
    [new ErrorApi(429, 'Demasiadas consultas de reserva.'), 'Demasiadas consultas de reserva.'],
    [new ErrorApi(500, 'Internal server error'), MENSAJE_ERROR_SERVIDOR],
    [new TypeError('Failed to fetch'), 'No pudimos cargar la reserva. Intenta de nuevo.'],
  ])('distingue 429, 500 y red al cargar el detalle de reserva', async (error, esperado) => {
    responderDetalle(error);
    mostrar();
    expect(await screen.findByRole('alert')).toHaveTextContent(esperado);
  });

  it('muestra los datos del cliente, del servicio y del horario', async () => {
    await listo();
    const datos = reserva();
    expect(screen.getByText('Ana López')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '5512345678' })).toHaveAttribute('href', 'tel:5512345678');
    expect(screen.getByRole('link', { name: 'ana@example.com' })).toHaveAttribute('href', 'mailto:ana@example.com');
    expect(screen.getByText('Prefiere tarde')).toBeInTheDocument();
    expect(screen.getByText('Corte de cabello')).toBeInTheDocument();
    expect(screen.getByText(/Duración:/)).toHaveTextContent('60 min');
    expect(screen.getByText(/Precio:/)).toHaveTextContent('$100.00');
    expect(screen.getByText(formatearFecha(datos.inicio))).toBeInTheDocument();
    expect(screen.getByText(`${formatearHora(datos.inicio)} - ${formatearHora(datos.fin)}`)).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
  });

  it('mantiene el tiempo para responder arriba del encabezado', async () => {
    await listo();
    const aviso = screen.getByRole('status');
    expect(aviso).toHaveTextContent('Tiempo para responder');
    expect(aviso).toHaveTextContent(calcularTiempoRestante(61));
    const titulo = screen.getByRole('heading', { level: 1, name: 'Reserva SRV-123' });
    expect(aviso.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeGreaterThan(0);
  });

  it('no ofrece acciones ni aviso de tiempo cuando el plazo ya venció', async () => {
    await listo(reserva({ estado: 'rechazada_vencimiento', segundosRestantes: 0, motivo: 'No se confirmó a tiempo' }));
    expect(screen.queryByText('Tiempo para responder')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aceptar Reserva' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rechazar Solicitud' })).not.toBeInTheDocument();
    expect(screen.getByText('Rechazada por vencimiento')).toBeInTheDocument();
    expect(screen.getByText('No se confirmó a tiempo')).toBeInTheDocument();
  });

  it('C1 reintenta la carga tras una falla de red', async () => {
    responderDetalle(new Error('Sin conexión'), reserva());
    mostrar();
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { name: 'Reserva SRV-123' })).toBeInTheDocument();
    expect(llamadas('/reservas/negocio/r1')).toHaveLength(2);
  });

  it('C2 avanza la cuenta por venceEn aunque segundosRestantes esté desfasado y limpia el reloj', async () => {
    vi.useFakeTimers();
    try {
      responderDetalle(reserva({ venceEn: new Date(Date.now() + 125_000).toISOString(), segundosRestantes: 9999 }));
      const vista = mostrar();
      await act(async () => {});
      expect(screen.getByText('2m restantes')).toBeInTheDocument();
      await act(async () => { await vi.advanceTimersByTimeAsync(65_000); });
      expect(screen.getByText('1m restantes')).toBeInTheDocument();
      vista.unmount();
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it('C3 recarga UNA sola vez al llegar a cero incluso si la API aún devuelve pendiente', async () => {
    vi.useFakeTimers();
    try {
      responderDetalle(reserva({ venceEn: new Date(Date.now() + 2000).toISOString(), segundosRestantes: 9999 }));
      mostrar();
      await act(async () => {});
      expect(llamadas('/reservas/negocio/r1')).toHaveLength(1);
      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
      expect(llamadas('/reservas/negocio/r1')).toHaveLength(2);
      expect(screen.queryByRole('button', { name: 'Aceptar Reserva' })).not.toBeInTheDocument();
      await act(async () => { await vi.advanceTimersByTimeAsync(65_000); });
      expect(llamadas('/reservas/negocio/r1')).toHaveLength(2);
    } finally { vi.useRealTimers(); }
  });

  it('F1 recarga una sola vez si cada GET devuelve un objeto nuevo de la misma pendiente vencida', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-11-03T12:00:00Z'));
    const venceEn = new Date(Date.now() - 1000).toISOString();
    apiMock.mockImplementation(async () => {
      // La demora permite observar el bucle sin encadenar promesas indefinidamente.
      await new Promise(resolve => window.setTimeout(resolve, 100));
      return reserva({ venceEn, segundosRestantes: 0 });
    });
    const vista = mostrar();
    try {
      await act(async () => { await vi.advanceTimersByTimeAsync(100); });
      expect(llamadas('/reservas/negocio/r1')).toHaveLength(2);
      for (let segundo = 0; segundo < 5; segundo++) {
        await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
      }
      expect(llamadas('/reservas/negocio/r1')).toHaveLength(2);
      expect(screen.getByText('Pendiente')).toBeInTheDocument();
    } finally {
      vista.unmount();
      vi.useRealTimers();
    }
  });

  it('usa segundosRestantes de respaldo cuando no hay venceEn', async () => {
    await listo(reserva({ venceEn: null, segundosRestantes: 120 }));
    expect(screen.getByText('2m restantes')).toBeInTheDocument();
  });

  it('confirma una reserva pendiente solo después de confirmar el modal', async () => {
    const usuario = userEvent.setup();
    await listo();
    await usuario.click(screen.getByRole('button', { name: 'Aceptar Reserva' }));
    const modal = screen.getByRole('alertdialog');
    expect(modal).toHaveTextContent('Ana López');
    await usuario.click(within(modal).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(llamadas('/reservas/negocio/r1/aceptar')).toHaveLength(0);

    await usuario.click(screen.getByRole('button', { name: 'Aceptar Reserva' }));
    await usuario.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(llamadas('/reservas/negocio/r1/aceptar')).toHaveLength(1));
    expect(apiMock).toHaveBeenCalledWith('/reservas/negocio/r1/aceptar', { method: 'PATCH' });
    expect(await screen.findByText('Reserva confirmada.')).toBeInTheDocument();
    expect(await screen.findByText('Confirmada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aceptar Reserva' })).not.toBeInTheDocument();
  });

  it('avisa si no se puede guardar la aceptación y mantiene el modal', async () => {
    responderPatch(new Error('Sin conexión'));
    const usuario = userEvent.setup();
    await listo();
    await usuario.click(screen.getByRole('button', { name: 'Aceptar Reserva' }));
    await usuario.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Confirmar' }));
    expect(await within(screen.getByRole('alertdialog')).findByRole('alert')).toHaveTextContent('No pudimos guardar tu respuesta. Intenta de nuevo.');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('rechaza requiriendo un motivo y enviándolo en el PATCH', async () => {
    const usuario = userEvent.setup();
    await listo();
    await usuario.click(screen.getByRole('button', { name: 'Rechazar Solicitud' }));
    const modal = screen.getByRole('alertdialog');
    await usuario.click(within(modal).getByRole('button', { name: 'Rechazar solicitud' }));
    expect(await within(modal).findByText('Escribe el motivo del rechazo.')).toBeInTheDocument();
    expect(llamadas('/reservas/negocio/r1/rechazar')).toHaveLength(0);

    await usuario.type(within(modal).getByRole('textbox'), 'Horario ocupado por mantenimiento');
    await usuario.click(within(modal).getByRole('button', { name: 'Rechazar solicitud' }));
    await waitFor(() => expect(llamadas('/reservas/negocio/r1/rechazar')).toHaveLength(1));
    expect(apiMock).toHaveBeenCalledWith('/reservas/negocio/r1/rechazar', {
      method: 'PATCH', body: JSON.stringify({ motivo: 'Horario ocupado por mantenimiento' }),
    });
    expect(await screen.findByText('Solicitud rechazada. El horario quedó libre.')).toBeInTheDocument();
    expect(await screen.findByText('Rechazada')).toBeInTheDocument();
    expect(screen.getByText('Horario ocupado por mantenimiento')).toBeInTheDocument();
  });

  it('no ofrece cancelar una reserva pendiente ni una confirmada en el pasado', async () => {
    await listo();
    expect(screen.queryByRole('button', { name: 'Cancelar reserva' })).not.toBeInTheDocument();
  });

  it('no ofrece cancelar una reserva confirmada cuya fecha ya pasó', async () => {
    await listo(reserva({ estado: 'confirmada', inicio: '2020-01-01T12:00:00Z', fin: '2020-01-01T13:00:00Z', segundosRestantes: null }));
    expect(screen.queryByRole('button', { name: 'Cancelar reserva' })).not.toBeInTheDocument();
  });

  it('cancela una reserva confirmada con motivo y muestra el aviso de éxito', async () => {
    const usuario = userEvent.setup();
    await listo(reserva({ estado: 'confirmada', segundosRestantes: null }));
    await usuario.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
    const modal = screen.getByRole('alertdialog');
    expect(modal).toHaveTextContent('El cliente verá este motivo');
    await usuario.click(within(modal).getByRole('button', { name: 'Cancelar reserva' }));
    expect(await within(modal).findByText('Escribe el motivo de la cancelación.')).toBeInTheDocument();
    expect(llamadas('/reservas/negocio/r1/cancelar')).toHaveLength(0);

    await usuario.type(within(modal).getByRole('textbox'), 'No hay cupo por mantenimiento');
    await usuario.click(within(modal).getByRole('button', { name: 'Cancelar reserva' }));
    await waitFor(() => expect(llamadas('/reservas/negocio/r1/cancelar')).toHaveLength(1));
    expect(apiMock).toHaveBeenCalledWith('/reservas/negocio/r1/cancelar', {
      method: 'PATCH', body: JSON.stringify({ motivo: 'No hay cupo por mantenimiento' }),
    });
    expect(await screen.findByText('Reserva cancelada. El horario quedó libre.')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('Cancelada')).toBeInTheDocument();
    expect(screen.getByText('No hay cupo por mantenimiento')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar reserva' })).not.toBeInTheDocument();
  });

  it('mantiene abierto el modal si el servidor rechaza la cancelación', async () => {
    responderPatch(new ErrorApi(400, 'No se puede cancelar'));
    const usuario = userEvent.setup();
    await listo(reserva({ estado: 'confirmada', segundosRestantes: null }));
    await usuario.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
    await usuario.type(within(screen.getByRole('alertdialog')).getByRole('textbox'), 'Cierre por mantenimiento');
    await usuario.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar reserva' }));
    expect(await within(screen.getByRole('alertdialog')).findByRole('alert')).toHaveTextContent('No se puede cancelar');
    await waitFor(() => expect(llamadas('/reservas/negocio/r1')).toHaveLength(2));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.queryByText('Reserva cancelada. El horario quedó libre.')).not.toBeInTheDocument();
  });

  it('cierra el modal y recarga el detalle ante un conflicto al cancelar', async () => {
    responderPatch(new ErrorApi(409, 'La reserva ya fue cancelada'));
    const usuario = userEvent.setup();
    await listo(reserva({ estado: 'confirmada', segundosRestantes: null }));
    await usuario.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
    await usuario.type(within(screen.getByRole('alertdialog')).getByRole('textbox'), 'Cierre por mantenimiento');
    await usuario.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar reserva' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La reserva ya fue cancelada');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() => expect(llamadas('/reservas/negocio/r1')).toHaveLength(2));
  });

  it('cierra los modales de aceptar y rechazar con Escape sin enviar PATCH', async () => {
    const usuario = userEvent.setup();
    await listo();
    await usuario.click(screen.getByRole('button', { name: 'Aceptar Reserva' }));
    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Rechazar Solicitud' }));
    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(apiMock.mock.calls.filter(([, opciones]) => opciones?.method === 'PATCH')).toHaveLength(0);
  });

  it('cierra el modal de cancelación con Escape sin enviar PATCH', async () => {
    const usuario = userEvent.setup();
    await listo(reserva({ estado: 'confirmada', segundosRestantes: null }));
    await usuario.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(llamadas('/reservas/negocio/r1/cancelar')).toHaveLength(0);
  });

  it('permite volver al listado de reservas', async () => {
    const usuario = userEvent.setup();
    await listo();
    await usuario.click(screen.getByRole('link', { name: 'Volver a reservas' }));
    expect(await screen.findByRole('heading', { name: 'Lista de reservas' })).toBeInTheDocument();
  });
});


describe('criterios de motivo, avisos y diseño', () => {
  it.each([
    ['rechazada', 'Motivo del rechazo'],
    ['rechazada_vencimiento', 'Motivo del rechazo'],
    ['cancelada', 'Motivo de la cancelación'],
  ])('C5 titula el motivo para %s', async (estado, titulo) => {
    await listo(reserva({ estado, motivo: 'Cierre por mantenimiento' }));
    expect(screen.getByRole('heading', { name: titulo })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aceptar Reserva' })).not.toBeInTheDocument();
  });

  const acciones = [
    ['rechazar', 'pendiente', 'Rechazar Solicitud', 'Rechazar solicitud'],
    ['cancelar', 'confirmada', 'Cancelar reserva', 'Cancelar reserva'],
  ];
  it.each(acciones)('C6 valida 19, 20, 500 y 501 caracteres recortados al %s', async (accion, estado, abrir, enviar) => {
    await listo(reserva({ estado }));
    fireEvent.click(screen.getByRole('button', { name: abrir }));
    const modal = screen.getByRole('alertdialog');
    const campo = within(modal).getByRole('textbox');
    expect(within(modal).getByText('De 20 a 500 caracteres')).toBeInTheDocument();
    for (const longitud of [19, 501]) {
      fireEvent.change(campo, { target: { value: `  ${'a'.repeat(longitud)}  ` } });
      fireEvent.click(within(modal).getByRole('button', { name: enviar }));
      expect(within(modal).getByRole('alert')).toHaveTextContent(longitud === 19 ? 'al menos 20' : 'exceder 500');
      expect(llamadas(`/reservas/negocio/r1/${accion}`)).toHaveLength(0);
    }
    fireEvent.change(campo, { target: { value: `  ${'a'.repeat(20)}  ` } });
    expect(within(modal).getByText('20/500')).toBeInTheDocument();
    fireEvent.click(within(modal).getByRole('button', { name: enviar }));
    await waitFor(() => expect(llamadas(`/reservas/negocio/r1/${accion}`)).toHaveLength(1));
    expect(apiMock).toHaveBeenCalledWith(`/reservas/negocio/r1/${accion}`, { method: 'PATCH', body: JSON.stringify({ motivo: 'a'.repeat(20) }) });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it.each(acciones)('C6 permite el límite de 500 caracteres al %s', async (accion, estado, abrir, enviar) => {
    await listo(reserva({ estado }));
    fireEvent.click(screen.getByRole('button', { name: abrir }));
    const modal = screen.getByRole('alertdialog');
    fireEvent.change(within(modal).getByRole('textbox'), { target: { value: `  ${'a'.repeat(500)}  ` } });
    fireEvent.click(within(modal).getByRole('button', { name: enviar }));
    await waitFor(() => expect(llamadas(`/reservas/negocio/r1/${accion}`)).toHaveLength(1));
    expect(apiMock).toHaveBeenCalledWith(`/reservas/negocio/r1/${accion}`, { method: 'PATCH', body: JSON.stringify({ motivo: 'a'.repeat(500) }) });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  const flujos = [
    ['aceptar', 'pendiente', 'Aceptar Reserva', 'Confirmar'],
    ...acciones,
  ];
  for (const resultado of ['éxito', 'error']) {
    it.each(flujos)(`C7 avisa dentro de la página al %s con ${resultado}, sin alert`, async (accion, estado, abrir, enviar) => {
      if (resultado === 'error') responderPatch(new Error('Sin red'));
      await listo(reserva({ estado }));
      fireEvent.click(screen.getByRole('button', { name: abrir }));
      const modal = screen.getByRole('alertdialog');
      const campo = within(modal).queryByRole('textbox');
      if (campo) fireEvent.change(campo, { target: { value: 'Cierre por mantenimiento' } });
      fireEvent.click(within(modal).getByRole('button', { name: enviar }));
      if (resultado === 'error') {
        expect(await within(modal).findByRole('alert')).toHaveTextContent('No pudimos guardar tu respuesta');
      } else {
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(screen.getAllByRole('status').some(nodo => /confirmada|rechazada|cancelada/.test(nodo.textContent ?? ''))).toBe(true);
      }
      expect(llamadas(`/reservas/negocio/r1/${accion}`)).toHaveLength(1);
      expect(alerta).not.toHaveBeenCalled();
    });
  }

  for (const codigo of [400, 409]) {
    it.each(flujos)(`C8 conserva el aviso ${codigo} y recarga al %s`, async (_accion, estado, abrir, enviar) => {
      responderPatch(new ErrorApi(codigo, `Mensaje persistente ${codigo}`));
      await listo(reserva({ estado }));
      fireEvent.click(screen.getByRole('button', { name: abrir }));
      const modal = screen.getByRole('alertdialog');
      const campo = within(modal).queryByRole('textbox');
      if (campo) fireEvent.change(campo, { target: { value: 'Cierre por mantenimiento' } });
      fireEvent.click(within(modal).getByRole('button', { name: enviar }));
      await waitFor(() => expect(llamadas('/reservas/negocio/r1')).toHaveLength(2));
      await screen.findByRole('heading', { name: 'Reserva SRV-123' });
      expect(screen.getAllByRole('alert').some(nodo => nodo.textContent === `Mensaje persistente ${codigo}`)).toBe(true);
      expect(screen.queryByRole('alertdialog') !== null).toBe(codigo === 400);
    });
  }

  it('C9 reutiliza los estados de error del panel y los botones compartidos', async () => {
    responderDetalle(new Error('Sin conexión'));
    mostrar();
    const error = await screen.findByRole('alert');
    expect(error).toHaveClass('panel-estado-texto');
    const estado = error.closest('.panel-estado');
    expect(estado).toHaveClass('panel-estado--error');
    expect(estado?.querySelector('.panel-ilustracion--error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveClass('btn-servia-primary');
    expect(screen.getByRole('link', { name: 'Volver a reservas' })).toHaveClass('btn-servia-secondary');
  });
});
