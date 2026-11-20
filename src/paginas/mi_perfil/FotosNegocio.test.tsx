import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FotoNegocio, FotosNegocio as FotosNegocioDatos } from '../../servicios/api';
import { FotosNegocio } from './FotosNegocio';
import { MAX_FOTO_BYTES, MENSAJE_TAMANO_EXCEDIDO, MENSAJE_TIPO_INVALIDO } from './fotos';

function respuestaJson(estado: number, cuerpo?: unknown): Response {
  return new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status: estado });
}

function crearImagen(nombre: string, tipo = 'image/jpeg', bytes = 1024): File {
  const contenido = new Uint8Array(Math.min(bytes, 16));
  const archivo = new File([contenido], nombre, { type: tipo });
  if (bytes !== archivo.size) {
    Object.defineProperty(archivo, 'size', { value: bytes });
  }
  return archivo;
}

function galeriaDe(cantidad: number): FotoNegocio[] {
  return Array.from({ length: cantidad }, (_, i) => ({
    id: `foto-${i + 1}`,
    url: `https://cdn.servia.test/negocios/uid/foto-${i + 1}.jpg`,
  }));
}

function subirEnInput(etiqueta: string, archivo: File) {
  const input = screen.getByLabelText(etiqueta) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [archivo] } });
}

