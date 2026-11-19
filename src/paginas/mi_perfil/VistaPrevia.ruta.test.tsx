import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { rutas } from '../../router'

vi.mock('../../contextos/AuthContext', () => ({ useAuth: () => ({ usuario: null, cargando: false }) }))
vi.mock('../../componentes/layout/Layout.tsx', async () => {
  const { Outlet } = await import('react-router')
  return { Layout: () => <Outlet /> }
})
vi.mock('../login/Login', () => ({ Login: () => <h1>Iniciar sesión para entrar</h1> }))

it('C1 protege la ruta de vista previa dentro del panel', async () => {
  const router = createMemoryRouter(rutas, { initialEntries: ['/mi-perfil/vista-previa'] })
  render(<RouterProvider router={router} />)
  expect(await screen.findByText('Iniciar sesión para entrar')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/login')
})
