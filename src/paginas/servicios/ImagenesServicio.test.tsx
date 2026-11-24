import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import { NuevoServicio } from './NuevoServicio';
import { MisServicios } from './MisServicios';
import { MAX_IMAGENES_SERVICIO } from './imagenes';
import { MAX_FOTO_BYTES, MENSAJE_TAMANO_EXCEDIDO, MENSAJE_TIPO_INVALIDO } from '../mi_perfil/fotos';

// Estas pruebas no sustituyen `api()`: simulan solo `fetch` con las respuestas
// reales del contrato de la API (akirasoftutl/Servia_BE#114) para que una forma
// distinta de la real haga fallar la prueba.

interface Imagen { id: string; url: string }
interface ServicioApi {
  id: string; nombre: string; descripcion: string; precio: number; duracionMin: number;
  activo: boolean; imagenes: Imagen[];
}
interface Llamada { metodo: string; ruta: string; cuerpo?: BodyInit | null; cabeceras: Headers }

const MENSAJE_409 = 'El servicio ya tiene 3 imágenes. Elimina una antes de subir otra.';
const MENSAJE_413 = 'La foto supera el tamaño máximo de 5 MB.';
const MENSAJE_400 = 'El archivo debe ser una imagen JPEG, PNG o WebP válida.';
const MENSAJE_503 = 'Supabase Storage no está configurado en el servidor.';
const AVISO_PARCIAL = 'El servicio se creó, pero no se pudieron subir algunas imágenes. Agrégalas aquí.';

const url = (n: number) => `https://proyecto.supabase.co/storage/v1/object/public/servicios/negocio1/uno/img${n}.jpg`;
const imagen = (n: number): Imagen => ({ id: `img${n}`, url: url(n) });

let servicio: ServicioApi;
let llamadas: Llamada[];
// Respuestas forzadas para la siguiente subida / bajada (cuerpo estándar de Nest).
let falloSubida: Array<Response | Error | undefined>;
let falloBajada: Response | Error | undefined;
let compuertaSubida: Promise<void> | null;
let contadorId: number;

function json(estado: number, cuerpo?: unknown) {
  return new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status: estado });
}
function errorNest(estado: number, message: string, error: string) {
  return json(estado, { statusCode: estado, message, error });
}

