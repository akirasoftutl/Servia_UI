import { StrictMode } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { Layout } from './Layout';
import { api } from '../../servicios/api';

const sesion = vi.hoisted(() => ({ usuario: { uid: 'negocio' }, cargando: false }));
vi.mock('../../contextos/AuthContext', () => ({ useAuth: () => sesion }));
vi.mock('../../servicios/api', () => ({ api: vi.fn() }));
vi.mock('../sidebar/Sidebar', () => ({ Sidebar: () => <button>Menú del panel</button> }));
vi.mock('../navbar/Navbar', () => ({ default: () => null }));
vi.mock('../footer/Footer', () => ({ default: () => null }));

const llamada = vi.mocked(api);
const errorCambio = 'No pudimos cambiar la recepción de reservas. Intenta de nuevo.';
function pendiente<T>() {
  let resolver!: (valor: T) => void;
  let rechazar!: (error: Error) => void;
  const promesa = new Promise<T>((resolve, reject) => { resolver = resolve; rechazar = reject; });
  return { promesa, resolver, rechazar };
}
function mostrar(estricto = false) {
  const contenido = <MemoryRouter><Layout /></MemoryRouter>;
  return render(estricto ? <StrictMode>{contenido}</StrictMode> : contenido);
}
async function listo(aceptaReservas = true) {
  llamada.mockResolvedValueOnce({ aceptaReservas });
  const vista = mostrar();
  await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
  return vista;
}
async function abrir() {
  const usuario = userEvent.setup();
  await listo();
  await usuario.click(screen.getByRole('switch'));
  return usuario;
}
beforeEach(() => { llamada.mockReset(); });

