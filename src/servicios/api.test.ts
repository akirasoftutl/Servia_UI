import {
  api,
  descargarMapaNegocio,
  eliminarFotoNegocio,
  eliminarImagenServicio,
  ErrorApi,
  subirFotoNegocio,
  subirImagenServicio,
} from './api'

function respuesta(estado: number, cuerpo?: unknown) {
  return new Response(cuerpo === undefined ? '' : JSON.stringify(cuerpo), { status: estado })
}

describe('api', () => {
  it('llama a la URL de la API y regresa el JSON', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(respuesta(200, { estado: 'ok' }))
    await expect(api('/salud')).resolves.toEqual({ estado: 'ok' })
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/salud', expect.any(Object))
  })

  it('manda JSON cuando hay cuerpo', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(respuesta(201, { id: '1' }))
    await api('/negocios', { method: 'POST', body: JSON.stringify({ nombre: 'Barbería' }) })
    const cabeceras = fetchMock.mock.calls[0][1]?.headers as Headers
    expect(cabeceras.get('Content-Type')).toBe('application/json')
  })

  it('lanza ErrorApi con el código y el mensaje del servidor', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(respuesta(409, { message: 'Ese correo ya tiene una cuenta' }))
    await expect(api('/auth/registro/negocio')).rejects.toMatchObject({
      name: 'ErrorApi',
      estado: 409,
      message: 'Ese correo ya tiene una cuenta',
    })
  })

  it('une los mensajes de validación que vienen en lista', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(respuesta(400, { message: ['correo inválido', 'falta nombre'] }))
    const error = await api('/x').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ErrorApi)
    expect((error as ErrorApi).message).toBe('correo inválido falta nombre')
  })

  it('conserva el cuerpo de la respuesta cuando hay un conflicto', async () => {
    const cuerpo = {
      message: 'Hay reservas fuera del horario',
      reservas: [{ folio: 'SRV-7KQ2MX' }],
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(respuesta(409, cuerpo))

    const error = await api('/negocios/mio/horario').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ErrorApi)
    expect((error as ErrorApi).datos).toEqual(cuerpo)
  })

  it('no fuerza Content-Type application/json cuando el cuerpo es FormData', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(respuesta(201, { id: 'f1', url: 'https://cdn/f1.jpg' }))
    const archivo = new File(['abc'], 'portada.jpg', { type: 'image/jpeg' })
    const resultado = await subirFotoNegocio(archivo, 'portada')

    expect(resultado).toEqual({ id: 'f1', url: 'https://cdn/f1.jpg' })
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/negocios/mio/fotos', expect.objectContaining({ method: 'POST' }))
    const opciones = fetchMock.mock.calls[0][1]!
    const cabeceras = opciones.headers as Headers
    expect(cabeceras.has('Content-Type')).toBe(false)
    expect(opciones.body).toBeInstanceOf(FormData)
    const datos = opciones.body as FormData
    expect(datos.get('tipo')).toBe('portada')
    expect(datos.get('archivo')).toBe(archivo)
  })

  it('elimina una foto en DELETE /negocios/mio/fotos/{fotoId} con respuesta 204', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
    await expect(eliminarFotoNegocio('foto/123')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/negocios/mio/fotos/foto%2F123',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('sube una imagen de servicio en POST /negocios/mio/servicios/{id}/imagenes con el campo archivo', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(respuesta(201, { id: 'img1', url: 'https://cdn.servia.test/servicios/s1/img1.jpg' }))
    const archivo = new File(['abc'], 'corte.jpg', { type: 'image/jpeg' })
    const resultado = await subirImagenServicio('s/1', archivo)

    expect(resultado).toEqual({ id: 'img1', url: 'https://cdn.servia.test/servicios/s1/img1.jpg' })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/negocios/mio/servicios/s%2F1/imagenes',
      expect.objectContaining({ method: 'POST' }),
    )
    const opciones = fetchMock.mock.calls[0][1]!
    expect((opciones.headers as Headers).has('Content-Type')).toBe(false)
    expect(opciones.body).toBeInstanceOf(FormData)
    expect((opciones.body as FormData).get('archivo')).toBe(archivo)
  })

  it('propaga el mensaje de la API cuando el servicio ya tiene 3 imágenes (409)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      respuesta(409, {
        statusCode: 409,
        message: 'El servicio ya tiene 3 imágenes. Elimina una antes de subir otra.',
        error: 'Conflict',
      }),
    )
    const archivo = new File(['abc'], 'corte.jpg', { type: 'image/jpeg' })
    await expect(subirImagenServicio('s1', archivo)).rejects.toMatchObject({
      estado: 409,
      message: 'El servicio ya tiene 3 imágenes. Elimina una antes de subir otra.',
    })
  })

  it('elimina una imagen de servicio en DELETE /negocios/mio/servicios/{id}/imagenes/{imagenId} con 204', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
    await expect(eliminarImagenServicio('s1', 'img/1')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/negocios/mio/servicios/s1/imagenes/img%2F1',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})

describe('descargarMapaNegocio', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('pide la imagen en GET /negocios/mio/mapa sin caché y la devuelve como URL temporal', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200, blob: async () => new Blob(['png'], { type: 'image/png' }) } as Response)
    URL.createObjectURL = vi.fn(() => 'blob:mapa')
    await expect(descargarMapaNegocio()).resolves.toBe('blob:mapa')
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/negocios/mio/mapa', expect.objectContaining({ cache: 'no-store' }))
    expect(vi.mocked(URL.createObjectURL).mock.calls[0][0]).toBeInstanceOf(Blob)
  })

  it('con 503 lanza ErrorApi con el aviso y no crea la URL', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(respuesta(503, { message: 'Mapa no disponible' }))
    URL.createObjectURL = vi.fn(() => 'blob:mapa')
    await expect(descargarMapaNegocio()).rejects.toMatchObject({ name: 'ErrorApi', estado: 503, message: 'No se pudo cargar el mapa.' })
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
})
