import { act, render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth, type ResultadoGoogle } from './AuthContext'
import { ErrorApi, ErrorSinConexion, MENSAJE_REQUIERE_CONEXION } from '../servicios/api'
import { llamadasAlertas, ultimaAlerta } from '../pruebas/mockAlertas'

const mocks = vi.hoisted(() => ({
  oyente: null as null | ((user: unknown) => Promise<void> | void),
  onAuthStateChanged: vi.fn(),
  signOut: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn(),
  setCustomParameters: vi.fn(),
  api: vi.fn(),
  auth: { currentUser: null as unknown },
}))

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {
    setCustomParameters = mocks.setCustomParameters
  },
  onAuthStateChanged: mocks.onAuthStateChanged,
  signOut: mocks.signOut,
  signInWithPopup: mocks.signInWithPopup,
  signInWithRedirect: mocks.signInWithRedirect,
  getRedirectResult: mocks.getRedirectResult,
}))
vi.mock('../servicios/firebase', () => ({ auth: mocks.auth }))
vi.mock('../servicios/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../servicios/api')>()),
  api: mocks.api,
  vaciarCacheDatos: vi.fn(),
}))
vi.mock('../servicios/notificaciones', () => ({ desactivarTokenPushActual: vi.fn() }))

const getIdToken = vi.fn()
const usuarioGoogle = { uid: 'g-1', email: 'g@ejemplo.com', getIdToken }

let contexto: ReturnType<typeof useAuth>
function Espia() {
  contexto = useAuth()
  return <span>{contexto.usuario ? `Sesión: ${contexto.usuario.uid}` : 'Sin sesión'}</span>
}

async function montar() {
  render(<AuthProvider><Espia /></AuthProvider>)
  // Firebase avisa una vez al arrancar, sin sesión.
  await act(async () => { await mocks.oyente!(null) })
  expect(screen.getByText('Sin sesión')).toBeVisible()
}

const llamadasA = (ruta: string) => mocks.api.mock.calls.filter(([r]) => r === ruta)

beforeEach(() => {
  localStorage.clear()
  mocks.oyente = null
  mocks.auth.currentUser = null
  mocks.onAuthStateChanged.mockReset().mockImplementation((_auth, cb) => {
    mocks.oyente = cb
    return () => {}
  })
  mocks.signOut.mockReset().mockResolvedValue(undefined)
  mocks.signInWithPopup.mockReset()
  mocks.signInWithRedirect.mockReset().mockResolvedValue(undefined)
  mocks.getRedirectResult.mockReset().mockResolvedValue(null)
  mocks.setCustomParameters.mockReset()
  getIdToken.mockReset().mockResolvedValue('token-nuevo')
  mocks.api.mockReset().mockImplementation(async (ruta: string) =>
    ruta === '/auth/google/negocio'
      ? { uid: 'g-1', nombre: 'N', correo: 'g@ejemplo.com', tipo: 'negocio', nuevaCuenta: true }
      : { tipo: 'negocio' },
  )
})

// Simula a Firebase: dentro del popup, onAuthStateChanged ya ve al usuario ANTES de que el popup se resuelva.
function popupConCarrera() {
  mocks.signInWithPopup.mockImplementation(async () => {
    mocks.auth.currentUser = usuarioGoogle
    await mocks.oyente!(usuarioGoogle)
    return { user: usuarioGoogle }
  })
}

