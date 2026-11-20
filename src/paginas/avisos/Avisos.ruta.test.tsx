import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { rutas } from '../../router'

const sesion = vi.hoisted(() => ({ usuario: null as { uid: string } | null, cargando: false, cerrarSesion: vi.fn() }))
vi.mock('../../contextos/AuthContext', () => ({ useAuth: () => sesion }))
vi.mock('../../servicios/notificaciones', () => ({
  listarAvisos: vi.fn(() => new Promise(() => {})),
  marcarAvisoLeido: vi.fn(),
  consultarEstadoPermisoPush: vi.fn().mockResolvedValue('no-soportado'),
  activarNotificacionesPush: vi.fn(),
  sincronizarTokenPushSiPermitido: vi.fn(),
  suscribirMensajesPrimerPlano: vi.fn().mockResolvedValue(() => {}),
}))
vi.mock('../../componentes/layout/Layout.tsx', async () => {
  const { Outlet } = await import('react-router')
  return { Layout: () => <Outlet /> }
})
vi.mock('../login/Login', () => ({ Login: () => <h1>Iniciar sesión para entrar</h1> }))

it('protege la ruta /avisos sin sesión', async () => {
  sesion.usuario = null
  const router = createMemoryRouter(rutas, { initialEntries: ['/avisos'] })
  render(<RouterProvider router={router} />)
  expect(await screen.findByText('Iniciar sesión para entrar')).toBeVisible()
  expect(router.state.location.pathname).toBe('/login')
})

it('abre la página Avisos con sesión iniciada', async () => {
  sesion.usuario = { uid: 'negocio-simulado' }
  const router = createMemoryRouter(rutas, { initialEntries: ['/avisos'] })
  render(<RouterProvider router={router} />)
  expect(await screen.findByRole('heading', { name: 'Avisos', level: 1 })).toBeVisible()
  expect(screen.getByRole('status', { name: 'Cargando avisos' })).toBeVisible()
})
