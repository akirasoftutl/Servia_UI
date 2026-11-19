import { render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { rutas } from '../router'
import type { User } from 'firebase/auth'
import type { ReactNode } from 'react'
import { AuthProvider } from '../contextos/AuthContext'
import { vi } from 'vitest'

const sesion = vi.hoisted(() => ({ usuario: null as User | null, cargando: false }))
vi.mock('../contextos/AuthContext', async () => {
  const { createContext, useContext } = await import('react')
  const Contexto = createContext(sesion)
  return {
    useAuth: () => useContext(Contexto),
    AuthProvider: ({ children }: { children: ReactNode }) => (
      <Contexto.Provider value={{ ...sesion }}>{children}</Contexto.Provider>
    ),
  }
})
vi.mock('../servicios/api', () => ({
  api: vi.fn(async (ruta: string) => ruta === '/negocios/mio' ? { aceptaReservas: true } : []),
}))

// Simulamos Firebase para que no falle en el CI
vi.mock('../servicios/firebase', () => ({
  auth: {
    onAuthStateChanged: vi.fn((callback) => {
      callback(null);
      return () => {};
    }),
    signOut: vi.fn(),
  },
  firebaseConfigurado: true,
}));

function mostrar(ruta: string) {
  const router = createMemoryRouter(rutas, { initialEntries: [ruta] })
  const vista = render(<AuthProvider><RouterProvider router={router} /></AuthProvider>)
  return { router, ...vista }
}

beforeEach(() => {
  sesion.usuario = null
  sesion.cargando = false
})

describe('Inicio', () => {
  it('sin sesión muestra la landing con su barra superior', async () => {
    mostrar('/')
    expect(
      await screen.findByRole('heading', { name: /Una plataforma, infinitas posibilidades/i })
    ).toBeInTheDocument()
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Servia' })).toBeVisible()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('con sesión reemplaza / por /resumen sin mostrar la landing', async () => {
    sesion.usuario = { uid: 'negocio' } as User
    const { router } = mostrar('/')
    expect(screen.queryByRole('heading', { name: /Una plataforma, infinitas posibilidades/i })).not.toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe('/resumen'))
    expect(router.state.historyAction).toBe('REPLACE')
    expect(await screen.findByRole('heading', { name: 'Resumen', level: 1 })).toBeVisible()
  })

  it.each([null, { uid: 'negocio' } as User])('no muestra la landing ni redirige mientras cargando con usuario %j', async (usuario) => {
    sesion.usuario = usuario
    sesion.cargando = true
    const { router, rerender } = mostrar('/')
    expect(screen.getByRole('heading', { name: 'Cargando...' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: /Una plataforma, infinitas posibilidades/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    sesion.cargando = false
    rerender(<AuthProvider><RouterProvider router={router} /></AuthProvider>)
    if (usuario) {
      await waitFor(() => expect(router.state.location.pathname).toBe('/resumen'))
    } else {
      expect(await screen.findByRole('heading', { name: /Una plataforma, infinitas posibilidades/i })).toBeVisible()
      expect(screen.getByRole('banner')).toBeVisible()
    }
  })

  it('muestra la página de no encontrado en una ruta desconocida', async () => {
    mostrar('/no-existe')
    expect(await screen.findByRole('heading', { name: 'No encontramos esta página' })).toBeInTheDocument()
  })
})
