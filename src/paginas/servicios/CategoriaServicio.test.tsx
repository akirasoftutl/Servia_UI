import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import { NuevoServicio } from './NuevoServicio';
import { MisServicios } from './MisServicios';
import { ultimaAlerta } from '../../pruebas/mockAlertas';

// Estas pruebas no sustituyen `api()`: simulan solo `fetch` con las respuestas
// reales del contrato de la API (akirasoftutl/Servia_BE#120). El catálogo sale
// siempre de `GET /categorias-servicio`: la interfaz no conoce ningún nombre.

interface CategoriaCatalogo { id: string; nombre: string; categoriaId: string; orden: number }
interface ServicioApi {
  id: string; nombre: string; descripcion: string; precio: number; duracionMin: number; activo: boolean;
  imagenes: { id: string; url: string }[];
  categoriaServicio: { id: string; nombre: string } | null;
  categoriaPersonalizada: string | null;
}
interface Llamada { metodo: string; ruta: string; cuerpo?: BodyInit | null }

const NEGOCIO = 'cat-salon';
const catalogo: CategoriaCatalogo[] = [
  { id: 'cs1', nombre: 'Cabello', categoriaId: NEGOCIO, orden: 1 },
  { id: 'cs2', nombre: 'Uñas', categoriaId: NEGOCIO, orden: 2 },
];
const MENSAJE_400 = 'La categoría de servicio no existe o no pertenece a la categoría de tu negocio.';

let servicio: ServicioApi;
let llamadas: Llamada[];
let categoriaNegocio: string | null;
let catalogoDeRespuesta: () => Response;
let falloPut: Response | undefined;

function json(estado: number, cuerpo?: unknown) {
  return new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status: estado });
}
function errorNest(estado: number, message: string | string[], error: string) {
  return json(estado, { statusCode: estado, message, error });
}

// Aplica los campos de categoría como lo hace la API: ausente = no cambia, null = quita.
function aplicarCategoria(destino: ServicioApi, cuerpo: Record<string, unknown>): Response | null {
  const id = 'categoriaServicioId' in cuerpo ? (cuerpo.categoriaServicioId as string | null) : (destino.categoriaServicio?.id ?? null);
  const texto = 'categoriaPersonalizada' in cuerpo ? (cuerpo.categoriaPersonalizada as string | null) : destino.categoriaPersonalizada;
  if (id && texto) return errorNest(400, 'Elige una categoría del catálogo o escribe la tuya, no ambas.', 'Bad Request');
  if (typeof texto === 'string' && (texto.trim() === '' || texto.trim().length > 40)) {
    return errorNest(400, ['La categoría personalizada debe tener entre 1 y 40 caracteres.'], 'Bad Request');
  }
  const elegida = id ? catalogo.find(c => c.id === id) : undefined;
  if (id && !elegida) return errorNest(400, MENSAJE_400, 'Bad Request');
  destino.categoriaServicio = elegida ? { id: elegida.id, nombre: elegida.nombre } : null;
  destino.categoriaPersonalizada = typeof texto === 'string' ? texto.trim() : null;
  return null;
}

beforeEach(() => {
  servicio = {
    id: 'uno', nombre: 'Corte', descripcion: 'Cabello', precio: 50, duracionMin: 30, activo: true, imagenes: [],
    categoriaServicio: null, categoriaPersonalizada: null,
  };
  llamadas = [];
  categoriaNegocio = NEGOCIO;
  falloPut = undefined;
  catalogoDeRespuesta = () => json(200, catalogo);
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (entrada, opciones) => {
    const ruta = String(entrada).replace('http://localhost:3000', '');
    const metodo = opciones?.method ?? 'GET';
    llamadas.push({ metodo, ruta, cuerpo: opciones?.body });
    const cuerpo = opciones?.body ? JSON.parse(String(opciones.body)) as Record<string, unknown> : {};

    if (metodo === 'GET' && ruta === '/negocios/mio') {
      return json(200, { perfilCompleto: true, camposFaltantes: [], categoriaId: categoriaNegocio });
    }
    if (metodo === 'GET' && ruta.startsWith('/categorias-servicio')) return catalogoDeRespuesta();
    if (metodo === 'GET' && ruta === '/negocios/mio/servicios') return json(200, [servicio]);
    if (metodo === 'GET' && ruta === '/negocios/mio/servicios/uno') return json(200, servicio);
    if (metodo === 'POST' && ruta === '/negocios/mio/servicios') {
      const nuevo: ServicioApi = { ...servicio, ...cuerpo, id: 'uno', categoriaServicio: null, categoriaPersonalizada: null } as ServicioApi;
      const rechazo = aplicarCategoria(nuevo, cuerpo);
      if (rechazo) return rechazo;
      servicio = nuevo;
      return json(201, nuevo);
    }
    if (metodo === 'PUT' && ruta === '/negocios/mio/servicios/uno') {
      if (falloPut) return falloPut;
      const copia = { ...servicio };
      const rechazo = aplicarCategoria(copia, cuerpo);
      if (rechazo) return rechazo;
      servicio = copia;
      return json(200, servicio);
    }
    return errorNest(404, `Cannot ${metodo} ${ruta}`, 'Not Found');
  });
});