describe('Recepción de reservas (MVP-12)', () => {
  it('bloquea el estado desconocido durante la carga sin anunciar activo ni pausado', async () => {
    const carga = pendiente<{ aceptaReservas: boolean }>();
    llamada.mockReturnValueOnce(carga.promesa);
    mostrar();
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getByText('Cargando recepción de reservas...')).toBeVisible();
    expect(screen.queryByText(/Tus clientes pueden|Pausaste las reservas/)).not.toBeInTheDocument();
    await act(async () => carga.resolver({ aceptaReservas: false }));
    expect(screen.getByRole('switch')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Reanudar' })).toBeVisible();
  });

  it('muestra el error inicial y permite reintentar sin inventar un estado', async () => {
    llamada.mockRejectedValueOnce(new Error('Sin conexión'));
    mostrar();
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar');
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Reanudar' })).not.toBeInTheDocument();
    llamada.mockResolvedValueOnce({ aceptaReservas: true });
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
    expect(screen.getByRole('switch')).toBeChecked();
    expect(llamada).toHaveBeenNthCalledWith(2, '/negocios/mio');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('mantiene desconocido un perfil sin el booleano de recepción', async () => {
    llamada.mockResolvedValueOnce({});
    mostrar();
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar');
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('usa el nombre estable Recibir reservas en ambos estados', async () => {
    await listo(false);
    expect(screen.getByRole('switch', { name: 'Recibir reservas' })).not.toBeChecked();
    llamada.mockResolvedValueOnce({});
    await userEvent.click(screen.getByRole('switch', { name: 'Recibir reservas' }));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Recibir reservas' })).toBeChecked());
  });

  it('C1 pausa con PATCH false solo después de confirmar y anuncia el resultado', async () => {
    const usuario = await abrir();
    expect(llamada).toHaveBeenCalledTimes(1);
    llamada.mockResolvedValueOnce({});
    await usuario.click(screen.getByRole('button', { name: /^Pausar( reservas)?$/ }));
    await waitFor(() => expect(screen.getByRole('switch')).not.toBeChecked());
    expect(llamada).toHaveBeenLastCalledWith('/negocios/mio/recepcion-reservas', {
      method: 'PATCH', body: JSON.stringify({ aceptaReservas: false }),
    });
    expect(screen.getByText('Reservas pausadas.')).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('C2 explica la visibilidad y el bloqueo de reservas nuevas antes de pausar', async () => {
    await abrir();
    expect(screen.getByText(/Tu perfil seguirá visible/)).toHaveTextContent('«No acepta reservas por ahora» y no podrán pedir reservas nuevas.');
    expect(llamada).toHaveBeenCalledTimes(1);
  });

  it('C4 aclara que las reservas existentes no cambian', async () => {
    await abrir();
    expect(screen.getByText(/Las reservas que ya tienes no cambiarán/)).toBeVisible();
  });

  it('cancelar conserva el estado activo y no envía PATCH', async () => {
    const usuario = await abrir();
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByText('¿Pausar las reservas?')).not.toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeChecked();
    expect(llamada).toHaveBeenCalledTimes(1);
  });

  it('C3 recupera la pausa al recargar y permite reanudar desde el aviso con PATCH true', async () => {
    let recepcion = true;
    llamada.mockImplementation(async (_ruta, opciones) => {
      if (opciones?.method === 'PATCH') {
        recepcion = JSON.parse(String(opciones.body)).aceptaReservas;
      }
      return { aceptaReservas: recepcion };
    });
    const vista = mostrar();
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
    await userEvent.click(screen.getByRole('switch'));
    await userEvent.click(screen.getByRole('button', { name: 'Pausar' }));
    await screen.findByText('Reservas pausadas.');
    vista.unmount();
    mostrar();
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
    expect(screen.getByRole('switch')).not.toBeChecked();
    expect(screen.getByText(/Pausaste las reservas:/)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Reanudar' }));
    await waitFor(() => expect(screen.getByRole('switch')).toBeChecked());
    expect(llamada).toHaveBeenLastCalledWith('/negocios/mio/recepcion-reservas', {
      method: 'PATCH', body: JSON.stringify({ aceptaReservas: true }),
    });
    expect(screen.getByText('Reservas reanudadas.')).toBeVisible();
    expect(screen.queryByText(/Pausaste las reservas:/)).not.toBeInTheDocument();
  });

  it('el error al reanudar conserva la pausa y permite repetir', async () => {
    await listo(false);
    llamada.mockRejectedValueOnce(new Error('Sin conexión'));
    await userEvent.click(screen.getByRole('button', { name: 'Reanudar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(errorCambio);
    expect(screen.getByRole('switch')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Reanudar' })).toBeEnabled();
    llamada.mockResolvedValueOnce({});
    await userEvent.click(screen.getByRole('button', { name: 'Reanudar' }));
    await waitFor(() => expect(screen.getByRole('switch')).toBeChecked());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('el error de pausa se anuncia dentro del diálogo y permite reintentar', async () => {
    const usuario = await abrir();
    llamada.mockRejectedValueOnce(new Error('Sin conexión'));
    await usuario.click(screen.getByRole('button', { name: /^Pausar( reservas)?$/ }));
    const modal = screen.getByRole('dialog', { name: '¿Pausar las reservas?' });
    expect(await within(modal).findByRole('alert')).toHaveTextContent(errorCambio);
    expect(screen.getByRole('switch', { hidden: true })).toBeChecked();
    llamada.mockResolvedValueOnce({});
    await usuario.click(within(modal).getByRole('button', { name: 'Pausar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('el diálogo tiene nombre, descripción, foco inicial, fondo inerte y restaura foco con Escape', async () => {
    const usuario = await abrir();
    const modal = screen.getByRole('dialog', { name: '¿Pausar las reservas?' });
    expect(modal).toHaveAttribute('aria-modal', 'true');
    expect(modal).toHaveAccessibleDescription(/Tu perfil seguirá visible.*Las reservas que ya tienes no cambiarán/);
    expect(within(modal).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    expect(screen.getByRole('switch', { hidden: true }).closest('[inert]')).not.toBeNull();
    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveFocus();
    expect(llamada).toHaveBeenCalledTimes(1);
  });

  it('confina Tab y Shift+Tab al diálogo', async () => {
    const usuario = await abrir();
    const cancelar = screen.getByRole('button', { name: 'Cancelar' });
    const pausar = screen.getByRole('button', { name: /^Pausar( reservas)?$/ });
    await usuario.tab({ shift: true });
    expect(pausar).toHaveFocus();
    await usuario.tab();
    expect(cancelar).toHaveFocus();
    await usuario.tab();
    expect(pausar).toHaveFocus();
  });

  it('bloquea acciones duplicadas y mantiene el foco en el diálogo durante PATCH', async () => {
    const usuario = await abrir();
    const cambio = pendiente<object>();
    llamada.mockReturnValueOnce(cambio.promesa);
    await usuario.click(screen.getByRole('button', { name: /^Pausar( reservas)?$/ }));
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pausando...' })).toBeDisabled();
    await usuario.keyboard('{Escape}{Tab}');
    expect(screen.getByRole('dialog')).toHaveFocus();
    expect(llamada).toHaveBeenCalledTimes(2);
    await act(async () => cambio.resolver({}));
    expect(screen.getByRole('switch')).toHaveFocus();
  });

  it.each(['éxito', 'error'])('descarta un GET antiguo (%s) que llega después de PATCH', async (resultado) => {
    const antiguo = pendiente<{ aceptaReservas: boolean }>();
    llamada.mockReturnValueOnce(antiguo.promesa).mockResolvedValueOnce({ aceptaReservas: true });
    mostrar(true); // StrictMode deja un GET anterior pendiente tras limpiar el primer efecto.
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
    await userEvent.click(screen.getByRole('switch'));
    llamada.mockResolvedValueOnce({});
    await userEvent.click(screen.getByRole('button', { name: /^Pausar( reservas)?$/ }));
    await screen.findByText('Reservas pausadas.');
    await act(async () => {
      if (resultado === 'éxito') antiguo.resolver({ aceptaReservas: true });
      else antiguo.rechazar(new Error('Respuesta tardía'));
    });
    expect(screen.getByRole('switch')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Reanudar' })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
