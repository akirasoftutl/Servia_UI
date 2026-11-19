import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes } from 'react-router'
import { Sidebar } from './Sidebar'

vi.mock('../../contextos/AuthContext', () => ({ useAuth: () => ({ cerrarSesion: vi.fn() }) }))

it('B18 navega a Bloqueos desde Operaciones', async () => {
  render(<MemoryRouter initialEntries={['/']}><Sidebar /><Routes><Route path="/bloqueos" element={<p>Página de bloqueos</p>} /></Routes></MemoryRouter>)
  const enlace = screen.getByRole('button', { name: 'Bloqueos' })
  expect(enlace.closest('.nav-group')).toHaveTextContent('OPERACIONES')
  await userEvent.click(enlace)
  expect(await screen.findByText('Página de bloqueos')).toBeInTheDocument()
})

it('abre Reservas desde el menú lateral', async () => {
  const router = createMemoryRouter([
    { path: '/', element: <Sidebar /> },
    { path: '/reservas', element: <h1>Panel de reservas</h1> },
  ])
  render(<RouterProvider router={router} />)
  fireEvent.click(screen.getByRole('button', { name: 'Reservas' }))
  expect(await screen.findByRole('heading', { name: 'Panel de reservas' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/reservas')
})

it('C1 «Resumen» es el primer elemento de Principal y abre /resumen', async () => {
  const router = createMemoryRouter([
    { path: '/', element: <Sidebar /> },
    { path: '/resumen', element: <h1>Resumen del negocio</h1> },
  ])
  render(<RouterProvider router={router} />)
  const principal = screen.getByText('PRINCIPAL').closest('.nav-group') as HTMLElement
  expect(within(principal).getAllByRole('button')[0]).toHaveTextContent('Resumen')
  fireEvent.click(within(principal).getByRole('button', { name: 'Resumen' }))
  expect(await screen.findByRole('heading', { name: 'Resumen del negocio' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/resumen')
})

it('UI88 abre Estadísticas desde Operaciones', async () => {
  render(<MemoryRouter initialEntries={['/']}><Sidebar /><Routes><Route path="/estadisticas" element={<h1>Estadísticas del negocio</h1>} /></Routes></MemoryRouter>)
  const enlace = screen.getByRole('button', { name: 'Estadísticas' })
  expect(enlace.closest('.nav-group')).toHaveTextContent('OPERACIONES')
  await userEvent.click(enlace)
  expect(await screen.findByRole('heading', { name: 'Estadísticas del negocio' })).toBeVisible()
})
