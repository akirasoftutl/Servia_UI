import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { User } from 'firebase/auth'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { rutas } from '../router'

// Sesión simulada con suscripción, para poder cambiarla "en vivo" como hace Firebase al iniciar sesión
const sesion = vi.hoisted(() => {
  const oyentes = new Set<() => void>()
  const estado = { usuario: null as User | null, cargando: false }
  return {
    estado,
    oyentes,
    poner(cambio: Partial<typeof estado>) {
      Object.assign(estado, cambio)
      oyentes.forEach((o) => o())
    },
  }
})
vi.mock('../contextos/AuthContext', async () => {
  const { useSyncExternalStore } = await import('react')
  const suscribir = (cb: () => void) => { sesion.oyentes.add(cb); return () => { sesion.oyentes.delete(cb) } }
  const instantanea = () => JSON.stringify(sesion.estado)
  return {
    useAuth: () => JSON.parse(useSyncExternalStore(suscribir, instantanea)) as { usuario: User | null; cargando: boolean },
    AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  }
})

const iniciarSesionFirebase = vi.hoisted(() => vi.fn())
vi.mock('firebase/auth', () => ({ signInWithEmailAndPassword: iniciarSesionFirebase }))
vi.mock('../servicios/firebase', () => ({ auth: { signOut: vi.fn() }, firebaseConfigurado: true }))
const api = vi.hoisted(() => vi.fn())
vi.mock('../servicios/api', () => ({ api }))

function mostrar(ruta: string) {
  const router = createMemoryRouter(rutas, { initialEntries: [ruta] })
  render(<RouterProvider router={router} />)
  // Rutas por las que pasó; sirve para comprobar que nunca se visitó /servicios en un flujo exitoso
  const visitadas: string[] = [router.state.location.pathname]
  router.subscribe((estado) => visitadas.push(estado.location.pathname))
  return Object.assign(router, { visitadas })
}

const formularioLogin = () => screen.queryByText('Inicia sesión para administrar tu negocio')
const formularioRegistro = () => screen.queryByText('Registra tu negocio para administrar tus servicios')

beforeEach(() => {
  sesion.poner({ usuario: null, cargando: false })
  api.mockReset()
  api.mockImplementation(async (ruta: string) => ruta === '/negocios/mio' ? { aceptaReservas: true } : [])
  iniciarSesionFirebase.mockReset()
})

describe('RutaSoloVisitantes', () => {
  it.each(['/login', '/registro-negocio'])('con sesión, %s reemplaza por /resumen sin mostrar el formulario', async (ruta) => {
    sesion.poner({ usuario: { uid: 'negocio' } as User })
    const router = mostrar(ruta)
    expect(formularioLogin()).not.toBeInTheDocument()
    expect(formularioRegistro()).not.toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe('/resumen'))
    expect(router.state.historyAction).toBe('REPLACE')
    expect(await screen.findByRole('heading', { name: 'Resumen', level: 1 })).toBeVisible()
  })

  it('sin sesión, /login y /registro-negocio muestran su formulario', async () => {
    const login = mostrar('/login')
    expect(await screen.findByText('Inicia sesión para administrar tu negocio')).toBeVisible()
    expect(login.state.location.pathname).toBe('/login')
  })

  it('sin sesión, /registro-negocio muestra el formulario de registro', async () => {
    const router = mostrar('/registro-negocio')
    expect(await screen.findByText('Registra tu negocio para administrar tus servicios')).toBeVisible()
    expect(router.state.location.pathname).toBe('/registro-negocio')
  })

  it.each(['/login', '/registro-negocio'])('mientras cargando, %s no muestra el formulario ni redirige; al resolver con sesión redirige', async (ruta) => {
    sesion.poner({ usuario: { uid: 'negocio' } as User, cargando: true })
    const router = mostrar(ruta)
    expect(screen.getByRole('heading', { name: 'Cargando...' })).toBeVisible()
    expect(formularioLogin()).not.toBeInTheDocument()
    expect(formularioRegistro()).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe(ruta)
    act(() => sesion.poner({ cargando: false }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/resumen'))
  })

  it('mientras cargando y sin sesión al resolver, muestra el formulario', async () => {
    sesion.poner({ cargando: true })
    const router = mostrar('/login')
    expect(screen.getByRole('heading', { name: 'Cargando...' })).toBeVisible()
    expect(formularioLogin()).not.toBeInTheDocument()
    act(() => sesion.poner({ cargando: false }))
    expect(await screen.findByText('Inicia sesión para administrar tu negocio')).toBeVisible()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('login exitoso desde sin sesión va al Resumen (/resumen)', async () => {
    const usuario = userEvent.setup()
    iniciarSesionFirebase.mockImplementation(async () => { sesion.poner({ usuario: { uid: 'negocio' } as User }) })
    api.mockImplementation(async (ruta: string) => ruta === '/auth/yo' ? { tipo: 'negocio' } : ruta === '/negocios/mio' ? { aceptaReservas: true } : [])
    const router = mostrar('/login')
    await usuario.type(await screen.findByPlaceholderText('contacto@tunegocio.com'), 'a@b.com')
    await usuario.type(screen.getByPlaceholderText('Ingresa tu contraseña'), 'secreta123')
    await usuario.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    await waitFor(() => expect(api).toHaveBeenCalledWith('/auth/yo'))
    // La sesión ya cambió, pero la guarda no debe redirigir: el destino lo pone el formulario
    expect(router.state.location.pathname).toBe('/login')
    expect(formularioLogin()).toBeVisible()
    await waitFor(() => expect(router.state.location.pathname).toBe('/resumen'), { timeout: 4000 })
    expect(router.visitadas).not.toContain('/servicios')
  })

  it('registro exitoso desde sin sesión conserva su destino /mi-perfil con el aviso', async () => {
    const usuario = userEvent.setup()
    iniciarSesionFirebase.mockImplementation(async () => { sesion.poner({ usuario: { uid: 'negocio' } as User }) })
    const router = mostrar('/registro-negocio')
    await usuario.type(await screen.findByPlaceholderText('Ej. Barbería El Bigote'), 'Barbería Uno')
    await usuario.type(screen.getByPlaceholderText('contacto@tunegocio.com'), 'a@b.com')
    await usuario.type(screen.getByPlaceholderText('Ej. 4771234567'), '4771234567')
    await usuario.type(screen.getByPlaceholderText('Mínimo 8 caracteres'), 'secreta123')
    await usuario.click(screen.getByRole('button', { name: 'REGISTRARSE' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/mi-perfil'))
    expect(router.visitadas).not.toContain('/servicios')
    expect(router.state.location.state).toEqual({ aviso: 'Completa tu perfil para poder publicar servicios' })
  })
})
