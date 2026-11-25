import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { api, ErrorSinConexion, MENSAJE_REQUIERE_CONEXION } from '../../servicios/api'
import { llamadasAlertas, ultimaAlerta } from '../../pruebas/mockAlertas'
import { RegistroNegocio } from './RegistroNegocio'

vi.mock('../../servicios/firebase', () => ({ auth: {} }))
vi.mock('firebase/auth', () => ({ signInWithEmailAndPassword: vi.fn() }))
vi.mock('../../servicios/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../servicios/api')>()
  return { ...actual, api: vi.fn() }
})
const llamada = vi.mocked(api)

function llenarYEnviar() {
  render(<MemoryRouter><RegistroNegocio /></MemoryRouter>)
  const poner = (nombre: string, valor: string) =>
    fireEvent.change(document.querySelector(`[name="${nombre}"]`)!, { target: { value: valor } })
  poner('nombreNegocio', 'Barbería')
  poner('correo', 'a@b.mx')
  poner('telefono', '4771234567')
  poner('contrasena', 'secreta123')
  return () => fireEvent.click(screen.getByRole('button', { name: 'REGISTRARSE' }))
}

afterEach(() => vi.unstubAllGlobals())

describe('RegistroNegocio sin conexión', () => {
  it('pide sinCola y muestra la alerta en cada intento, sin cuadro inline y con el botón habilitado', async () => {
    llamada.mockReset().mockRejectedValue(new ErrorSinConexion(MENSAJE_REQUIERE_CONEXION))
    const enviar = llenarYEnviar()

    for (let intento = 1; intento <= 3; intento++) {
      enviar()
      await waitFor(() => expect(llamadasAlertas()).toHaveLength(intento))
      expect(ultimaAlerta()).toMatchObject({ icon: 'warning', title: 'Sin conexión', text: MENSAJE_REQUIERE_CONEXION })
      await waitFor(() => expect(screen.getByRole('button', { name: 'REGISTRARSE' })).toBeEnabled())
    }
    expect(llamada).toHaveBeenCalledTimes(3)
    expect(llamada.mock.calls[0][1]).toMatchObject({ method: 'POST', sinCola: true })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('con navigator.onLine en false avisa sin llamar a la API', async () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: false })
    llamada.mockReset()
    const enviar = llenarYEnviar()

    enviar()
    await waitFor(() => expect(llamadasAlertas()).toHaveLength(1))
    enviar()
    await waitFor(() => expect(llamadasAlertas()).toHaveLength(2))

    expect(ultimaAlerta()).toMatchObject({ title: 'Sin conexión', text: MENSAJE_REQUIERE_CONEXION })
    expect(llamada).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'REGISTRARSE' })).toBeEnabled()
  })
})
