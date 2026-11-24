import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from './AuthContext'

const orden = vi.hoisted(() => [] as string[])
const mocks = vi.hoisted(() => ({
  onAuthStateChanged: vi.fn(),
  signOut: vi.fn(),
  api: vi.fn(),
  vaciarCacheDatos: vi.fn(),
  desactivarTokenPushActual: vi.fn(),
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: mocks.onAuthStateChanged,
  signOut: mocks.signOut,
}))
vi.mock('../servicios/firebase', () => ({ auth: { nombre: 'auth-prueba' } }))
vi.mock('../servicios/api', () => ({ api: mocks.api, vaciarCacheDatos: mocks.vaciarCacheDatos }))
vi.mock('../servicios/notificaciones', () => ({
  desactivarTokenPushActual: mocks.desactivarTokenPushActual,
}))

function BotonCerrar() {
  const { usuario, cerrarSesion } = useAuth()
  return (
    <div>
      <span>{usuario ? `Sesión: ${usuario.uid}` : 'Sin sesión'}</span>
      <button type="button" onClick={() => void cerrarSesion()}>
        Salir
      </button>
    </div>
  )
}

beforeEach(() => {
  orden.length = 0
  mocks.onAuthStateChanged.mockReset().mockImplementation((_auth, callback) => {
    void callback({ uid: 'negocio-1', email: 'negocio@ejemplo.com' })
    return () => {}
  })
  mocks.api.mockReset().mockResolvedValue({ tipo: 'negocio' })
  mocks.vaciarCacheDatos.mockReset().mockResolvedValue(undefined)
  mocks.desactivarTokenPushActual.mockReset().mockImplementation(async () => {
    orden.push('DELETE /notificaciones/tokens')
  })
  mocks.signOut.mockReset().mockImplementation(async () => {
    orden.push('signOut')
  })
})

it('al cerrar sesión desactiva el token push ANTES de llamar signOut', async () => {
  render(
    <AuthProvider>
      <BotonCerrar />
    </AuthProvider>,
  )

  expect(await screen.findByText('Sesión: negocio-1')).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'Salir' }))

  expect(await screen.findByText('Sin sesión')).toBeVisible()
  expect(mocks.desactivarTokenPushActual).toHaveBeenCalledTimes(1)
  expect(mocks.signOut).toHaveBeenCalledTimes(1)
  expect(orden).toEqual(['DELETE /notificaciones/tokens', 'signOut'])
})

it('sin conexión conserva la sesión local en vez de cerrarla', async () => {
  mocks.api.mockRejectedValueOnce(Object.assign(new Error('Sin conexión'), { sinConexion: true }))

  render(
    <AuthProvider>
      <BotonCerrar />
    </AuthProvider>,
  )

  expect(await screen.findByText('Sesión: negocio-1')).toBeVisible()
  expect(mocks.signOut).not.toHaveBeenCalled()
})