describe('AuthContext: continuar con Google', () => {
  it('cuenta nueva: llama al endpoint sin cuerpo, refresca el token y deja la sesión sin que /auth/yo la cierre', async () => {
    await montar()
    popupConCarrera()

    let resultado: ResultadoGoogle | null = null
    await act(async () => { resultado = await contexto.iniciarSesionConGoogle() })

    expect(resultado).toEqual({ nuevaCuenta: true })
    expect(mocks.setCustomParameters).toHaveBeenCalledWith({ prompt: 'select_account' })
    expect(llamadasA('/auth/google/negocio')).toHaveLength(1)
    expect(llamadasA('/auth/google/negocio')[0][1]).toEqual({ method: 'POST', sinCola: true })
    expect(getIdToken).toHaveBeenCalledWith(true)
    // La carrera: el oyente vio al usuario dentro del popup y NO verificó ni cerró la sesión.
    expect(llamadasA('/auth/yo')).toHaveLength(0)
    expect(mocks.signOut).not.toHaveBeenCalled()
    expect(screen.getByText('Sesión: g-1')).toBeVisible()
  })

  it('cuenta existente: nuevaCuenta false', async () => {
    await montar()
    popupConCarrera()
    mocks.api.mockImplementation(async (ruta: string) =>
      ruta === '/auth/google/negocio' ? { tipo: 'negocio', nuevaCuenta: false } : { tipo: 'negocio' })

    let resultado: ResultadoGoogle | null = null
    await act(async () => { resultado = await contexto.iniciarSesionConGoogle() })

    expect(resultado).toEqual({ nuevaCuenta: false })
    expect(screen.getByText('Sesión: g-1')).toBeVisible()
  })

  it('tras prepararse la cuenta, la verificación de AuthContext vuelve a funcionar normal', async () => {
    await montar()
    popupConCarrera()
    await act(async () => { await contexto.iniciarSesionConGoogle() })

    // Ahora un cliente entra por otra vía: debe verificarse y sacarse como siempre.
    mocks.api.mockImplementation(async () => ({ tipo: 'cliente' }))
    await act(async () => { await mocks.oyente!({ uid: 'c-1' }) })

    expect(llamadasA('/auth/yo')).toHaveLength(1)
    expect(mocks.signOut).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Sin sesión')).toBeVisible()
  })

  it('403 de la API: cierra la sesión, muestra el mensaje de la API y no queda sesión', async () => {
    await montar()
    popupConCarrera()
    const mensaje = 'Esta cuenta ya está registrada como cliente. Usa otro correo para tu negocio.'
    mocks.api.mockImplementation(async (ruta: string) => {
      if (ruta === '/auth/google/negocio') throw new ErrorApi(403, mensaje)
      return { tipo: 'negocio' }
    })

    let resultado: ResultadoGoogle | null | undefined
    await act(async () => { resultado = await contexto.iniciarSesionConGoogle() })

    expect(resultado).toBeNull()
    expect(mocks.signOut).toHaveBeenCalledTimes(1)
    expect(ultimaAlerta()).toMatchObject({ icon: 'error', text: mensaje })
    expect(getIdToken).not.toHaveBeenCalled()
    expect(screen.getByText('Sin sesión')).toBeVisible()
  })

  it.each(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'])(
    'si la persona cierra el popup (%s) no hay error ni llamadas a la API',
    async (code) => {
      await montar()
      mocks.signInWithPopup.mockRejectedValue(Object.assign(new Error('cerrado'), { code }))

      let resultado: ResultadoGoogle | null | undefined
      await act(async () => { resultado = await contexto.iniciarSesionConGoogle() })

      expect(resultado).toBeNull()
      expect(llamadasAlertas()).toHaveLength(0)
      expect(mocks.api).not.toHaveBeenCalled()
      expect(mocks.signInWithRedirect).not.toHaveBeenCalled()
      expect(screen.getByText('Sin sesión')).toBeVisible()
    },
  )

  it.each(['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'])(
    'si el navegador no permite el popup (%s) usa signInWithRedirect',
    async (code) => {
      await montar()
      mocks.signInWithPopup.mockRejectedValue(Object.assign(new Error('bloqueado'), { code }))

      await act(async () => { await contexto.iniciarSesionConGoogle() })

      expect(mocks.signInWithRedirect).toHaveBeenCalledTimes(1)
      expect(llamadasAlertas()).toHaveLength(0)
      expect(localStorage.getItem('servia:google-redireccion')).toBe('1')
    },
  )

  it('al volver de la redirección procesa getRedirectResult sin que /auth/yo cierre la sesión', async () => {
    localStorage.setItem('servia:google-redireccion', '1')
    mocks.getRedirectResult.mockImplementation(async () => {
      mocks.auth.currentUser = usuarioGoogle
      await mocks.oyente!(usuarioGoogle)
      return { user: usuarioGoogle }
    })
    render(<AuthProvider><Espia /></AuthProvider>)

    expect(await screen.findByText('Sesión: g-1')).toBeVisible()
    expect(llamadasA('/auth/google/negocio')).toHaveLength(1)
    expect(llamadasA('/auth/yo')).toHaveLength(0)
    expect(mocks.signOut).not.toHaveBeenCalled()
    expect(getIdToken).toHaveBeenCalledWith(true)
    expect(contexto.leerBienvenidaGoogle()).toEqual({ nuevaCuenta: true })
    expect(contexto.cargando).toBe(false)
    expect(localStorage.getItem('servia:google-redireccion')).toBeNull()
  })

  it('sin conexión tras elegir cuenta: avisa, cierra la sesión y no deja nada a medias', async () => {
    await montar()
    popupConCarrera()
    mocks.api.mockImplementation(async (ruta: string) => {
      if (ruta === '/auth/google/negocio') throw new ErrorSinConexion(MENSAJE_REQUIERE_CONEXION)
      return { tipo: 'negocio' }
    })

    await act(async () => { await contexto.iniciarSesionConGoogle() })

    expect(ultimaAlerta()).toMatchObject({ icon: 'warning', title: 'Sin conexión', text: MENSAJE_REQUIERE_CONEXION })
    expect(mocks.signOut).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Sin sesión')).toBeVisible()
  })

  it('con navigator.onLine en false avisa sin abrir el popup', async () => {
    await montar()
    vi.stubGlobal('navigator', { ...navigator, onLine: false })

    await act(async () => { await contexto.iniciarSesionConGoogle() })
    vi.unstubAllGlobals()

    expect(mocks.signInWithPopup).not.toHaveBeenCalled()
    await waitFor(() => expect(ultimaAlerta()).toMatchObject({ title: 'Sin conexión' }))
  })
})
