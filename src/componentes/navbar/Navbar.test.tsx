/// <reference types="node" />
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { readFileSync } from 'node:fs'
import Navbar from './Navbar'

vi.mock('../../contextos/AuthContext', () => ({
  useAuth: () => ({ usuario: null, cargando: false, cerrarSesion: vi.fn() }),
}))

// Vitest omite el CSS por defecto; usamos el real para verificar el menú oculto.
const estilos = document.createElement('style')
beforeAll(() => {
  estilos.textContent = readFileSync('src/componentes/navbar/Navbar.css', 'utf8')
  document.head.append(estilos)
})
afterAll(() => estilos.remove())

function mostrar() {
  // La barra permanece montada para comprobar el cierre además de la navegación.
  const router = createMemoryRouter([{
    path: '/',
    element: <><Navbar /><Outlet /></>,
    children: [
      { path: 'login', element: <h1>Inicio de sesión</h1> },
      { path: 'registro-negocio', element: <h1>Registro del negocio</h1> },
    ],
  }])
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
})
