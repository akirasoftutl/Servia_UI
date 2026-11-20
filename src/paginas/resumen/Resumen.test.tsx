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
    { path: '/servicios/nuevo', element: <h1>Nuevo servicio</h1> },
    { path: '/horario', element: <h1>Horario</h1> },
    { path: '/bloqueos', element: <h1>Bloqueos</h1> },
    { path: '/estadisticas', element: <h1>Estadísticas</h1> },
    { path: '/clientes', element: <h1>Clientes</h1> },
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

  it('C3 «Atender solicitudes» abre Reservas filtrada por Pendiente', async () => {
    const router = mostrar();
    const enlace = await screen.findByRole('link', { name: 'Atender solicitudes' });
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
      expect(enlace).toHaveTextContent(`Servicio ${i + 1} · 20:00 a 21:00 · SRV-${i + 1}`);
      expect(enlace).toHaveAttribute('href', `/reservas/r${i + 1}`);
    });
    fireEvent.click(enlaces[2]);
    await waitFor(() => expect(router.state.location.pathname).toBe('/reservas/r3'));
    expect(await screen.findByRole('heading', { name: 'Detalle de la reserva' })).toBeVisible();
  });

  it('D27 la tarjeta destacada es solo «Solicitudes pendientes» y las otras cuatro cifras van en la rejilla', async () => {
    mostrar();
    await screen.findByText('Solicitudes pendientes');
    const lista = screen.getByRole('list', { name: 'Números de tu negocio' });
    const tarjetas = within(lista).getAllByRole('listitem');
    expect(tarjetas).toHaveLength(5);
    expect(tarjetas[0]).toHaveClass('resumen-hero');
    expect(tarjetas[0]).toHaveTextContent('Solicitudes pendientes');
    expect(tarjetas[0]).toHaveTextContent('Requiere atención');
    expect(tarjetas.slice(1).filter((t) => t.classList.contains('resumen-hero'))).toHaveLength(0);
    expect(tarjetas.slice(1).map((t) => t.querySelector('.resumen-kpi-etiqueta')?.textContent))
      .toEqual(['Reservas de hoy', 'Próximos 7 días', 'Clientes atendidos', 'Servicios publicados']);
  });

  it('D27 sin solicitudes pendientes la tarjeta destacada no pide atención', async () => {
    respuestaResumen = resumen({ pendientes: 0 });
    mostrar();
    await screen.findByText('Solicitudes pendientes');
    expect(screen.queryByText('Requiere atención')).not.toBeInTheDocument();
    expect(numeroDe('Solicitudes pendientes')).toBe('0');
    expect(screen.queryByRole('link', { name: 'Atender solicitudes' })).not.toBeInTheDocument();
    const ver = screen.getByRole('link', { name: 'Ver reservas' });
    expect(ver).toHaveAttribute('href', '/reservas');
    expect(ver).toHaveClass('btn-servia-secondary');
  });

  it('D27 los cuatro accesos rápidos llevan a las rutas reales del panel', async () => {
    const router = mostrar();
    const accesos = within(await screen.findByRole('navigation', { name: 'Accesos rápidos' }));
    const esperados: [string, string][] = [['Nuevo servicio', '/servicios/nuevo'], ['Ajustar horario', '/horario'],
      ['Bloquear fecha', '/bloqueos'], ['Ver estadísticas', '/estadisticas']];
    expect(accesos.getAllByRole('link')).toHaveLength(4);
    for (const [nombre, ruta] of esperados) expect(accesos.getByRole('link', { name: new RegExp(nombre) })).toHaveAttribute('href', ruta);
    fireEvent.click(accesos.getByRole('link', { name: /Bloquear fecha/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/bloqueos'));
  });

  it('D28 solo las citas con estado «pendiente» llevan chip; confirmada y sin estado no', async () => {
    respuestaResumen = resumen({ proximas: [cita(1, { estado: 'confirmada' }), cita(2, { estado: 'pendiente' }), cita(3)] });
    mostrar();
    const lista = within(await screen.findByRole('region', { name: 'Próximas citas' }));
    const [primera, segunda, tercera] = lista.getAllByRole('link');
    expect(primera.querySelector('.reserva-badge')).toBeNull();
    expect(within(segunda).getByText('Pendiente')).toHaveClass('reserva-badge', 'pendiente');
    expect(tercera.querySelector('.reserva-badge')).toBeNull();
    expect(screen.queryByText('Confirmada')).not.toBeInTheDocument();
    expect(tercera).toHaveTextContent('Cliente 3');
  });

  it('D28 sin «estado» en ninguna cita no hay chips y la hora, el folio y el enlace siguen', async () => {
    mostrar();
    const lista = within(await screen.findByRole('region', { name: 'Próximas citas' }));
    expect(document.querySelector('.reserva-badge')).toBeNull();
    const enlaces = lista.getAllByRole('link');
    expect(enlaces[0].querySelector('.resumen-cita-hora-inicio')).toHaveTextContent('20:00');
    expect(enlaces[0]).toHaveTextContent('SRV-1');
  });

  it('D28 la hora destacada dice Hoy, Mañana o el día, contado en México desde generadoEn', async () => {
    respuestaResumen = resumen({ generadoEn: '2030-11-03T14:00:00Z', proximas: [
      cita(1), cita(2, { inicio: '2030-11-04T16:00:00Z', fin: '2030-11-04T17:00:00Z' }),
      cita(3, { inicio: '2030-11-06T16:00:00Z', fin: '2030-11-06T17:00:00Z' })] });
    mostrar();
    const lista = within(await screen.findByRole('region', { name: 'Próximas citas' }));
    const dias = lista.getAllByRole('link').map((e) => e.querySelector('.resumen-cita-hora-dia')!.textContent);
    expect(dias).toEqual(['Hoy · 03 nov', 'Mañana · 04 nov', 'mié · 06 nov']);
    expect(lista.getAllByRole('link')[0].querySelector('.resumen-cita-hora')).not.toHaveClass('resumen-cita-hora--otro-dia');
    expect(lista.getAllByRole('link')[1].querySelector('.resumen-cita-hora')).toHaveClass('resumen-cita-hora--otro-dia');
    expect(screen.getByText('3 citas')).toHaveClass('panel-contador');
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
