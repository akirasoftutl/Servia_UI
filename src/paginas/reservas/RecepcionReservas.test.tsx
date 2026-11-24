import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { api } from '../../servicios/api';
import { Reservas } from './Reservas';
import { llamadasAlertas, mockearConfirmacion, swalFireMock, ultimaAlerta } from '../../pruebas/mockAlertas';

vi.mock('../../servicios/api', () => ({ api: vi.fn() }));

const llamada = vi.mocked(api);
const errorCambio = 'No pudimos cambiar la recepción de reservas. Intenta de nuevo.';

function pendiente<T>() {
  let resolver!: (valor: T) => void;
  let rechazar!: (error: Error) => void;
  const promesa = new Promise<T>((resolve, reject) => { resolver = resolve; rechazar = reject; });
  return { promesa, resolver, rechazar };
}

let recepcion = true;
let colaPerfil: unknown[] = [];
let respuestaPatch: unknown | Promise<unknown> | Error | null = null;

function responderPerfil(...respuestas: unknown[]) { colaPerfil = respuestas; }
function responderPatch(respuesta: unknown | Promise<unknown> | Error | null) { respuestaPatch = respuesta; }
function llamadas(ruta: string) { return llamada.mock.calls.filter(([rutaLlamada]) => rutaLlamada === ruta); }

beforeEach(() => {
  llamada.mockReset();
  recepcion = true;
  colaPerfil = [];
  respuestaPatch = null;
  llamada.mockImplementation(async (ruta, opciones) => {
    if (ruta === '/negocios/mio') {
      const respuesta = colaPerfil.length ? colaPerfil.shift() : { aceptaReservas: recepcion };
      if (respuesta instanceof Error) throw respuesta;
      return respuesta;
    }
    if (ruta === '/negocios/mio/recepcion-reservas') {
      if (respuestaPatch instanceof Error) throw respuestaPatch;
      if (respuestaPatch !== null) return respuestaPatch;
      recepcion = JSON.parse(String(opciones?.body)).aceptaReservas;
      return {};
    }
    return { items: [], siguiente: null };
  });
});

function mostrar(estricto = false) {
  const contenido = <MemoryRouter><Reservas /></MemoryRouter>;
  return render(estricto ? <StrictMode>{contenido}</StrictMode> : contenido);
}

async function listo(aceptaReservas = true) {
  recepcion = aceptaReservas;
  const vista = mostrar();
  await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
  return vista;
}

