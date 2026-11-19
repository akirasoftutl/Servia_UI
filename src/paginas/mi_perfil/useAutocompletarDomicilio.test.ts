import { act, renderHook } from '@testing-library/react'
import { api, ErrorApi } from '../../servicios/api'
import { NOTA_SIN_SUGERENCIAS, nuevoTokenSesion, useAutocompletarDomicilio } from './useAutocompletarDomicilio'

vi.mock('../../servicios/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../servicios/api')>()
  return { ...actual, api: vi.fn() }
})

const apiMock = vi.mocked(api)
const TOKEN = /^[A-Za-z0-9_-]{1,36}$/

const sugerencias = (n: number) => Array.from({ length: n }, (_, i) => ({ texto: `Blvd. López Mateos ${i + 1}, León, Gto.`, lugarId: `lugar-${i + 1}` }))

const esperar = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

function parametrosDe(llamada: number) {
  const [ruta] = apiMock.mock.calls[llamada]
  const [camino, consulta] = ruta.split('?')
  return { camino, parametros: new URLSearchParams(consulta) }
}

beforeEach(() => {
  vi.useFakeTimers()
  apiMock.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useAutocompletarDomicilio', () => {
  it('pide una sola vez tras 300 ms sin teclear y muestra máximo 5 sugerencias', async () => {
    apiMock.mockResolvedValue(sugerencias(7))
    const { result } = renderHook(() => useAutocompletarDomicilio())
    for (const texto of ['Blv', 'Blvd', 'Blvd ', 'Blvd L']) {
      act(() => result.current.buscar(texto))
      await esperar(100)
    }
    expect(apiMock).not.toHaveBeenCalled()
    await esperar(299 - 100)
    expect(apiMock).not.toHaveBeenCalled()
    await esperar(1)
    expect(apiMock).toHaveBeenCalledTimes(1)
    const { camino, parametros } = parametrosDe(0)
    expect(camino).toBe('/lugares/autocompletar')
    expect(parametros.get('q')).toBe('Blvd L')
    expect(parametros.get('sesion')).toMatch(TOKEN)
    expect(apiMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal)
    expect(result.current.abierta).toBe(true)
    expect(result.current.sugerencias).toHaveLength(5)
    expect(result.current.sugerencias[0]).toEqual({ texto: 'Blvd. López Mateos 1, León, Gto.', lugarId: 'lugar-1' })
  })

  it.each(['', 'ab', '  ab  ', '   '])('con menos de 3 letras tras quitar espacios («%s») no pide nada', async (texto) => {
    apiMock.mockResolvedValue(sugerencias(3))
    const { result } = renderHook(() => useAutocompletarDomicilio())
    act(() => result.current.buscar(texto))
    await esperar(1000)
    expect(apiMock).not.toHaveBeenCalled()
    expect(result.current.abierta).toBe(false)
  })

  it('con 100 letras tras quitar espacios sí pide sugerencias', async () => {
    apiMock.mockResolvedValue([])
    const { result } = renderHook(() => useAutocompletarDomicilio())
    act(() => result.current.buscar(`  ${'a'.repeat(100)}  `))
    await esperar(300)
    expect(apiMock).toHaveBeenCalledTimes(1)
    expect(parametrosDe(0).parametros.get('q')).toBe('a'.repeat(100))
  })

  it('con 101 letras no pide nada y deja la lista cerrada', async () => {
    apiMock.mockResolvedValue(sugerencias(3))
    const { result } = renderHook(() => useAutocompletarDomicilio())
    act(() => result.current.buscar('a'.repeat(101)))
    await esperar(1000)
    expect(apiMock).not.toHaveBeenCalled()
    expect(result.current.abierta).toBe(false)
  })

  it('manda el texto sin espacios de los extremos', async () => {
    apiMock.mockResolvedValue([])
    const { result } = renderHook(() => useAutocompletarDomicilio())
    act(() => result.current.buscar('  abc  '))
    await esperar(300)
    expect(parametrosDe(0).parametros.get('q')).toBe('abc')
  })

  it('con [] abre la lista vacía, sin nota de error', async () => {
    apiMock.mockResolvedValue([])
    const { result } = renderHook(() => useAutocompletarDomicilio())
    act(() => result.current.buscar('Calle inexistente'))
    await esperar(300)
    expect(result.current.abierta).toBe(true)
    expect(result.current.sugerencias).toEqual([])
    expect(result.current.nota).toBe('')
  })

  it('ignora una respuesta vieja que llega después de la nueva y aborta la petición vieja', async () => {
    let resolverVieja!: (valor: unknown) => void
    apiMock
      .mockImplementationOnce(() => new Promise((resolver) => { resolverVieja = resolver }))
      .mockResolvedValueOnce([{ texto: 'Nueva', lugarId: 'lugar-nueva' }])
    const { result } = renderHook(() => useAutocompletarDomicilio())
    act(() => result.current.buscar('Viej'))
    await esperar(300)
    const senalVieja = apiMock.mock.calls[0][1]!.signal!
    act(() => result.current.buscar('Nuev'))
    expect(senalVieja.aborted).toBe(true)
    await esperar(300)
    expect(result.current.sugerencias).toEqual([{ texto: 'Nueva', lugarId: 'lugar-nueva' }])
    await act(async () => { resolverVieja([{ texto: 'Vieja', lugarId: 'lugar-vieja' }]) })
    expect(result.current.sugerencias).toEqual([{ texto: 'Nueva', lugarId: 'lugar-nueva' }])
  })

  it.each([429, 503])('con %i cierra la lista y deja la nota discreta', async (estado) => {
    apiMock.mockRejectedValue(new ErrorApi(estado, 'No se pudieron obtener sugerencias.'))
    const { result } = renderHook(() => useAutocompletarDomicilio())
    act(() => result.current.buscar('Blvd'))
    await esperar(300)
    expect(result.current.abierta).toBe(false)
    expect(result.current.sugerencias).toEqual([])
    expect(result.current.nota).toBe(NOTA_SIN_SUGERENCIAS)
    // No reintenta solo: espera al siguiente tecleo.
    await esperar(5000)
    expect(apiMock).toHaveBeenCalledTimes(1)
    act(() => result.current.buscar('Blvd L'))
    expect(result.current.nota).toBe('')
  })

  it.each([
    ['400', new ErrorApi(400, 'q inválido')],
    ['401', new ErrorApi(401, 'Sin sesión')],
    ['403', new ErrorApi(403, 'Sin permiso')],
    ['red', new TypeError('Failed to fetch')],
    ['cuerpo no JSON', new SyntaxError('Unexpected token <')],
    ['AbortError', new DOMException('Abortada', 'AbortError')],
  ])('con %s no muestra nota ni sugerencias', async (_nombre, error) => {
    apiMock.mockRejectedValue(error)
    const { result } = renderHook(() => useAutocompletarDomicilio())
    act(() => result.current.buscar('Blvd'))
    await esperar(300)
    expect(result.current.abierta).toBe(false)
    expect(result.current.nota).toBe('')
  })

  it('al desmontar cancela la espera pendiente sin pedir nada', async () => {
    apiMock.mockResolvedValue(sugerencias(2))
    const { result, unmount } = renderHook(() => useAutocompletarDomicilio())
    act(() => result.current.buscar('Blvd'))
    unmount()
    expect(vi.getTimerCount()).toBe(0)
    await esperar(1000)
    expect(apiMock).not.toHaveBeenCalled()
  })

  it('al desmontar aborta la petición en curso y no actualiza el estado', async () => {
    let resolver!: (valor: unknown) => void
    apiMock.mockImplementation(() => new Promise((r) => { resolver = r }))
    const errorConsola = vi.spyOn(console, 'error')
    const { result, unmount } = renderHook(() => useAutocompletarDomicilio())
    act(() => result.current.buscar('Blvd'))
    await esperar(300)
    const senal = apiMock.mock.calls[0][1]!.signal!
    unmount()
    expect(senal.aborted).toBe(true)
    await act(async () => { resolver(sugerencias(2)) })
    expect(result.current.sugerencias).toEqual([])
    expect(errorConsola).not.toHaveBeenCalled()
  })

  it('usa el mismo token mientras escribe y uno nuevo tras terminar la sesión', async () => {
    apiMock.mockResolvedValue(sugerencias(1))
    const { result } = renderHook(() => useAutocompletarDomicilio())
    act(() => result.current.buscar('Blvd'))
    await esperar(300)
    act(() => result.current.buscar('Blvd L'))
    await esperar(300)
    act(() => result.current.terminarSesion())
    act(() => result.current.buscar('Blvd Lo'))
    await esperar(300)
    const [a, b, c] = [0, 1, 2].map((i) => parametrosDe(i).parametros.get('sesion'))
    expect(a).toBe(b)
    expect(c).not.toBe(a)
    expect(c).toMatch(TOKEN)
  })

  it('cerrar oculta la lista y cancela la búsqueda pendiente', async () => {
    apiMock.mockResolvedValue(sugerencias(2))
    const { result } = renderHook(() => useAutocompletarDomicilio())
    act(() => result.current.buscar('Blvd'))
    act(() => result.current.cerrar())
    await esperar(1000)
    expect(apiMock).not.toHaveBeenCalled()
    expect(result.current.abierta).toBe(false)
  })
})

