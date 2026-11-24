/// <reference types="node" />
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { readFileSync } from 'node:fs'
import Navbar from './Navbar'

const sesion = vi.hoisted(() => ({ usuario: null as unknown, cargando: false, cerrarSesion: vi.fn() }))
vi.mock('../../contextos/AuthContext', () => ({ useAuth: () => sesion }))
beforeEach(() => {
  sesion.usuario = null
  sesion.cerrarSesion = vi.fn().mockResolvedValue(undefined)
})

// Vitest omite el CSS por defecto; usamos el real para verificar el menú oculto.
const estilos = document.createElement('style')
beforeAll(() => {
  estilos.textContent = readFileSync('src/componentes/navbar/Navbar.css', 'utf8')
  document.head.append(estilos)
})
afterAll(() => estilos.remove())

function mostrar(entradas?: string[], indice?: number) {
  // La barra permanece montada para comprobar el cierre además de la navegación.
  const router = createMemoryRouter([{
    path: '/',
    element: <><Navbar /><Outlet /></>,
    children: [
      { index: true, element: <h1>Landing</h1> },
      { path: 'resumen', element: <h1>Resumen</h1> },
      { path: 'login', element: <h1>Inicio de sesión</h1> },
      { path: 'registro-negocio', element: <h1>Registro del negocio</h1> },
    ],
  }], { initialEntries: entradas, initialIndex: indice })
  render(<RouterProvider router={router} />)
  return router
}

describe('Accesos de la barra de la landing', () => {
  it('muestra Inicia sesión fuera del menú como botón oscuro y navega a /login', async () => {
    const router = mostrar()
    const barra = screen.getByRole('banner')
    const login = within(barra).getByRole('link', { name: 'Inicia sesión' })
    expect(login).toBeVisible()
    expect(login).toHaveClass('btn', 'btn--dark')
    expect(login).toHaveAttribute('href', '/login')
    expect(login.closest('.menu-dropdown')).toBeNull()
    expect(within(barra).queryByRole('link', { name: 'Regístrate' })).not.toBeInTheDocument()
    const menu = screen.getByRole('button', { name: 'Abrir o cerrar menú' })
    await userEvent.click(menu)
    await userEvent.click(login)
    expect(router.state.location.pathname).toBe('/login')
    expect(screen.getByRole('heading', { name: 'Inicio de sesión' })).toBeVisible()
    expect(menu).toHaveAttribute('aria-expanded', 'false')
  })

  it('muestra Regístrate dentro del menú morado, navega a /registro-negocio y cierra el menú', async () => {
    const router = mostrar()
    const menu = screen.getByRole('button', { name: 'Abrir o cerrar menú' })
    await userEvent.click(menu)
    const registro = screen.getByRole('link', { name: 'Regístrate' })
    expect(registro).toBeVisible()
    expect(registro).toHaveClass('menu-dropdown__link--purple')
    expect(registro).toHaveAttribute('href', '/registro-negocio')
    expect(registro.closest('.menu-dropdown')).not.toBeNull()
    await userEvent.click(registro)
    expect(router.state.location.pathname).toBe('/registro-negocio')
    expect(screen.getByRole('heading', { name: 'Registro del negocio' })).toBeVisible()
    expect(menu).toHaveAttribute('aria-expanded', 'false')
    expect(registro).not.toBeVisible()
  })

  it('al cerrar sesión lleva a /login y «atrás» regresa a la landing, no al panel', async () => {
    sesion.usuario = { uid: 'ana' }
    const router = mostrar(['/', '/resumen'], 1)
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(sesion.cerrarSesion).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('heading', { name: 'Inicio de sesión' })).toBeVisible()
    expect(router.state.location.pathname).toBe('/login')
    await act(async () => { await router.navigate(-1) })
    expect(router.state.location.pathname).toBe('/')
  })
})