function abrir(ruta = '/servicios/uno') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/servicios/nuevo" element={<NuevoServicio />} />
        <Route path="/servicios/:id" element={<NuevoServicio />} />
        <Route path="/servicios" element={<MisServicios />} />
      </Routes>
    </MemoryRouter>,
  );
}

const ETIQUETA = 'Categoría del servicio (opcional)';
const campo = () => screen.findByRole('combobox', { name: ETIQUETA });
const cuerpoDe = (metodo: string) => {
  const llamada = llamadas.filter(l => l.metodo === metodo && l.ruta.startsWith('/negocios/mio/servicios')).at(-1);
  return llamada ? JSON.parse(String(llamada.cuerpo)) as Record<string, unknown> : undefined;
};
async function llenarYPublicar() {
  fireEvent.change(await screen.findByLabelText('Nombre del servicio *'), { target: { value: 'Corte' } });
  fireEvent.change(screen.getByLabelText('Descripción del servicio *'), { target: { value: 'Cabello' } });
  fireEvent.change(screen.getByLabelText('Precio del servicio *'), { target: { value: '50' } });
  fireEvent.change(screen.getByLabelText('Duración del servicio *'), { target: { value: '30' } });
}

describe('Categoría del servicio: catálogo', () => {
  it('pide el catálogo con la categoría del negocio y ofrece Sin categoría, las del catálogo y «Otra»', async () => {
    abrir('/servicios/nuevo');
    const select = await campo();
    const opciones = within(select).getAllByRole('option').map(o => o.textContent);
    expect(opciones).toEqual(['Sin categoría', 'Cabello', 'Uñas', 'Otra (escribir la mía)']);
    expect(select).toHaveValue('');
    expect(llamadas.some(l => l.ruta === `/categorias-servicio?categoriaId=${NEGOCIO}`)).toBe(true);
  });

  it('en edición también pide el catálogo de la categoría del negocio', async () => {
    abrir();
    await campo();
    expect(llamadas.some(l => l.ruta === `/categorias-servicio?categoriaId=${NEGOCIO}`)).toBe(true);
  });

  it('si el catálogo no carga avisa, permite reintentar y el servicio se guarda sin categoría', async () => {
    catalogoDeRespuesta = () => errorNest(500, 'Error interno', 'Internal Server Error');
    abrir('/servicios/nuevo');
    expect(await screen.findByText('No se pudieron cargar las categorías.')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: ETIQUETA })).not.toBeInTheDocument();
    await llenarYPublicar();
    await userEvent.click(screen.getByRole('button', { name: 'Publicar servicio' }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    const cuerpo = cuerpoDe('POST')!;
    expect(cuerpo).not.toHaveProperty('categoriaServicioId');
    expect(cuerpo).not.toHaveProperty('categoriaPersonalizada');
  });

  it('«Reintentar» vuelve a pedir el catálogo y muestra el campo', async () => {
    catalogoDeRespuesta = () => { throw new TypeError('Failed to fetch'); };
    abrir('/servicios/nuevo');
    await screen.findByText('No se pudieron cargar las categorías.');
    catalogoDeRespuesta = () => json(200, catalogo);
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await campo()).toBeInTheDocument();
    expect(screen.queryByText('No se pudieron cargar las categorías.')).not.toBeInTheDocument();
  });

  it('si la categoría del negocio no tiene categorías de servicio lo dice y aún deja escribir la propia', async () => {
    catalogoDeRespuesta = () => json(200, []);
    abrir('/servicios/nuevo');
    const select = await campo();
    expect(screen.getByText(/aún no tiene categorías de servicio/)).toBeInTheDocument();
    expect(within(select).getAllByRole('option').map(o => o.textContent)).toEqual(['Sin categoría', 'Otra (escribir la mía)']);
  });
});

