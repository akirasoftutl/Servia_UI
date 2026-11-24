import {
  api,
  ErrorAccionPendiente,
  ErrorSinConexion,
  MENSAJE_ACCION_PENDIENTE,
  MENSAJE_SIN_CONEXION,
  reenviarAccionesPendientes,
} from './api'
import { cantidadAccionesPendientes, vaciarCola } from './colaOffline'

function respuesta(estado: number, cuerpo?: unknown) {
  return new Response(cuerpo === undefined ? '' : JSON.stringify(cuerpo), { status: estado })
}

function cacheFalso() {
  const datos = new Map<string, Response>()
  const clave = (entrada: string | Request) => (typeof entrada === 'string' ? entrada : entrada.url)
  const cache = {
    match: async (entrada: string | Request) => datos.get(clave(entrada)),
    put: async (entrada: string | Request, valor: Response) => {
      datos.set(clave(entrada), valor.clone())
    },
    keys: async () => Array.from(datos.keys()).map((url) => new Request(url)),
    delete: async (entrada: string | Request) => datos.delete(clave(entrada)),
  }
  vi.stubGlobal('caches', {
    open: async () => cache,
    keys: async () => ['servia-datos-anon-v1'],
    delete: async () => true,
  })
}

beforeEach(async () => {
  cacheFalso()
  await vaciarCola()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api sin conexión', () => {
  it('sirve la última lectura guardada cuando falla la red', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(respuesta(200, [{ id: 's1', nombre: 'Corte' }]))
    await api('/negocios/mio/servicios')

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(api('/negocios/mio/servicios')).resolves.toEqual([{ id: 's1', nombre: 'Corte' }])
  })

  it('sirve la caché cuando el servicio responde 503', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(respuesta(200, { noLeidas: 3 }))
    await api('/notificaciones')

    fetchMock.mockResolvedValueOnce(respuesta(503))
    await expect(api('/notificaciones')).resolves.toEqual({ noLeidas: 3 })
  })

  it('avisa si no hay red y todavía no hay datos guardados', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const error = await api('/negocios/mio').catch((causa: unknown) => causa)

    expect(error).toBeInstanceOf(ErrorSinConexion)
    expect((error as Error).message).toBe(MENSAJE_SIN_CONEXION)
  })

  it('guarda una escritura hecha sin conexión y avisa de que quedó pendiente', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const error = await api('/negocios/mio/horario', {
      method: 'PATCH',
      body: JSON.stringify({ lunes: { abre: '10:00', cierra: '19:00' } }),
    }).catch((causa: unknown) => causa)

    expect(error).toBeInstanceOf(ErrorAccionPendiente)
    expect((error as Error).message).toBe(MENSAJE_ACCION_PENDIENTE)
    expect(await cantidadAccionesPendientes()).toBe(1)
  })

  it('reenvía la acción pendiente cuando vuelve la conexión', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await api('/negocios/mio/servicios', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Corte' }),
    }).catch(() => {})

    fetchMock.mockResolvedValueOnce(respuesta(201, { id: 's2' }))
    await reenviarAccionesPendientes()

    const ultimaLlamada = fetchMock.mock.calls.at(-1)!
    expect(ultimaLlamada[0]).toBe('http://localhost:3000/negocios/mio/servicios')
    expect(ultimaLlamada[1]).toEqual(expect.objectContaining({ method: 'POST' }))
    expect(ultimaLlamada[1]?.body).toBe(JSON.stringify({ nombre: 'Corte' }))
    expect(await cantidadAccionesPendientes()).toBe(0)
  })

  it('conserva la acción pendiente si la sesión expiró (401)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await api('/avisos/a1/leida', { method: 'PATCH' }).catch(() => {})

    fetchMock.mockResolvedValueOnce(respuesta(401, { message: 'Sesión expirada' }))
    await reenviarAccionesPendientes()

    expect(await cantidadAccionesPendientes()).toBe(1)
  })

  it('no encola un error del servidor (503) como si fuera falta de red', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      respuesta(503, { message: 'El almacenamiento no está disponible.' }),
    )

    await expect(api('/reservas/r1/estado', { method: 'PATCH', body: '{}' })).rejects.toMatchObject({
      name: 'ErrorApi',
      estado: 503,
    })
    expect(await cantidadAccionesPendientes()).toBe(0)
  })
})
