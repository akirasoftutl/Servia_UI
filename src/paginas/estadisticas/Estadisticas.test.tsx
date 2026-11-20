import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { api, ErrorApi } from '../../servicios/api';
import { MENSAJE_ERROR_SERVIDOR } from '../../servicios/mensajeDeError';
import { Estadisticas } from './Estadisticas';
import { periodoPredefinido, validarPeriodo } from './fechas';

vi.mock('../../servicios/api', () => ({ api: vi.fn(), ErrorApi: class extends Error {
  estado: number;
  constructor(estado: number, mensaje: string) { super(mensaje); this.estado = estado; }
} }));
const apiMock = vi.mocked(api);

// Contrato Servia_BE#91, cifras distintas para detectar cruces entre tarjetas.
function estadisticas() {
  return {
    periodo: { desde: '2026-11-17', hasta: '2026-11-19' }, totalReservas: 37,
    porEstado: { pendiente: 2, confirmada: 11, rechazada: 3, rechazadaVencimiento: 4, cancelada: 10, completada: 7 },
    cancelaciones: { porCliente: 6, porNegocio: 4 }, clientesAtendidos: 5,
    serviciosMasReservados: [{ servicioId: 'corte', nombre: 'Corte de cabello', reservas: 13 },
      { servicioId: 'barba', nombre: 'Arreglo de barba', reservas: 8 }],
    porDia: [{ fecha: '2026-11-17', reservas: 9 }, { fecha: '2026-11-18', reservas: 12 }, { fecha: '2026-11-19', reservas: 16 }],
  };
}
function numero(etiqueta: string) {
  return screen.getByText(etiqueta).closest('.panel-item')!.querySelector('dd');
}
function cambiar(valor: string) { fireEvent.change(screen.getByLabelText('Periodo de consulta'), { target: { value: valor } }); }
beforeEach(() => { apiMock.mockReset().mockResolvedValue(estadisticas()); });

