import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { api } from '../../servicios/api';
import { Reservas } from '../reservas/Reservas';
import { Resumen } from './Resumen';

// El navegador en UTC: la hora de las citas debe seguir saliendo en hora de México.
const zonaOriginal = vi.hoisted(() => {
  const zona = process.env.TZ;
  process.env.TZ = 'UTC';
  return zona;
});
afterAll(() => {
  if (zonaOriginal === undefined) delete process.env.TZ;
  else process.env.TZ = zonaOriginal;
});

vi.mock('../../servicios/api', () => ({ api: vi.fn() }));
const apiMock = vi.mocked(api);

function cita(numero: number, extra = {}) {
  return { id: `r${numero}`, folio: `SRV-${numero}`, clienteNombre: `Cliente ${numero}`,
    servicioNombre: `Servicio ${numero}`, inicio: '2030-11-04T02:00:00Z', fin: '2030-11-04T03:00:00Z', ...extra };
}

// Contrato de GET /negocios/mio/resumen (Servia_BE#89). Valores distintos para notar números cruzados.
function resumen(extra = {}) {
  return { pendientes: 3, hoy: 5, proximos7Dias: 8, serviciosPublicados: 4, clientesAtendidos: 12,
    proximas: [1, 2, 3, 4, 5].map((n) => cita(n)), generadoEn: '2030-11-03T14:00:00Z', ...extra };
}

let respuestaResumen: unknown;
let respuestaPerfil: unknown;

beforeEach(() => {
  apiMock.mockReset();
  respuestaResumen = resumen();
  respuestaPerfil = { aceptaReservas: true, visible: true };
  apiMock.mockImplementation(async (ruta) => {
    const respuesta = ruta === '/negocios/mio/resumen' ? respuestaResumen
      : ruta === '/negocios/mio' ? respuestaPerfil
      : String(ruta).startsWith('/reservas/negocio') ? { items: [], siguiente: null }
      : new Error(`Ruta inesperada: ${ruta}`);
    if (respuesta instanceof Error) throw respuesta;
    return respuesta;
  });
});

function mostrar() {
  const router = createMemoryRouter([
    { path: '/resumen', element: <Resumen /> },
    { path: '/reservas', element: <Reservas /> },
    { path: '/reservas/:id', element: <h1>Detalle de la reserva</h1> },
    { path: '/servicios', element: <h1>Mis servicios</h1> },
    { path: '/mi-perfil', element: <h1>Mi perfil</h1> },
  ], { initialEntries: ['/resumen'] });
  render(<RouterProvider router={router} />);
  return router;
}

// Número que muestra la tarjeta con esa etiqueta
function numeroDe(etiqueta: string) {
  const tarjeta = screen.getByText(etiqueta).closest('li')!;
  return tarjeta.querySelector('.resumen-numero')!.textContent;
}