describe('FotosNegocio (portada y galería)', () => {
  let fetchMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch');
  });

  it('C1: muestra vista previa antes de subir, permite cancelar, sube la portada y permite cambiarla', async () => {
    const usuario = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(respuestaJson(201, { id: 'p-1', url: 'https://cdn.servia.test/portada-1.jpg' }))
      .mockResolvedValueOnce(respuestaJson(201, { id: 'p-2', url: 'https://cdn.servia.test/portada-2.webp' }));

    render(<FotosNegocio fotosIniciales={{ portada: null, galeria: [] }} />);
    expect(screen.getByText('Sin foto de portada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subir portada' })).toBeEnabled();

    // Elegir archivo y cancelar la vista previa: no llama a la API
    const archivo1 = crearImagen('fachada.jpg', 'image/jpeg', 2048);
    subirEnInput('Seleccionar archivo de portada', archivo1);
    expect(screen.getByAltText('Vista previa de la portada')).toBeInTheDocument();
    expect(screen.getByText(/fachada\.jpg/)).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByAltText('Vista previa de la portada')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    // Elegir archivo y confirmar subida de portada
    subirEnInput('Seleccionar archivo de portada', archivo1);
    await usuario.click(screen.getByRole('button', { name: 'Guardar portada' }));

    const portada1 = await screen.findByAltText('Portada actual del negocio');
    expect(portada1).toHaveAttribute('src', 'https://cdn.servia.test/portada-1.jpg');
    expect(screen.getByRole('button', { name: 'Cambiar portada' })).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url1, opciones1] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url1).toBe('http://localhost:3000/negocios/mio/fotos');
    expect(opciones1.method).toBe('POST');
    expect((opciones1.headers as Headers).has('Content-Type')).toBe(false);
    expect(opciones1.body).toBeInstanceOf(FormData);
    const cuerpo1 = opciones1.body as FormData;
    expect(cuerpo1.get('tipo')).toBe('portada');
    expect(cuerpo1.get('archivo')).toBe(archivo1);

    // Cambiar la portada por otra con vista previa
    const archivo2 = crearImagen('fachada-nueva.webp', 'image/webp', 4096);
    subirEnInput('Seleccionar archivo de portada', archivo2);
    expect(screen.getByAltText('Vista previa de la portada')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Confirmar cambio' }));

    await waitFor(() =>
      expect(screen.getByAltText('Portada actual del negocio')).toHaveAttribute(
        'src',
        'https://cdn.servia.test/portada-2.webp',
      ),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, opciones2] = fetchMock.mock.calls[1] as [string, RequestInit];
    const cuerpo2 = opciones2.body as FormData;
    expect(cuerpo2.get('tipo')).toBe('portada');
  });

  it('C2: agrega hasta 5 fotos de galería, desactiva con «Máximo 5 fotos» y al quitar con confirmación vuelve a activar', async () => {
    const usuario = userEvent.setup();
    fetchMock.mockImplementation(async (url: string | URL | Request, opciones?: RequestInit) => {
      const ruta = String(url);
      if (ruta.endsWith('/negocios/mio/fotos') && opciones?.method === 'POST') {
        return respuestaJson(201, { id: 'foto-5', url: 'https://cdn.servia.test/negocios/uid/foto-5.png' });
      }
      if (ruta.endsWith('/negocios/mio/fotos/foto-2') && opciones?.method === 'DELETE') {
        return respuestaJson(204);
      }
      throw new Error(`Ruta inesperada: ${ruta}`);
    });

    const iniciales: FotosNegocioDatos = { portada: null, galeria: galeriaDe(4) };
    render(<FotosNegocio fotosIniciales={iniciales} />);

    expect(screen.getByText('4 / 5 en galería')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar foto' })).toBeEnabled();

    // Agregar la 5ta foto
    const quinta = crearImagen('local-5.png', 'image/png', 1500);
    subirEnInput('Seleccionar archivo de galería', quinta);
    expect(screen.getByAltText('Vista previa para la galería')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Subir a la galería' }));

    await screen.findByText('5 / 5 en galería');
    const botonMaximo = screen.getByRole('button', { name: 'Máximo 5 fotos' });
    expect(botonMaximo).toBeDisabled();
    expect(screen.getByAltText('Foto 5 de la galería')).toHaveAttribute(
      'src',
      'https://cdn.servia.test/negocios/uid/foto-5.png',
    );

    // Quitar la foto 2: primero cancelar confirmación no borra nada
    await usuario.click(screen.getByRole('button', { name: 'Quitar foto 2' }));
    const dialogo1 = screen.getByRole('alertdialog');
    await usuario.click(within(dialogo1).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Confirmar eliminación de la foto 2
    await usuario.click(screen.getByRole('button', { name: 'Quitar foto 2' }));
    const dialogo2 = screen.getByRole('alertdialog');
    await usuario.click(within(dialogo2).getByRole('button', { name: 'Quitar foto' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByText('4 / 5 en galería')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar foto' })).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/negocios/mio/fotos/foto-2',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it.each([
    ['PDF', crearImagen('catalogo.pdf', 'application/pdf', 1024), MENSAJE_TIPO_INVALIDO],
    ['GIF', crearImagen('animacion.gif', 'image/gif', 1024), MENSAJE_TIPO_INVALIDO],
    ['mayor a 5 MB', crearImagen('grande.jpg', 'image/jpeg', MAX_FOTO_BYTES + 1), MENSAJE_TAMANO_EXCEDIDO],
  ])('C3: rechaza %s en el navegador con mensaje claro y sin llamar a la API', (_caso, archivo, mensajeEsperado) => {
    render(<FotosNegocio fotosIniciales={{ portada: null, galeria: [] }} />);
    subirEnInput('Seleccionar archivo de portada', archivo);

    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent(mensajeEsperado);
    expect(screen.queryByAltText('Vista previa de la portada')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('C3: acepta una imagen exactamente en el límite de 5 MB para vista previa', () => {
    render(<FotosNegocio fotosIniciales={{ portada: null, galeria: [] }} />);
    subirEnInput('Seleccionar archivo de galería', crearImagen('exacta.webp', 'image/webp', MAX_FOTO_BYTES));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByAltText('Vista previa para la galería')).toBeInTheDocument();
  });

  it.each([
    [400, 'El archivo debe ser una imagen JPEG, PNG o WebP válida.'],
    [409, 'La galería ya tiene 5 fotos. Elimina una antes de subir otra.'],
    [413, 'La foto supera el tamaño máximo de 5 MB.'],
    [503, 'El almacenamiento de fotos no está disponible en este momento.'],
  ])('C4: muestra el mensaje de la API en error %i y la sección sigue usable', async (estado, mensaje) => {
    const usuario = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(respuestaJson(estado, { message: mensaje }))
      .mockResolvedValueOnce(respuestaJson(201, { id: 'ok-1', url: 'https://cdn.servia.test/ok-1.jpg' }));

    render(<FotosNegocio fotosIniciales={{ portada: null, galeria: [] }} />);
    subirEnInput('Seleccionar archivo de galería', crearImagen('trabajo.jpg', 'image/jpeg', 1024));
    await usuario.click(screen.getByRole('button', { name: 'Subir a la galería' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(mensaje);

    // La sección sigue usable: se puede volver a intentar subir
    const botonReintentar = screen.getByRole('button', { name: 'Subir a la galería' });
    expect(botonReintentar).toBeEnabled();
    await usuario.click(botonReintentar);

    expect(await screen.findByAltText('Foto 1 de la galería')).toHaveAttribute(
      'src',
      'https://cdn.servia.test/ok-1.jpg',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('C4: si falla al borrar en la API, muestra el mensaje y mantiene la foto usable', async () => {
    const usuario = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      respuestaJson(503, { message: 'Supabase Storage no está configurado en el servidor.' }),
    );

    render(<FotosNegocio fotosIniciales={{ portada: null, galeria: galeriaDe(1) }} />);
    await usuario.click(screen.getByRole('button', { name: 'Quitar foto 1' }));
    await usuario.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Quitar foto' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Supabase Storage no está configurado en el servidor.',
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByAltText('Foto 1 de la galería')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar foto 1' })).toBeEnabled();
  });

  it('C5: muestra estado de carga mientras sube y evita enviar dos veces', async () => {
    const usuario = userEvent.setup();
    let resolverSubida: (respuesta: Response) => void = () => {};
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolverSubida = resolve;
        }),
    );

    render(<FotosNegocio fotosIniciales={{ portada: null, galeria: galeriaDe(1) }} />);
    subirEnInput('Seleccionar archivo de portada', crearImagen('portada.png', 'image/png', 1024));

    const botonGuardar = screen.getByRole('button', { name: 'Guardar portada' });
    await usuario.click(botonGuardar);

    expect(screen.getByText('Subiendo foto...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subiendo...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Subir portada' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Agregar foto' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Quitar foto 1' })).toBeDisabled();

    // Intentar mandar otra vez mientras sube no dispara una segunda llamada
    fireEvent.click(screen.getByRole('button', { name: 'Subiendo...' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolverSubida(respuestaJson(201, { id: 'p-1', url: 'https://cdn.servia.test/portada.png' }));
    });

    expect(await screen.findByAltText('Portada actual del negocio')).toBeInTheDocument();
    expect(screen.queryByText('Subiendo foto...')).not.toBeInTheDocument();
  });

  it('C5: muestra estado de carga mientras borra y evita enviar dos veces', async () => {
    const usuario = userEvent.setup();
    let resolverBorrado: (respuesta: Response) => void = () => {};
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolverBorrado = resolve;
        }),
    );

    render(<FotosNegocio fotosIniciales={{ portada: null, galeria: galeriaDe(1) }} />);
    await usuario.click(screen.getByRole('button', { name: 'Quitar foto 1' }));
    const dialogo = screen.getByRole('alertdialog');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Quitar foto' }));

    expect(screen.getByText('Eliminando foto...')).toBeInTheDocument();
    const botonEliminando = within(dialogo).getByRole('button', { name: 'Eliminando...' });
    expect(botonEliminando).toBeDisabled();
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeDisabled();

    fireEvent.click(botonEliminando);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolverBorrado(respuestaJson(204));
    });

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByText('Tu galería está vacía')).toBeInTheDocument();
  });

  describe('quitar la portada (#116)', () => {
    const portada = { id: 'p-1', url: 'https://cdn.servia.test/portada.jpg' };

    it('C3: pide confirmación, cancelar no llama a la API y confirmar manda DELETE con el id de la portada', async () => {
      const usuario = userEvent.setup();
      fetchMock.mockResolvedValueOnce(respuestaJson(204));
      render(<FotosNegocio fotosIniciales={{ portada, galeria: galeriaDe(1) }} />);

      await usuario.click(screen.getByRole('button', { name: 'Quitar portada' }));
      let dialogo = screen.getByRole('alertdialog');
      expect(within(dialogo).getByText('¿Quitar la portada?')).toBeInTheDocument();
      await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(screen.getByAltText('Portada actual del negocio')).toBeInTheDocument();

      await usuario.click(screen.getByRole('button', { name: 'Quitar portada' }));
      dialogo = screen.getByRole('alertdialog');
      await usuario.click(within(dialogo).getByRole('button', { name: 'Sí, quitar portada' }));

      expect(await screen.findByText('Sin foto de portada')).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, opciones] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:3000/negocios/mio/fotos/p-1');
      expect(opciones.method).toBe('DELETE');
      // La sección sigue usable: la galería se conserva y se puede subir otra portada.
      expect(screen.queryByRole('button', { name: 'Quitar portada' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Subir portada' })).toBeEnabled();
      expect(screen.getByAltText('Foto 1 de la galería')).toBeInTheDocument();
      expect(screen.getByText('Portada eliminada.')).toBeInTheDocument();
    });

    it('C3: si la API falla, muestra el mensaje y conserva la portada', async () => {
      const usuario = userEvent.setup();
      fetchMock.mockResolvedValueOnce(respuestaJson(503, { message: 'Supabase Storage no está configurado en el servidor.' }));
      render(<FotosNegocio fotosIniciales={{ portada, galeria: [] }} />);
      await usuario.click(screen.getByRole('button', { name: 'Quitar portada' }));
      await usuario.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Sí, quitar portada' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Supabase Storage no está configurado en el servidor.');
      expect(screen.getByAltText('Portada actual del negocio')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Quitar portada' })).toBeEnabled();
    });

    it('C3: sin portada no hay botón para quitarla', () => {
      render(<FotosNegocio fotosIniciales={{ portada: null, galeria: [] }} />);
      expect(screen.queryByRole('button', { name: 'Quitar portada' })).not.toBeInTheDocument();
    });
  });

  describe('foto que no carga (#116)', () => {
    it('C4: la portada con error muestra «No se pudo cargar la foto» en vez del texto alternativo y se puede quitar', () => {
      render(<FotosNegocio fotosIniciales={{ portada: { id: 'p-1', url: 'https://cdn.servia.test/rota.jpg' }, galeria: [] }} />);
      fireEvent.error(screen.getByAltText('Portada actual del negocio'));
      expect(screen.getByText('No se pudo cargar la foto')).toBeInTheDocument();
      expect(screen.queryByAltText('Portada actual del negocio')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Quitar portada' })).toBeEnabled();
    });

    it('C4: solo la foto de galería que falla muestra el estado; las demás siguen y conserva «Quitar»', () => {
      render(<FotosNegocio fotosIniciales={{ portada: null, galeria: galeriaDe(2) }} />);
      fireEvent.error(screen.getByAltText('Foto 2 de la galería'));
      expect(screen.getAllByText('No se pudo cargar la foto')).toHaveLength(1);
      expect(screen.queryByAltText('Foto 2 de la galería')).not.toBeInTheDocument();
      expect(screen.getByAltText('Foto 1 de la galería')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Quitar foto 2' })).toBeEnabled();
    });

    it('C4: si la foto carga bien no aparece el aviso', () => {
      render(<FotosNegocio fotosIniciales={{ portada: null, galeria: galeriaDe(1) }} />);
      expect(screen.queryByText('No se pudo cargar la foto')).not.toBeInTheDocument();
    });
  });

  describe('URL.revokeObjectURL de la vista previa (#116)', () => {
    const originales = { crear: URL.createObjectURL, revocar: URL.revokeObjectURL };
    let crear: ReturnType<typeof vi.fn>;
    let revocar: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      let contador = 0;
      crear = vi.fn(() => `blob:servia-previa-${++contador}`);
      revocar = vi.fn();
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: crear });
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: revocar });
    });

    afterEach(() => {
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: originales.crear });
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: originales.revocar });
    });

    it('C5: al cancelar la vista previa libera su URL, y no antes', async () => {
      const usuario = userEvent.setup();
      render(<FotosNegocio fotosIniciales={{ portada: null, galeria: [] }} />);
      subirEnInput('Seleccionar archivo de portada', crearImagen('fachada.jpg'));
      expect(crear).toHaveBeenCalledTimes(1);
      expect(screen.getByAltText('Vista previa de la portada')).toHaveAttribute('src', 'blob:servia-previa-1');
      expect(revocar).not.toHaveBeenCalled();

      await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(revocar).toHaveBeenCalledTimes(1);
      expect(revocar).toHaveBeenCalledWith('blob:servia-previa-1');
    });

    it('C5: al subir la foto libera la URL de la vista previa', async () => {
      const usuario = userEvent.setup();
      fetchMock.mockResolvedValueOnce(respuestaJson(201, { id: 'g-1', url: 'https://cdn.servia.test/g-1.jpg' }));
      render(<FotosNegocio fotosIniciales={{ portada: null, galeria: [] }} />);
      subirEnInput('Seleccionar archivo de galería', crearImagen('servicio.jpg'));
      expect(revocar).not.toHaveBeenCalled();

      await usuario.click(screen.getByRole('button', { name: 'Subir a la galería' }));
      await screen.findByAltText('Foto 1 de la galería');
      expect(revocar).toHaveBeenCalledTimes(1);
      expect(revocar).toHaveBeenCalledWith('blob:servia-previa-1');
    });

    it('C5: si se elige otra foto antes de subir, libera la URL de la anterior', async () => {
      render(<FotosNegocio fotosIniciales={{ portada: null, galeria: [] }} />);
      subirEnInput('Seleccionar archivo de portada', crearImagen('a.jpg'));
      subirEnInput('Seleccionar archivo de portada', crearImagen('b.jpg'));
      expect(crear).toHaveBeenCalledTimes(2);
      expect(revocar).toHaveBeenCalledTimes(1);
      expect(revocar).toHaveBeenCalledWith('blob:servia-previa-1');
    });
  });

  it('F4: el aviso de «se suben aparte» va a ancho completo bajo el encabezado, con el estilo del subtítulo', () => {
    render(<FotosNegocio fotosIniciales={{ portada: null, galeria: [] }} />);
    const aviso = screen.getByText(/se suben aparte y al instante/);
    expect(aviso).toHaveClass('panel-tarjeta-subtitulo');
    expect(aviso.closest('.panel-tarjeta-encabezado')).toBeNull();
    expect(aviso.parentElement).toBe(screen.getByRole('heading', { name: 'Fotos' }).closest('section'));
  });
});