describe('Estadísticas', () => {
  it('C1 muestra los conteos, top y días recibidos de la API', async () => {
    render(<Estadisticas />);
    await screen.findByText('Total de reservas');
    for (const [nombre, valor] of [['Total de reservas', 37], ['Confirmadas', 11], ['Completadas', 7],
      ['Cancelaciones por cliente', 6], ['Cancelaciones por negocio', 4], ['Clientes atendidos', 5]] as const) {
      expect(numero(nombre)).toHaveTextContent(new RegExp(`^${valor}$`));
    }
    expect(screen.getByText('Corte de cabello').closest('li')).toHaveTextContent('13 reservas');
    expect(screen.getByText('Arreglo de barba').closest('li')).toHaveTextContent('8 reservas');
    for (const dia of estadisticas().porDia) expect(screen.getByTitle(`${dia.fecha}: ${dia.reservas} reservas`)).toBeInTheDocument();
    const ruta = String(apiMock.mock.calls[0][0]);
    expect(ruta).toMatch(/^\/negocios\/mio\/estadisticas\?desde=\d{4}-\d{2}-\d{2}&hasta=\d{4}-\d{2}-\d{2}$/);
    expect(apiMock.mock.calls[0]).toHaveLength(1); // GET, sin escrituras.
    expect(screen.queryByText(/MVP-\d+/)).not.toBeInTheDocument();
    expect(screen.queryByText(/mientras no existan/)).not.toBeInTheDocument();
  });

  it.each([0, 1, 2])('F1 usa singular solo para 1 en los tres conteos (%i)', async cantidad => {
    const datos = estadisticas();
    apiMock.mockResolvedValue({ ...datos, totalReservas: cantidad,
      serviciosMasReservados: [{ servicioId: 'corte', nombre: 'Corte de cabello', reservas: cantidad }],
      porDia: [{ fecha: '2026-11-17', reservas: cantidad }] });
    render(<Estadisticas />);
    const texto = `${cantidad} ${cantidad === 1 ? 'reserva' : 'reservas'}`;
    const grafica = await screen.findByRole('img');
    expect(grafica).toHaveAccessibleName(expect.stringContaining(`: ${texto}.`));
    expect(within(grafica).getByTitle(`2026-11-17: ${texto}`)).toBeInTheDocument();
    expect(within(screen.getByText('Corte de cabello').closest('li')!).getByText(texto, { exact: true })).toBeVisible();
  });

  it('C2 cambia el periodo, borra datos anteriores y muestra una respuesta distinta', async () => {
    render(<Estadisticas />);
    await screen.findByText('Total de reservas');
    let resolver!: (valor: ReturnType<typeof estadisticas>) => void;
    apiMock.mockImplementationOnce(() => new Promise(resolve => { resolver = resolve; }));
    cambiar('7');
    expect(screen.queryByText('Total de reservas')).not.toBeInTheDocument();
    expect(screen.queryByText('Corte de cabello')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Cargando estadísticas...');
    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(2));
    expect(apiMock.mock.calls[1][0]).not.toBe(apiMock.mock.calls[0][0]);
    const nuevos = { ...estadisticas(), totalReservas: 92, clientesAtendidos: 23, serviciosMasReservados: [], porDia: [] };
    await act(async () => resolver(nuevos));
    expect(numero('Total de reservas')).toHaveTextContent('92');
    expect(numero('Clientes atendidos')).toHaveTextContent('23');
    expect(screen.queryByText('Corte de cabello')).not.toBeInTheDocument();
  });

  it('C2 ignora respuestas tardías de otro periodo', async () => {
    let anterior!: (valor: ReturnType<typeof estadisticas>) => void;
    apiMock.mockImplementationOnce(() => new Promise(resolve => { anterior = resolve; }));
    render(<Estadisticas />);
    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(1));
    cambiar('90');
    await screen.findByText('Total de reservas');
    await act(async () => anterior({ ...estadisticas(), totalReservas: 999 }));
    expect(numero('Total de reservas')).toHaveTextContent(/^37$/);
  });

  it.each([
    ['posterior', '2027-01-02', '2027-01-01', 'La fecha inicial no puede ser posterior a la fecha final.'],
    ['367 días', '2028-01-01', '2029-01-01', 'El periodo no puede pasar de 366 días.'],
    ['vacío', '', '2026-11-19', 'Ingresa la fecha inicial y la fecha final.'],
  ])('C3 valida %s junto al campo, borra datos y no consulta un rango inválido', async (_caso, desde, hasta, mensaje) => {
    render(<Estadisticas />);
    await screen.findByText('Total de reservas');
    cambiar('personalizado');
    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(2));
    await screen.findByText('Total de reservas');
    fireEvent.change(screen.getByLabelText('Fecha inicial'), { target: { value: desde } });
    fireEvent.change(screen.getByLabelText('Fecha final'), { target: { value: hasta } });
    const peticiones = apiMock.mock.calls.length;
    expect(screen.getByRole('alert')).toHaveTextContent(mensaje);
    expect(screen.getByLabelText('Fecha final')).toHaveAttribute('aria-describedby', 'error-periodo');
    expect(screen.getByLabelText('Fecha inicial')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText('Total de reservas')).not.toBeInTheDocument();
    await act(async () => {});
    expect(apiMock).toHaveBeenCalledTimes(peticiones);
  });

  it('C3 permite un periodo futuro de 366 días inclusivos y un solo día', async () => {
    expect(validarPeriodo({ desde: '2028-01-01', hasta: '2028-12-31' })).toBe('');
    expect(validarPeriodo({ desde: '2028-02-29', hasta: '2028-02-29' })).toBe('');
    expect(validarPeriodo({ desde: '2027-02-29', hasta: '2027-03-01' })).toMatch(/fechas válidas/);
    render(<Estadisticas />);
    await screen.findByText('Total de reservas');
    cambiar('personalizado');
    fireEvent.change(screen.getByLabelText('Fecha inicial'), { target: { value: '2028-01-01' } });
    fireEvent.change(screen.getByLabelText('Fecha final'), { target: { value: '2028-12-31' } });
    await waitFor(() => expect(apiMock).toHaveBeenLastCalledWith('/negocios/mio/estadisticas?desde=2028-01-01&hasta=2028-12-31'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('C4 gráfica con texto alternativo y tabla equivalente con cada valor y altura', async () => {
    render(<Estadisticas />);
    const grafica = await screen.findByRole('img', { name: /Reservas por día del 17\/11\/2026 al 19\/11\/2026: 37 reservas/ });
    const tabla = screen.getByRole('table', { name: 'Reservas por día' });
    expect(tabla).not.toHaveClass('visually-hidden');
    expect(tabla.parentElement?.tagName).toBe('DIV');
    expect(tabla.parentElement).toHaveClass('visually-hidden');
    const filas = within(tabla).getAllByRole('row').slice(1);
    expect(filas).toHaveLength(3);
    estadisticas().porDia.forEach((dia, i) => {
      expect(within(filas[i]).getByRole('rowheader')).toHaveTextContent(dia.fecha);
      expect(within(filas[i]).getByRole('cell')).toHaveTextContent(String(dia.reservas));
      const columna = grafica.querySelector(`[title="${dia.fecha}: ${dia.reservas} reservas"]`)!;
      expect(columna.firstElementChild).toHaveStyle({ height: `${dia.reservas / 16 * 100}%` });
    });
  });

  it.each([
    ['datos', [9, 12, 16], 16],
    ['ceros', [0, 0, 0], 0],
    ['un día', [1], 1],
    ['sin días', [], 0],
  ] as const)('F2 muestra referencias y fechas legibles con %s sin alterar la tabla', async (_caso, valores, maximo) => {
    const datos = estadisticas();
    const porDia = valores.map((reservas, i) => ({ fecha: datos.porDia[i].fecha, reservas }));
    apiMock.mockResolvedValue({ ...datos, porDia });
    render(<Estadisticas />);
    const grafica = await screen.findByRole('img');
    expect(screen.getByText('Del 17/11/2026 al 19/11/2026 · Todos los estados.')).toBeVisible();
    expect(grafica).toHaveAccessibleName(expect.stringContaining('del 17/11/2026 al 19/11/2026'));
    const eje = grafica.querySelector('.panel-grafica-eje')!;
    expect(eje).toBeVisible();
    expect(eje.children[0]).toHaveTextContent(new RegExp(`^${maximo}$`));
    expect(eje.children[1]).toHaveTextContent(/^0$/);
    const fechas = grafica.querySelector('.panel-grafica-fechas')!;
    expect(fechas).toBeVisible();
    expect(fechas.children[0]).toHaveTextContent('17/11/2026');
    expect(fechas.children[1]).toHaveTextContent(valores.length === 1 ? '17/11/2026' : '19/11/2026');
    const filas = within(screen.getByRole('table', { name: 'Reservas por día' })).getAllByRole('row').slice(1);
    expect(filas).toHaveLength(valores.length);
    porDia.forEach((dia, i) => {
      expect(within(filas[i]).getByRole('rowheader')).toHaveTextContent(dia.fecha);
      expect(within(filas[i]).getByRole('cell')).toHaveTextContent(new RegExp(`^${dia.reservas}$`));
      expect(grafica.querySelectorAll('.estadisticas-barra')[i]).toHaveStyle({ height: `${dia.reservas / Math.max(1, maximo) * 100}%` });
    });
  });

  it('G3 muestra las 366 barras del periodo máximo y rechaza 367 días', async () => {
    const periodo = { desde: '2028-01-01', hasta: '2028-12-31' };
    const porDia = Array.from({ length: 366 }, (_, i) => ({
      fecha: new Date(Date.UTC(2028, 0, i + 1)).toISOString().slice(0, 10), reservas: i + 1,
    }));
    apiMock.mockResolvedValue({ ...estadisticas(), periodo, porDia });
    render(<Estadisticas />);
    await screen.findByRole('img');
    cambiar('personalizado');
    fireEvent.change(screen.getByLabelText('Fecha inicial'), { target: { value: periodo.desde } });
    fireEvent.change(screen.getByLabelText('Fecha final'), { target: { value: periodo.hasta } });
    const grafica = await screen.findByRole('img');
    expect(apiMock).toHaveBeenLastCalledWith('/negocios/mio/estadisticas?desde=2028-01-01&hasta=2028-12-31');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const barras = grafica.querySelectorAll('.estadisticas-barra');
    expect(barras).toHaveLength(366);
    porDia.forEach((dia, i) => {
      expect(barras[i]).toBeVisible();
      expect(barras[i].parentElement).toHaveAttribute('title', `${dia.fecha}: ${dia.reservas} ${dia.reservas === 1 ? 'reserva' : 'reservas'}`);
      expect(barras[i]).toHaveStyle({ height: `${dia.reservas / 366 * 100}%` });
    });
    const eje = grafica.querySelector('.panel-grafica-eje')!;
    expect(eje).toBeVisible();
    expect(eje.children[0]).toHaveTextContent(/^366$/);
    expect(eje.children[1]).toHaveTextContent(/^0$/);
    const fechas = grafica.querySelector('.panel-grafica-fechas')!;
    expect(fechas.children[0]).toBeVisible();
    expect(fechas.children[0]).toHaveTextContent(/^01\/01\/2028$/);
    expect(fechas.children[1]).toBeVisible();
    expect(fechas.children[1]).toHaveTextContent(/^31\/12\/2028$/);
    const peticiones = apiMock.mock.calls.length;
    fireEvent.change(screen.getByLabelText('Fecha final'), { target: { value: '2029-01-01' } });
    expect(screen.getByRole('alert')).toHaveTextContent('El periodo no puede pasar de 366 días.');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    await act(async () => {});
    expect(apiMock).toHaveBeenCalledTimes(peticiones);
  });

  it('C5 cargando usa el estado y spinner compartidos del panel', async () => {
    apiMock.mockReturnValue(new Promise(() => {}));
    render(<Estadisticas />);
    const estado = screen.getByRole('status');
    expect(estado).toHaveTextContent('Cargando estadísticas...');
    expect(estado).toHaveClass('panel-estado-texto');
    expect(estado.closest('.panel-estado')!.querySelector('.spinner-border')).toBeInTheDocument();
    expect(screen.queryByText('Total de reservas')).not.toBeInTheDocument();
    await act(async () => {});
  });

  it('C5 vacío usa el estado compartido y muestra ceros', async () => {
    apiMock.mockResolvedValue({ ...estadisticas(), totalReservas: 0,
      porEstado: { pendiente: 0, confirmada: 0, rechazada: 0, rechazadaVencimiento: 0, cancelada: 0, completada: 0 },
      cancelaciones: { porCliente: 0, porNegocio: 0 }, clientesAtendidos: 0, serviciosMasReservados: [],
      porDia: [{ fecha: '2026-11-17', reservas: 0 }] });
    render(<Estadisticas />);
    const vacio = await screen.findByText('Las cifras aparecerán cuando tengas reservas en este periodo.');
    expect(vacio).toHaveClass('panel-estado-texto');
    expect(vacio.closest('.panel-estado')!.querySelector('.panel-ilustracion')).toBeInTheDocument();
    expect(numero('Total de reservas')).toHaveTextContent(/^0$/);
    expect(numero('Clientes atendidos')).toHaveTextContent(/^0$/);
    expect(screen.getByText('No hay servicios reservados para mostrar.')).toBeVisible();
    expect(screen.getByTitle('2026-11-17: 0 reservas').firstElementChild).toHaveStyle({ height: '0%' });
  });

  it('C5 error con Reintentar recupera los datos sin alert()', async () => {
    const alerta = vi.spyOn(window, 'alert').mockImplementation(() => {});
    apiMock.mockRejectedValueOnce(new Error('Sin red'));
    render(<Estadisticas />);
    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('No pudimos cargar las estadísticas. Intenta de nuevo.');
    expect(error).toHaveClass('panel-estado-texto');
    expect(error.closest('.panel-estado')!.querySelector('.panel-estado-icono--error')).toBeInTheDocument();
    const boton = screen.getByRole('button', { name: 'Reintentar' });
    expect(boton).toHaveClass('btn-servia-primary');
    fireEvent.click(boton);
    await screen.findByText('Total de reservas');
    expect(apiMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(alerta).not.toHaveBeenCalled();
  });

  it('C5 muestra el mensaje del tope con Acorta el periodo', async () => {
    apiMock.mockRejectedValue(new ErrorApi(400, 'El periodo tiene demasiadas reservas. Acórtalo e inténtalo de nuevo.'));
    render(<Estadisticas />);
    expect(await screen.findByRole('alert')).toHaveTextContent('El periodo tiene demasiadas reservas. Acórtalo e inténtalo de nuevo. Acorta el periodo.');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  });

  it.each([
    [new ErrorApi(429, 'Demasiadas consultas de estadísticas.'), 'Demasiadas consultas de estadísticas.'],
    [new ErrorApi(500, 'Internal server error'), MENSAJE_ERROR_SERVIDOR],
    [new TypeError('Failed to fetch'), 'No pudimos cargar las estadísticas. Intenta de nuevo.'],
  ])('distingue 429, 500 y red al cargar estadísticas', async (error, esperado) => {
    apiMock.mockRejectedValueOnce(error);
    render(<Estadisticas />);
    expect(await screen.findByRole('alert')).toHaveTextContent(esperado);
  });
});

describe('C6 periodos en hora de México', () => {
  const zona = process.env.TZ;
  beforeEach(() => { process.env.TZ = 'UTC'; vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-20T02:30:00Z')); });
  afterEach(() => { vi.useRealTimers(); if (zona === undefined) delete process.env.TZ; else process.env.TZ = zona; });
  it.each([[7, '2026-11-13'], [30, '2026-10-21'], [90, '2026-08-22']])('últimos %i días inclusive desde %s', (dias, desde) => {
    expect(periodoPredefinido(dias)).toEqual({ desde, hasta: '2026-11-19' });
  });
  it('la pantalla pide el predeterminado y los otros presets con el día mexicano', async () => {
    render(<Estadisticas />);
    await screen.findByText('Total de reservas');
    expect(apiMock).toHaveBeenLastCalledWith('/negocios/mio/estadisticas?desde=2026-10-21&hasta=2026-11-19');
    cambiar('7');
    await waitFor(() => expect(apiMock).toHaveBeenLastCalledWith('/negocios/mio/estadisticas?desde=2026-11-13&hasta=2026-11-19'));
    cambiar('90');
    await waitFor(() => expect(apiMock).toHaveBeenLastCalledWith('/negocios/mio/estadisticas?desde=2026-08-22&hasta=2026-11-19'));
  });
});