describe('Resumen', () => {
  it('C1 y C2 muestra los cinco números tal como los devuelve la API', async () => {
    mostrar();
    expect(await screen.findByText('Solicitudes pendientes')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Resumen', level: 1 })).toBeVisible();
    expect(apiMock).toHaveBeenCalledWith('/negocios/mio/resumen');
    expect(numeroDe('Solicitudes pendientes')).toBe('3');
    expect(numeroDe('Reservas de hoy')).toBe('5');
    expect(numeroDe('Próximos 7 días')).toBe('8');
    expect(numeroDe('Servicios publicados')).toBe('4');
    expect(numeroDe('Clientes atendidos')).toBe('12');
  });

  it('C3 «Solicitudes pendientes» abre Reservas filtrada por Pendiente', async () => {
    const router = mostrar();
    const enlace = await screen.findByRole('link', { name: /Solicitudes pendientes/ });
    expect(enlace).toHaveAttribute('href', '/reservas?estado=pendiente');
    expect(screen.getByRole('link', { name: /Servicios publicados/ })).toHaveAttribute('href', '/servicios');
    fireEvent.click(enlace);
    await waitFor(() => expect(router.state.location.pathname).toBe('/reservas'));
    expect(router.state.location.search).toBe('?estado=pendiente');
    await waitFor(() => expect(apiMock.mock.calls.some(([ruta]) => String(ruta).startsWith('/reservas/negocio'))).toBe(true));
    const llamada = apiMock.mock.calls.find(([ruta]) => String(ruta).startsWith('/reservas/negocio'))!;
    expect(new URL(String(llamada[0]), 'http://api.local').searchParams.get('estado')).toBe('pendiente');
    expect(screen.getByLabelText('Estado')).toHaveValue('pendiente');
  });

  it('C4 lista las 5 próximas citas con hora de México y cada una abre su detalle', async () => {
    const router = mostrar();
    const lista = await screen.findByRole('region', { name: 'Próximas citas' });
    const enlaces = within(lista).getAllByRole('link');
    expect(enlaces).toHaveLength(5);
    enlaces.forEach((enlace, i) => {
      expect(enlace).toHaveTextContent(`Cliente ${i + 1}`);
      expect(enlace).toHaveTextContent(`Servicio ${i + 1} · 03/11/30 de 20:00 a 21:00`);
      expect(enlace).toHaveAttribute('href', `/reservas/r${i + 1}`);
    });
    fireEvent.click(enlaces[2]);
    await waitFor(() => expect(router.state.location.pathname).toBe('/reservas/r3'));
    expect(await screen.findByRole('heading', { name: 'Detalle de la reserva' })).toBeVisible();
  });

  it('C5 muestra cargando y después los datos', async () => {
    mostrar();
    expect(screen.getByRole('status')).toHaveTextContent('Cargando resumen...');
    expect(await screen.findByText('Solicitudes pendientes')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('C5 muestra el error con «Reintentar», sin alert(), y al reintentar vuelve a pedir', async () => {
    const alerta = vi.spyOn(window, 'alert').mockImplementation(() => {});
    respuestaResumen = new Error('Sin conexión');
    mostrar();
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar el resumen. Intenta de nuevo.');
    expect(screen.queryByText('Solicitudes pendientes')).not.toBeInTheDocument();
    const pedidas = () => apiMock.mock.calls.filter(([ruta]) => ruta === '/negocios/mio/resumen').length;
    expect(pedidas()).toBe(1);
    respuestaResumen = resumen();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Solicitudes pendientes')).toBeInTheDocument();
    expect(pedidas()).toBe(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(alerta).not.toHaveBeenCalled();
  });

  it.each([
    { caso: 'arreglo vacío', respuesta: [] },
    { caso: 'objeto vacío', respuesta: {} },
    { caso: 'pendientes sin próximas citas', respuesta: { pendientes: 3 } },
  ])('C5 respuesta mal formada: $caso muestra error y permite reintentar', async ({ respuesta }) => {
    respuestaResumen = respuesta;
    const router = mostrar();

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('No pudimos cargar el resumen. Intenta de nuevo.');
    expect(error).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Resumen', level: 1 })).toBeVisible();
    expect(router.state.errors).toBeNull();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Números de tu negocio' })).not.toBeInTheDocument();
    const reintentar = screen.getByRole('button', { name: 'Reintentar' });
    expect(reintentar).toBeVisible();
    expect(reintentar).toBeEnabled();
    const pedidas = () => apiMock.mock.calls.filter(([ruta]) => ruta === '/negocios/mio/resumen').length;
    expect(pedidas()).toBe(1);

    respuestaResumen = resumen();
    fireEvent.click(reintentar);

    expect(await screen.findByRole('list', { name: 'Números de tu negocio' })).toBeVisible();
    expect(pedidas()).toBe(2);
    expect(numeroDe('Solicitudes pendientes')).toBe('3');
    expect(numeroDe('Reservas de hoy')).toBe('5');
    expect(numeroDe('Próximos 7 días')).toBe('8');
    expect(numeroDe('Servicios publicados')).toBe('4');
    expect(numeroDe('Clientes atendidos')).toBe('12');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    expect(router.state.errors).toBeNull();
  });

  it('C5 sin reservas muestra ceros y «Todavía no tienes reservas.»', async () => {
    respuestaResumen = resumen({ pendientes: 0, hoy: 0, proximos7Dias: 0, serviciosPublicados: 0, clientesAtendidos: 0, proximas: [] });
    mostrar();
    expect(await screen.findByText('Todavía no tienes reservas.')).toBeVisible();
    for (const etiqueta of ['Solicitudes pendientes', 'Reservas de hoy', 'Próximos 7 días', 'Servicios publicados', 'Clientes atendidos']) {
      expect(numeroDe(etiqueta)).toBe('0');
    }
    const vacio = within(screen.getByRole('region', { name: 'Próximas citas' }));
    expect(vacio.getByRole('heading', { name: 'Tu agenda está libre' })).toBeVisible();
    expect(vacio.getByText('Todavía no tienes reservas.').closest('.panel-estado')!.querySelector('.panel-ilustracion')).toBeInTheDocument();
    expect(vacio.getByRole('link', { name: 'Crear servicio' })).toHaveAttribute('href', '/servicios/nuevo');
  });

  it('C5 con servicios publicados el estado vacío no ofrece crear otro', async () => {
    respuestaResumen = resumen({ proximas: [] });
    mostrar();
    expect(await screen.findByText('No tienes reservas próximas.')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Crear servicio' })).not.toBeInTheDocument();
  });

  it('C5 con reservas pero sin próximas citas no dice que no hay reservas', async () => {
    respuestaResumen = resumen({ proximas: [], proximos7Dias: 0 });
    mostrar();
    expect(await screen.findByText('No tienes reservas próximas.')).toBeVisible();
    expect(screen.queryByText('Todavía no tienes reservas.')).not.toBeInTheDocument();
  });

  it('C6 avisa si pausó las reservas, con enlace a Reservas para reanudar', async () => {
    respuestaPerfil = { aceptaReservas: false, visible: true };
    mostrar();
    expect(await screen.findByText('Pausaste las reservas')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Reanudar en Reservas' })).toHaveAttribute('href', '/reservas');
    expect(screen.queryByText('Tu negocio no aparece en las búsquedas.')).not.toBeInTheDocument();
  });

  it('C6 avisa si el negocio no es visible, con enlaces a perfil y servicios', async () => {
    respuestaPerfil = { aceptaReservas: true, visible: false };
    mostrar();
    const aviso = (await screen.findByText('Tu negocio no aparece en las búsquedas.')).closest('.panel-alerta') as HTMLElement;
    expect(within(aviso).getByText('Revisa tu perfil y tus servicios.')).toBeVisible();
    expect(within(aviso).getByRole('link', { name: 'Mi perfil' })).toHaveAttribute('href', '/mi-perfil');
    expect(within(aviso).getByRole('link', { name: 'Servicios' })).toHaveAttribute('href', '/servicios');
    expect(screen.queryByText('Pausaste las reservas')).not.toBeInTheDocument();
  });

  it('C6 no muestra avisos cuando el negocio recibe reservas y es visible', async () => {
    mostrar();
    await screen.findByText('Solicitudes pendientes');
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/negocios/mio'));
    await act(async () => {});
    expect(screen.queryByText('Pausaste las reservas')).not.toBeInTheDocument();
    expect(screen.queryByText('Tu negocio no aparece en las búsquedas.')).not.toBeInTheDocument();
  });

  it('C6 si falla GET /negocios/mio, los números se muestran igual y sin aviso', async () => {
    respuestaPerfil = new Error('Sin conexión');
    mostrar();
    expect(await screen.findByText('Solicitudes pendientes')).toBeInTheDocument();
    expect(numeroDe('Clientes atendidos')).toBe('12');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Pausaste las reservas')).not.toBeInTheDocument();
  });
});