describe('nuevoTokenSesion', () => {
  it('cumple el formato de la API, también sin crypto.randomUUID', () => {
    expect(nuevoTokenSesion()).toMatch(TOKEN)
    const original = crypto.randomUUID
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
    try {
      const token = nuevoTokenSesion()
      expect(token).toMatch(TOKEN)
      expect(token).not.toBe(nuevoTokenSesion())
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true })
    }
  })
})

describe('useAutocompletarDomicilio: detalle del lugar (#93)', () => {
  it('elegir pide el detalle con el mismo token de sesión y cierra la sesión', async () => {
    apiMock.mockResolvedValueOnce(sugerencias(2))
    const { result } = renderHook(() => useAutocompletarDomicilio())
    act(() => result.current.buscar('Blvd López'))
    await esperar(300)
    const detalle = { calle: 'Blvd. López Mateos', numeroExterior: '1', colonia: 'Centro', codigoPostal: '37000', municipio: 'León', estado: 'Guanajuato' }
    apiMock.mockResolvedValueOnce(detalle)
    let resultado: Awaited<ReturnType<typeof result.current.elegir>> | undefined
    await act(async () => { resultado = await result.current.elegir(result.current.sugerencias[1]) })
    expect(resultado).toEqual({ vigente: true, detalle })
    const { camino, parametros } = parametrosDe(1)
    expect(camino).toBe('/lugares/detalle')
    expect(parametros.get('lugarId')).toBe('lugar-2')
    expect(parametros.get('sesion')).toBe(parametrosDe(0).parametros.get('sesion'))
    expect(result.current.abierta).toBe(false)
    // La captura siguiente usa otra sesión.
    apiMock.mockResolvedValueOnce([])
    act(() => result.current.buscar('Blvd López'))
    await esperar(300)
    expect(parametrosDe(2).parametros.get('sesion')).not.toBe(parametros.get('sesion'))
  })

  it('sin lugarId no pide el detalle y devuelve detalle nulo', async () => {
    apiMock.mockResolvedValueOnce([{ texto: 'Sin identificador' }])
    const { result } = renderHook(() => useAutocompletarDomicilio())
    act(() => result.current.buscar('Blvd López'))
    await esperar(300)
    let resultado: Awaited<ReturnType<typeof result.current.elegir>> | undefined
    await act(async () => { resultado = await result.current.elegir(result.current.sugerencias[0]) })
    expect(resultado).toEqual({ vigente: true, detalle: null })
    expect(apiMock).toHaveBeenCalledTimes(1)
  })

  it('si el detalle falla o llega algo raro devuelve detalle nulo', async () => {
    apiMock.mockResolvedValueOnce(sugerencias(1))
    const { result } = renderHook(() => useAutocompletarDomicilio())
    act(() => result.current.buscar('Blvd López'))
    await esperar(300)
    apiMock.mockRejectedValueOnce(new ErrorApi(503, 'No disponible'))
    let falla: Awaited<ReturnType<typeof result.current.elegir>> | undefined
    await act(async () => { falla = await result.current.elegir({ texto: 'A', lugarId: 'a' }) })
    expect(falla).toEqual({ vigente: true, detalle: null })
    apiMock.mockResolvedValueOnce([1, 2])
    let raro: Awaited<ReturnType<typeof result.current.elegir>> | undefined
    await act(async () => { raro = await result.current.elegir({ texto: 'A', lugarId: 'a' }) })
    expect(raro).toEqual({ vigente: true, detalle: null })
  })

  it('una respuesta de detalle vieja se descarta si se elige otra sugerencia o se escribe', async () => {
    const { result } = renderHook(() => useAutocompletarDomicilio())
    act(() => result.current.buscar('Blvd López'))
    let resolverVieja: (d: unknown) => void = () => {}
    apiMock.mockReset()
    apiMock.mockImplementationOnce(() => new Promise((r) => { resolverVieja = r }))
    let vieja: Promise<unknown> = Promise.resolve()
    act(() => { vieja = result.current.elegir({ texto: 'A', lugarId: 'a' }) })
    act(() => result.current.buscar('Blvd'))
    await act(async () => { resolverVieja({ calle: 'X', numeroExterior: '1', colonia: 'Y', codigoPostal: '37000', municipio: 'Z', estado: 'Jalisco' }) })
    expect(await vieja).toEqual({ vigente: false, detalle: null })
  })

  it('un fallo de detalle viejo también se descarta (no pone el texto en la calle)', async () => {
    const { result } = renderHook(() => useAutocompletarDomicilio())
    act(() => result.current.buscar('Blvd López'))
    let fallar: (e: unknown) => void = () => {}
    apiMock.mockReset()
    apiMock.mockImplementationOnce(() => new Promise((_, rechazar) => { fallar = rechazar }))
    let vieja: Promise<unknown> = Promise.resolve()
    act(() => { vieja = result.current.elegir({ texto: 'A', lugarId: 'a' }) })
    act(() => result.current.buscar('Blvd'))
    await act(async () => { fallar(new ErrorApi(503, 'No disponible')) })
    expect(await vieja).toEqual({ vigente: false, detalle: null })
  })
})