describe('Categoría del servicio: crear', () => {
  it('elegir una del catálogo manda solo categoriaServicioId', async () => {
    abrir('/servicios/nuevo');
    await llenarYPublicar();
    await userEvent.selectOptions(await campo(), 'Uñas');
    await userEvent.click(screen.getByRole('button', { name: 'Publicar servicio' }));
    await screen.findByRole('alertdialog');
    expect(cuerpoDe('POST')).toEqual({ nombre: 'Corte', descripcion: 'Cabello', precio: 50, duracionMin: 30, categoriaServicioId: 'cs2' });
  });

  it('sin elegir categoría el servicio se guarda igual y no manda ningún campo de categoría', async () => {
    abrir('/servicios/nuevo');
    await llenarYPublicar();
    await campo();
    await userEvent.click(screen.getByRole('button', { name: 'Publicar servicio' }));
    await screen.findByRole('alertdialog');
    expect(cuerpoDe('POST')).toEqual({ nombre: 'Corte', descripcion: 'Cabello', precio: 50, duracionMin: 30 });
  });

  it('«Otra» muestra un campo de hasta 40 caracteres con contador y manda solo categoriaPersonalizada recortada', async () => {
    abrir('/servicios/nuevo');
    await llenarYPublicar();
    await userEvent.selectOptions(await campo(), 'Otra (escribir la mía)');
    const texto = screen.getByLabelText('Tu categoría');
    expect(texto).toHaveAttribute('maxLength', '40');
    expect(screen.getByText('0/40')).toBeInTheDocument();
    await userEvent.type(texto, '  Novias  ');
    expect(screen.getByText('10/40')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Publicar servicio' }));
    await screen.findByRole('alertdialog');
    expect(cuerpoDe('POST')).toEqual({ nombre: 'Corte', descripcion: 'Cabello', precio: 50, duracionMin: 30, categoriaPersonalizada: 'Novias' });
  });

  it('«Otra» vacía o solo con espacios no se envía y pide escribirla', async () => {
    abrir('/servicios/nuevo');
    await llenarYPublicar();
    await userEvent.selectOptions(await campo(), 'Otra (escribir la mía)');
    await userEvent.type(screen.getByLabelText('Tu categoría'), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Publicar servicio' }));
    expect(screen.getByText('Escribe tu categoría o elige otra opción.')).toBeInTheDocument();
    expect(llamadas.some(l => l.metodo === 'POST')).toBe(false);
  });

  it('un texto de más de 40 caracteres no se acepta: el campo corta en 40', async () => {
    abrir('/servicios/nuevo');
    await userEvent.selectOptions(await campo(), 'Otra (escribir la mía)');
    await userEvent.type(screen.getByLabelText('Tu categoría'), 'x'.repeat(41));
    expect(screen.getByLabelText('Tu categoría')).toHaveValue('x'.repeat(40));
    expect(screen.getByText('40/40')).toBeInTheDocument();
  });

  it('un 400 de la API sobre la categoría se muestra en español junto al campo, sin diálogos del sistema', async () => {
    const alerta = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    // El catálogo aún ofrece una categoría que la API ya no acepta (p. ej. se desactivó).
    catalogoDeRespuesta = () => json(200, [...catalogo, { id: 'zz', nombre: 'Obsoleta', categoriaId: NEGOCIO, orden: 9 }]);
    abrir('/servicios/nuevo');
    await llenarYPublicar();
    const select = await campo();
    await userEvent.selectOptions(select, 'Obsoleta');
    await userEvent.click(screen.getByRole('button', { name: 'Publicar servicio' }));
    const mensaje = await screen.findByText(MENSAJE_400);
    expect(select).toHaveAttribute('aria-describedby', expect.stringContaining(mensaje.id));
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(alerta).not.toHaveBeenCalled();
  });
});

describe('Categoría del servicio: editar', () => {
  it('muestra elegida la categoría actual del catálogo y no la reenvía si no se toca', async () => {
    servicio.categoriaServicio = { id: 'cs1', nombre: 'Cabello' };
    abrir();
    expect(await campo()).toHaveValue('cs1');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByRole('heading', { name: 'Mis servicios' });
    const cuerpo = cuerpoDe('PUT')!;
    expect(cuerpo).not.toHaveProperty('categoriaServicioId');
    expect(cuerpo).not.toHaveProperty('categoriaPersonalizada');
  });

  it('cambia a otra del catálogo mandando también categoriaPersonalizada en null', async () => {
    servicio.categoriaServicio = { id: 'cs1', nombre: 'Cabello' };
    abrir();
    await userEvent.selectOptions(await campo(), 'Uñas');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByRole('heading', { name: 'Mis servicios' });
    expect(await screen.findByText('Uñas')).toBeInTheDocument();
    expect(cuerpoDe('PUT')).toMatchObject({ categoriaServicioId: 'cs2', categoriaPersonalizada: null });
  });

  it('quitarla manda null en los dos campos y la lista ya no muestra etiqueta', async () => {
    servicio.categoriaServicio = { id: 'cs1', nombre: 'Cabello' };
    abrir();
    await userEvent.selectOptions(await campo(), 'Sin categoría');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByRole('heading', { name: 'Mis servicios' });
    expect(cuerpoDe('PUT')).toMatchObject({ categoriaServicioId: null, categoriaPersonalizada: null });
    expect(servicio.categoriaServicio).toBeNull();
    expect(screen.queryByText('Cabello')).not.toBeInTheDocument();
  });

  it('carga una categoría personalizada: «Otra» elegida con su texto, y pasar al catálogo manda la personalizada en null', async () => {
    servicio.categoriaPersonalizada = 'Novias';
    abrir();
    const select = await campo();
    expect(select).toHaveValue('__otra');
    expect(screen.getByLabelText('Tu categoría')).toHaveValue('Novias');
    await userEvent.selectOptions(select, 'Cabello');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByRole('heading', { name: 'Mis servicios' });
    expect(cuerpoDe('PUT')).toMatchObject({ categoriaServicioId: 'cs1', categoriaPersonalizada: null });
    expect(servicio.categoriaPersonalizada).toBeNull();
  });

  it('pasar del catálogo a «Otra» manda categoriaServicioId en null', async () => {
    servicio.categoriaServicio = { id: 'cs1', nombre: 'Cabello' };
    abrir();
    await userEvent.selectOptions(await campo(), 'Otra (escribir la mía)');
    await userEvent.type(screen.getByLabelText('Tu categoría'), 'Novias');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByRole('heading', { name: 'Mis servicios' });
    expect(await screen.findByText('Novias')).toBeInTheDocument();
    expect(cuerpoDe('PUT')).toMatchObject({ categoriaPersonalizada: 'Novias', categoriaServicioId: null });
  });

  it('un servicio viejo (ambos null) abre en «Sin categoría» sin romper', async () => {
    abrir();
    expect(await campo()).toHaveValue('');
    expect(screen.getByLabelText('Nombre del servicio *')).toHaveValue('Corte');
  });

  it('un servicio sin categoría de servicio (el negocio cambió de categoría) conserva su personalizada y se puede elegir de nuevo', async () => {
    servicio.categoriaPersonalizada = 'Novias';
    abrir();
    expect(await campo()).toHaveValue('__otra');
    expect(screen.getByLabelText('Tu categoría')).toHaveValue('Novias');
  });

  it('no sobrescribe un 500 del PUT con un mensaje de categoría', async () => {
    falloPut = errorNest(500, 'Detalle privado', 'Internal Server Error');
    abrir();
    await userEvent.selectOptions(await campo(), 'Cabello');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(ultimaAlerta()).toMatchObject({
      icon: 'error',
      text: expect.stringContaining('Tuvimos un problema en el servidor.'),
    }));
  });
});

describe('Categoría del servicio: lista «Mis servicios»', () => {
  it('muestra la categoría del catálogo como etiqueta junto al nombre', async () => {
    servicio.categoriaServicio = { id: 'cs1', nombre: 'Cabello' };
    abrir('/servicios');
    expect(await screen.findByText('Cabello', { selector: '.servicio-titulo-fila *' })).toBeInTheDocument();
  });

  it('muestra la personalizada y nada si el servicio no tiene categoría', async () => {
    servicio.categoriaPersonalizada = 'Novias';
    const { unmount } = abrir('/servicios');
    expect(await screen.findByText('Novias')).toBeInTheDocument();
    unmount();
    servicio.categoriaPersonalizada = null;
    abrir('/servicios');
    await screen.findByText('Corte');
    expect(document.querySelector('.servicio-categoria')).toBeNull();
  });
});