beforeEach(() => {
  servicio = { id: 'uno', nombre: 'Corte', descripcion: 'Cabello', precio: 50, duracionMin: 30, activo: true, imagenes: [] };
  llamadas = [];
  falloSubida = [];
  falloBajada = undefined;
  compuertaSubida = null;
  contadorId = 0;
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: vi.fn(() => 'blob:vista-previa') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (entrada, opciones) => {
    const ruta = String(entrada).replace('http://localhost:3000', '');
    const metodo = opciones?.method ?? 'GET';
    llamadas.push({ metodo, ruta, cuerpo: opciones?.body, cabeceras: new Headers(opciones?.headers) });

    if (metodo === 'GET' && ruta === '/negocios/mio') return json(200, { perfilCompleto: true, camposFaltantes: [] });
    if (metodo === 'GET' && ruta === '/negocios/mio/servicios') return json(200, [servicio]);
    if (metodo === 'GET' && ruta === '/negocios/mio/servicios/uno') return json(200, servicio);
    // Crear NO devuelve `imagenes` (contrato de BE#114).
    if (metodo === 'POST' && ruta === '/negocios/mio/servicios') {
      const { imagenes: _omitida, ...sinImagenes } = { ...servicio, id: 'uno', imagenes: [] as Imagen[] };
      return json(201, sinImagenes);
    }
    if (metodo === 'PUT' && ruta === '/negocios/mio/servicios/uno') return json(200, servicio);

    if (metodo === 'POST' && ruta === '/negocios/mio/servicios/uno/imagenes') {
      if (compuertaSubida) await compuertaSubida;
      const forzado = falloSubida.shift();
      if (forzado instanceof Error) throw forzado;
      if (forzado) return forzado;
      contadorId += 1;
      const nueva = imagen(servicio.imagenes.length + 1 + contadorId * 10);
      servicio.imagenes = [...servicio.imagenes, nueva];
      return json(201, nueva);
    }
    const borrar = ruta.match(/^\/negocios\/mio\/servicios\/uno\/imagenes\/(.+)$/);
    if (metodo === 'DELETE' && borrar) {
      if (falloBajada instanceof Error) throw falloBajada;
      if (falloBajada) return falloBajada;
      servicio.imagenes = servicio.imagenes.filter(i => i.id !== borrar[1]);
      return new Response(null, { status: 204 });
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

function archivo(nombre: string, tipo = 'image/jpeg', bytes = 1024): File {
  const f = new File([new Uint8Array(Math.min(bytes, 16))], nombre, { type: tipo });
  if (bytes !== f.size) Object.defineProperty(f, 'size', { value: bytes });
  return f;
}
function elegir(...archivos: File[]) {
  fireEvent.change(screen.getByLabelText('Seleccionar imágenes del servicio'), { target: { files: archivos } });
}
const subidas = () => llamadas.filter(l => l.metodo === 'POST' && l.ruta.endsWith('/imagenes'));
const bajadas = () => llamadas.filter(l => l.metodo === 'DELETE');

describe('Imágenes del servicio: edición (/servicios/:id)', () => {
  it('muestra las imágenes que trae el servicio, su contador y ya no avisa que no se guardan', async () => {
    servicio.imagenes = [imagen(1), imagen(2)];
    abrir();
    const primera = await screen.findByRole('img', { name: 'Imagen 1 del servicio' });
    expect(primera).toHaveAttribute('src', url(1));
    expect(screen.getByRole('img', { name: 'Imagen 2 del servicio' })).toHaveAttribute('src', url(2));
    expect(screen.getByText(`2 de ${MAX_IMAGENES_SERVICIO} imágenes`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar imagen' })).toBeEnabled();
    expect(screen.queryByText(/no se guardarán ni enviarán al servidor/)).not.toBeInTheDocument();
  });

  it('sin imágenes muestra el estado vacío y ningún aviso de vista previa', async () => {
    abrir();
    expect(await screen.findByText('Aún no hay imágenes de este servicio.')).toBeInTheDocument();
    expect(screen.getByText(`0 de ${MAX_IMAGENES_SERVICIO} imágenes`)).toBeInTheDocument();
    expect(screen.queryByText(/no se guardarán/)).not.toBeInTheDocument();
  });

  it('sube una imagen al momento (multipart, campo archivo, sin Content-Type JSON) y sigue ahí al recargar', async () => {
    const { unmount } = abrir();
    await screen.findByLabelText('Nombre del servicio *');
    const foto = archivo('corte.jpg');
    elegir(foto);

    const nueva = await screen.findByRole('img', { name: 'Imagen 1 del servicio' });
    expect(nueva).toHaveAttribute('src', url(11));
    expect(screen.getByRole('status')).toHaveTextContent('Imagen agregada.');

    expect(subidas()).toHaveLength(1);
    const [subida] = subidas();
    expect(subida.ruta).toBe('/negocios/mio/servicios/uno/imagenes');
    expect(subida.cabeceras.has('Content-Type')).toBe(false);
    expect(subida.cuerpo).toBeInstanceOf(FormData);
    expect((subida.cuerpo as FormData).get('archivo')).toBe(foto);

    // «Recargar»: se vuelve a montar la pantalla y la lee de la API.
    unmount();
    abrir();
    expect(await screen.findByRole('img', { name: 'Imagen 1 del servicio' })).toHaveAttribute('src', url(11));
  });

  it('muestra una tarjeta «Subiendo...» por imagen mientras la API responde y bloquea otra selección', async () => {
    let soltar!: () => void;
    compuertaSubida = new Promise<void>(r => { soltar = r; });
    abrir();
    await screen.findByLabelText('Nombre del servicio *');
    elegir(archivo('corte.jpg'));

    expect(await screen.findByText('Subiendo...')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Vista previa de corte.jpg' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar imagen' })).toBeDisabled();

    soltar();
    expect(await screen.findByRole('img', { name: 'Imagen 1 del servicio' })).toBeInTheDocument();
    expect(screen.queryByText('Subiendo...')).not.toBeInTheDocument();
  });

  it('con 3 imágenes deshabilita «Agregar imagen» y explica el tope; al quitar una se habilita', async () => {
    servicio.imagenes = [imagen(1), imagen(2), imagen(3)];
    abrir();
    const boton = await screen.findByRole('button', { name: 'Máximo 3 imágenes' });
    expect(boton).toBeDisabled();
    expect(screen.getByLabelText('Seleccionar imágenes del servicio')).toBeDisabled();
    expect(screen.getByText('Ya tienes 3 imágenes, el máximo por servicio. Quita una para agregar otra.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Quitar imagen 3' }));
    const dialogo = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Quitar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Agregar imagen' })).toBeEnabled());
  });

  it('si se eligen más archivos de los que caben solo sube los que caben y lo explica', async () => {
    servicio.imagenes = [imagen(1), imagen(2)];
    abrir();
    await screen.findByLabelText('Nombre del servicio *');
    elegir(archivo('a.jpg'), archivo('b.jpg'));
    expect(await screen.findByRole('img', { name: 'Imagen 3 del servicio' })).toBeInTheDocument();
    expect(subidas()).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent('Solo caben 1 imagen más: el máximo es 3 por servicio.');
  });

  it.each([
    ['un PDF', archivo('menu.pdf', 'application/pdf'), MENSAJE_TIPO_INVALIDO],
    ['un GIF', archivo('anim.gif', 'image/gif'), MENSAJE_TIPO_INVALIDO],
    ['una imagen de más de 5 MB', archivo('grande.jpg', 'image/jpeg', MAX_FOTO_BYTES + 1), MENSAJE_TAMANO_EXCEDIDO],
  ])('rechaza %s en el panel sin llamar a la API', async (_nombre, malo, mensaje) => {
    abrir();
    await screen.findByLabelText('Nombre del servicio *');
    elegir(malo);
    expect(await screen.findByRole('alert')).toHaveTextContent(mensaje);
    expect(subidas()).toHaveLength(0);
    expect(screen.queryByRole('img', { name: /Imagen 1/ })).not.toBeInTheDocument();
  });

  it.each([
    ['409', errorNest(409, MENSAJE_409, 'Conflict'), MENSAJE_409],
    ['413', errorNest(413, MENSAJE_413, 'Payload Too Large'), MENSAJE_413],
    ['400', errorNest(400, MENSAJE_400, 'Bad Request'), MENSAJE_400],
  ])('muestra el mensaje de la API cuando responde %s y no agrega la imagen', async (_c, respuesta, mensaje) => {
    falloSubida = [respuesta];
    abrir();
    await screen.findByLabelText('Nombre del servicio *');
    elegir(archivo('corte.jpg'));
    expect(await screen.findByRole('alert')).toHaveTextContent(mensaje);
    expect(screen.queryByRole('img', { name: 'Imagen 1 del servicio' })).not.toBeInTheDocument();
    expect(screen.queryByText('Subiendo...')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar imagen' })).toBeEnabled();
  });

  it('un 503 muestra el aviso genérico del servidor y no expone el detalle interno', async () => {
    falloSubida = [errorNest(503, MENSAJE_503, 'Service Unavailable')];
    abrir();
    await screen.findByLabelText('Nombre del servicio *');
    elegir(archivo('corte.jpg'));
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Tuvimos un problema en el servidor. Inténtalo de nuevo en unos minutos.');
    expect(alerta).not.toHaveTextContent('Supabase');
  });

  it('401 y 403 se explican en español en lugar del texto en inglés de Nest', async () => {
    falloSubida = [errorNest(401, 'Unauthorized', 'Unauthorized'), errorNest(403, 'Forbidden', 'Forbidden')];
    abrir();
    await screen.findByLabelText('Nombre del servicio *');
    elegir(archivo('a.jpg'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu sesión expiró. Vuelve a iniciar sesión para continuar.');
    elegir(archivo('b.jpg'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Tu cuenta no tiene permiso para cambiar las imágenes de este servicio.'));
  });

  it('sin red muestra un error en español', async () => {
    falloSubida = [new TypeError('Failed to fetch')];
    abrir();
    await screen.findByLabelText('Nombre del servicio *');
    elegir(archivo('corte.jpg'));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos subir la imagen. Revisa tu conexión e intenta de nuevo.');
  });

  it('pide confirmación antes de quitar: cancelar no llama a la API y devuelve el foco', async () => {
    servicio.imagenes = [imagen(1), imagen(2)];
    abrir();
    const quitar = await screen.findByRole('button', { name: 'Quitar imagen 1' });
    await userEvent.click(quitar);
    const dialogo = screen.getByRole('alertdialog', { name: 'Quitar imagen' });
    expect(dialogo).toHaveAccessibleDescription('¿Quitar la imagen 1? Dejará de mostrarse a tus clientes.');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(bajadas()).toHaveLength(0);
    expect(quitar).toHaveFocus();
    expect(screen.getByRole('img', { name: 'Imagen 1 del servicio' })).toBeInTheDocument();
  });

  it('al confirmar quita la imagen con DELETE y desaparece del servicio (también al recargar)', async () => {
    servicio.imagenes = [imagen(1), imagen(2)];
    const { unmount } = abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Quitar imagen 1' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Quitar' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(bajadas()).toHaveLength(1);
    expect(bajadas()[0].ruta).toBe('/negocios/mio/servicios/uno/imagenes/img1');
    expect(screen.getByRole('status')).toHaveTextContent('Imagen quitada.');
    // La que sobrevive pasa a ser la primera.
    expect(screen.getByRole('img', { name: 'Imagen 1 del servicio' })).toHaveAttribute('src', url(2));
    expect(screen.queryByRole('img', { name: 'Imagen 2 del servicio' })).not.toBeInTheDocument();

    unmount();
    abrir();
    expect(await screen.findByRole('img', { name: 'Imagen 1 del servicio' })).toHaveAttribute('src', url(2));
    expect(screen.queryByRole('img', { name: 'Imagen 2 del servicio' })).not.toBeInTheDocument();
  });

  it('si la API falla al quitar, conserva la imagen y muestra el mensaje en español', async () => {
    servicio.imagenes = [imagen(1)];
    falloBajada = errorNest(404, 'La imagen no existe en este servicio.', 'Not Found');
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Quitar imagen 1' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Quitar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La imagen no existe en este servicio.');
    expect(screen.getByRole('img', { name: 'Imagen 1 del servicio' })).toBeInTheDocument();
  });

  it('si la URL de una imagen no carga muestra un aviso en lugar del texto alternativo', async () => {
    servicio.imagenes = [imagen(1)];
    abrir();
    fireEvent.error(await screen.findByRole('img', { name: 'Imagen 1 del servicio' }));
    expect(await screen.findByText('No se pudo cargar la imagen')).toBeInTheDocument();
  });

  it('no deja ver la URL interna de la imagen como texto', async () => {
    servicio.imagenes = [imagen(1)];
    abrir();
    await screen.findByRole('img', { name: 'Imagen 1 del servicio' });
    expect(screen.queryByText(new RegExp('supabase', 'i'))).not.toBeInTheDocument();
  });

  it('guardar los datos del servicio no reenvía ni borra las imágenes', async () => {
    servicio.imagenes = [imagen(1)];
    abrir();
    fireEvent.change(await screen.findByLabelText('Precio del servicio *'), { target: { value: '75' } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(llamadas.some(l => l.metodo === 'PUT')).toBe(true));
    const put = llamadas.find(l => l.metodo === 'PUT')!;
    expect(JSON.parse(String(put.cuerpo))).toEqual({ nombre: 'Corte', descripcion: 'Cabello', precio: 75, duracionMin: 30 });
  });
});

describe('Imágenes del servicio: creación (/servicios/nuevo)', () => {
  async function llenarYPublicar(...fotos: File[]) {
    await screen.findByLabelText('Nombre del servicio *');
    fireEvent.change(screen.getByLabelText('Nombre del servicio *'), { target: { value: 'Corte' } });
    fireEvent.change(screen.getByLabelText('Descripción del servicio *'), { target: { value: 'Cabello' } });
    fireEvent.change(screen.getByLabelText('Precio del servicio *'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('Duración del servicio *'), { target: { value: '30' } });
    if (fotos.length) elegir(...fotos);
    await userEvent.click(screen.getByRole('button', { name: 'Publicar servicio' }));
  }

  it('muestra las imágenes elegidas como vista previa sin llamar a la API de imágenes', async () => {
    abrir('/servicios/nuevo');
    await screen.findByLabelText('Nombre del servicio *');
    elegir(archivo('a.jpg'), archivo('b.png', 'image/png'));
    expect(await screen.findByRole('img', { name: 'Vista previa de la imagen 1' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Vista previa de la imagen 2' })).toBeInTheDocument();
    expect(screen.getByText('Se subirán cuando publiques el servicio.')).toBeInTheDocument();
    expect(subidas()).toHaveLength(0);
  });

  it('permite quitar una vista previa antes de publicar y respeta el tope de 3', async () => {
    abrir('/servicios/nuevo');
    await screen.findByLabelText('Nombre del servicio *');
    elegir(archivo('a.jpg'), archivo('b.jpg'), archivo('c.jpg'), archivo('d.jpg'));
    expect(await screen.findByRole('button', { name: 'Máximo 3 imágenes' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Solo caben 3 imágenes más: el máximo es 3 por servicio.');
    expect(screen.queryByRole('img', { name: 'Vista previa de la imagen 4' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Quitar imagen 3' }));
    expect(screen.getByRole('button', { name: 'Agregar imagen' })).toBeEnabled();
  });

  it('rechaza en el panel un archivo inválido al elegirlo', async () => {
    abrir('/servicios/nuevo');
    await screen.findByLabelText('Nombre del servicio *');
    elegir(archivo('menu.pdf', 'application/pdf'));
    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAJE_TIPO_INVALIDO);
    expect(screen.queryByRole('img', { name: /Vista previa/ })).not.toBeInTheDocument();
  });

  it('al publicar crea el servicio y sube las imágenes una por una con el id devuelto', async () => {
    abrir('/servicios/nuevo');
    const a = archivo('a.jpg');
    const b = archivo('b.png', 'image/png');
    await llenarYPublicar(a, b);

    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Servicio publicado.');
    const orden = llamadas.filter(l => l.metodo === 'POST').map(l => l.ruta);
    expect(orden).toEqual([
      '/negocios/mio/servicios',
      '/negocios/mio/servicios/uno/imagenes',
      '/negocios/mio/servicios/uno/imagenes',
    ]);
    expect((subidas()[0].cuerpo as FormData).get('archivo')).toBe(a);
    expect((subidas()[1].cuerpo as FormData).get('archivo')).toBe(b);
    expect(servicio.imagenes).toHaveLength(2);
  });

  it('si falla alguna subida el servicio queda creado, no se vuelve a crear y se lleva a editarlo con el aviso', async () => {
    falloSubida = [undefined, errorNest(413, MENSAJE_413, 'Payload Too Large')];
    abrir('/servicios/nuevo');
    await llenarYPublicar(archivo('a.jpg'), archivo('b.jpg'));

    expect(await screen.findByRole('heading', { name: 'Editar servicio' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(AVISO_PARCIAL);
    expect(screen.getByLabelText('Nombre del servicio *')).toHaveValue('Corte');
    // La que sí se subió ya está en el servicio.
    expect(await screen.findByRole('img', { name: 'Imagen 1 del servicio' })).toBeInTheDocument();
    expect(llamadas.filter(l => l.metodo === 'POST' && l.ruta === '/negocios/mio/servicios')).toHaveLength(1);
    expect(screen.queryByText('Servicio publicado.')).not.toBeInTheDocument();
  });

  it('sin imágenes elegidas publica igual que antes, sin llamar a la API de imágenes', async () => {
    abrir('/servicios/nuevo');
    await llenarYPublicar();
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Servicio publicado.');
    expect(subidas()).toHaveLength(0);
  });
});
