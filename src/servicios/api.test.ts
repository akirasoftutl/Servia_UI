import { api, ErrorApi } from './api'

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
})