describe('Recepción de reservas (MVP-12)', () => {
  it('bloquea el estado desconocido durante la carga sin anunciar activo ni pausado', async () => {
    const carga = pendiente<{ aceptaReservas: boolean }>();
    responderPerfil(carga.promesa);
    mostrar();
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getByText('Cargando recepción de reservas...')).toBeVisible();
    expect(screen.queryByText(/Tus clientes pueden|Pausaste las reservas/)).not.toBeInTheDocument();
    await act(async () => carga.resolver({ aceptaReservas: false }));
    expect(screen.getByRole('switch')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Reanudar' })).toBeVisible();
  });

  it('muestra el error inicial y permite reintentar sin inventar un estado', async () => {
    responderPerfil(new Error('Sin conexión'));
    mostrar();
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar');
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Reanudar' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
    expect(screen.getByRole('switch')).toBeChecked();
    expect(llamadas('/negocios/mio')).toHaveLength(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('mantiene desconocido un perfil sin el booleano de recepción', async () => {
    responderPerfil({});
    mostrar();
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar');
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('usa el nombre estable Recibir reservas en ambos estados', async () => {
    await listo(false);
    expect(screen.getByRole('switch', { name: 'Recibir reservas' })).not.toBeChecked();
    mockearConfirmacion(true);
    await userEvent.click(screen.getByRole('switch', { name: 'Recibir reservas' }));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Recibir reservas' })).toBeChecked());
  });

  it('C1 pausa con PATCH false solo después de confirmar y anuncia el resultado con alerta de éxito', async () => {
    await listo(true);
    mockearConfirmacion(true);
    await userEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(screen.getByRole('switch')).not.toBeChecked());
    expect(llamada).toHaveBeenLastCalledWith('/negocios/mio/recepcion-reservas', {
      method: 'PATCH', body: JSON.stringify({ aceptaReservas: false }),
    });
    expect(ultimaAlerta()).toMatchObject({ icon: 'success', text: 'Reservas pausadas.' });
  });

  it('C2/C4 explica la visibilidad, bloqueo y que las reservas existentes no cambian en la confirmación sin redundancia', async () => {
    await listo(true);
    mockearConfirmacion(false);
    await userEvent.click(screen.getByRole('switch'));
    const alerta = ultimaAlerta();
    expect(alerta?.title).toBe('¿Pausar las reservas?');
    expect(alerta?.text).toBe(
      'Tu perfil seguirá visible. Los clientes verán «No acepta reservas por ahora» y no podrán pedir reservas nuevas. Nota: Las reservas que ya tienes no cambiarán.',
    );
    expect(String(alerta?.text)).not.toContain('no podrán solicitar nuevas reservas');
    expect(llamadas('/negocios/mio/recepcion-reservas')).toHaveLength(0);
  });

  it('cancelar conserva el estado activo y no envía PATCH', async () => {
    await listo(true);
    mockearConfirmacion(false);
    await userEvent.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch')).toBeChecked();
    expect(llamadas('/negocios/mio/recepcion-reservas')).toHaveLength(0);
  });

  it('configura la confirmación de pausa con foco inicial en Cancelar, Esc, retorno de foco y sin cierre externo', async () => {
    await listo(true);
    mockearConfirmacion(false, 'esc');
    await userEvent.click(screen.getByRole('switch'));
    expect(ultimaAlerta()).toMatchObject({
      icon: 'warning',
      title: '¿Pausar las reservas?',
      confirmButtonText: 'Pausar',
      cancelButtonText: 'Cancelar',
      showCancelButton: true,
      focusCancel: true,
      allowEscapeKey: true,
      returnFocus: true,
      allowOutsideClick: false,
      customClass: expect.objectContaining({
        popup: 'servia-swal-popup servia-swal-popup--peligro',
      }),
    });
    expect(screen.getByRole('switch')).toBeChecked();
    expect(llamadas('/negocios/mio/recepcion-reservas')).toHaveLength(0);
  });

  it('pide confirmación con textos correctos al reanudar y cancelar no llama a la API', async () => {
    await listo(false);
    mockearConfirmacion(false);
    await userEvent.click(screen.getByRole('button', { name: 'Reanudar' }));
    expect(ultimaAlerta()).toMatchObject({
      icon: 'question',
      title: '¿Reanudar las reservas?',
      text: 'Tu perfil seguirá visible y los clientes podrán solicitar nuevas reservas. Nota: Las reservas que ya tienes no cambiarán.',
      confirmButtonText: 'Reanudar',
      cancelButtonText: 'Cancelar',
      showCancelButton: true,
      focusCancel: false,
      allowEscapeKey: true,
      returnFocus: true,
      allowOutsideClick: false,
    });
    expect(screen.getByRole('switch')).not.toBeChecked();
    expect(llamadas('/negocios/mio/recepcion-reservas')).toHaveLength(0);
  });

  it('el error al pausar conserva el estado activo, muestra alerta de error y permite reintentar', async () => {
    await listo(true);
    responderPatch(new Error('Sin conexión'));
    mockearConfirmacion(true);
    await userEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(ultimaAlerta()).toMatchObject({ icon: 'error', text: errorCambio }));
    expect(screen.getByRole('switch')).toBeChecked();

    responderPatch(null);
    mockearConfirmacion(true);
    await userEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(screen.getByRole('switch')).not.toBeChecked());
    expect(ultimaAlerta()).toMatchObject({ icon: 'success', text: 'Reservas pausadas.' });
  });

  it('evita abrir una segunda confirmación mientras la primera sigue abierta', async () => {
    await listo(true);
    const dialogo = pendiente<{ isConfirmed: boolean; isDenied: boolean; isDismissed: boolean }>();
    swalFireMock.mockReturnValueOnce(dialogo.promesa);
    const interruptor = screen.getByRole('switch');
    await userEvent.click(interruptor);
    await userEvent.click(interruptor);
    expect(swalFireMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      dialogo.resolver({ isConfirmed: false, isDenied: false, isDismissed: true });
    });
    expect(interruptor).toBeChecked();
    expect(llamadas('/negocios/mio/recepcion-reservas')).toHaveLength(0);
  });

  it('C3 recupera la pausa al recargar y permite reanudar desde el aviso con PATCH true', async () => {
    const vista = mostrar();
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
    mockearConfirmacion(true);
    await userEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(screen.getByRole('switch')).not.toBeChecked());
    vista.unmount();
    mostrar();
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
    expect(screen.getByRole('switch')).not.toBeChecked();
    expect(screen.getByText(/Pausaste las reservas/)).toBeVisible();
    mockearConfirmacion(true);
    await userEvent.click(screen.getByRole('button', { name: 'Reanudar' }));
    await waitFor(() => expect(screen.getByRole('switch')).toBeChecked());
    expect(llamada).toHaveBeenLastCalledWith('/negocios/mio/recepcion-reservas', {
      method: 'PATCH', body: JSON.stringify({ aceptaReservas: true }),
    });
    expect(ultimaAlerta()).toMatchObject({ icon: 'success', text: 'Reservas reanudadas.' });
    expect(screen.queryByText(/Pausaste las reservas/)).not.toBeInTheDocument();
  });

  it('el error al reanudar conserva la pausa, muestra alerta de error y permite repetir', async () => {
    await listo(false);
    responderPatch(new Error('Sin conexión'));
    mockearConfirmacion(true);
    await userEvent.click(screen.getByRole('button', { name: 'Reanudar' }));
    await waitFor(() => expect(ultimaAlerta()).toMatchObject({ icon: 'error', text: errorCambio }));
    expect(screen.getByRole('switch')).not.toBeChecked();
    responderPatch(null);
    mockearConfirmacion(true);
    await userEvent.click(screen.getByRole('button', { name: 'Reanudar' }));
    await waitFor(() => expect(screen.getByRole('switch')).toBeChecked());
    expect(ultimaAlerta()).toMatchObject({ icon: 'success', text: 'Reservas reanudadas.' });
  });

  it('bloquea acciones duplicadas durante PATCH', async () => {
    await listo(true);
    const cambio = pendiente<object>();
    responderPatch(cambio.promesa);
    mockearConfirmacion(true);
    await userEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(screen.getByRole('switch')).toBeDisabled());
    expect(screen.getByRole('switch')).toHaveTextContent('Pausando...');
    expect(llamadas('/negocios/mio/recepcion-reservas')).toHaveLength(1);
    await act(async () => cambio.resolver({}));
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
    expect(llamadasAlertas().at(-1)).toMatchObject({ icon: 'success', text: 'Reservas pausadas.' });
  });

  it.each(['éxito', 'error'])('descarta un GET antiguo (%s) que llega después de PATCH', async (resultado) => {
    const antiguo = pendiente<{ aceptaReservas: boolean }>();
    responderPerfil(antiguo.promesa);
    mostrar(true);
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
    mockearConfirmacion(true);
    await userEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(screen.getByRole('switch')).not.toBeChecked());
    await act(async () => {
      if (resultado === 'éxito') antiguo.resolver({ aceptaReservas: true });
      else antiguo.rechazar(new Error('Respuesta tardía'));
    });
    expect(screen.getByRole('switch')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Reanudar' })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
