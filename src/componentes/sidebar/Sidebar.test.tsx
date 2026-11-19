import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes } from 'react-router'
import { Sidebar } from './Sidebar'

const sesion = vi.hoisted(() => ({ usuario: { uid: 'ana', email: 'ana@ejemplo.com' } }))
vi.mock('../../contextos/AuthContext', () => ({ useAuth: () => ({ ...sesion, cerrarSesion: vi.fn() }) }))
vi.mock('../../servicios/api', () => ({ api: vi.fn() }))
import { api } from '../../servicios/api'
const apiMock = vi.mocked(api)
beforeEach(() => {
  sesion.usuario = { uid: 'ana', email: 'ana@ejemplo.com' }
  apiMock.mockReset().mockResolvedValue({ nombre: 'Estética Ana' })
})
const barra = () => <MemoryRouter><Sidebar /></MemoryRouter>

it('C1 muestra nombre, correo e inicial de la sesión', async () => {
  render(barra())
  expect(await screen.findByText('Estética Ana')).toBeInTheDocument()
  expect(screen.getByText('ana@ejemplo.com')).toBeInTheDocument()
  expect(document.querySelector('.avatar')).toHaveTextContent('E')
  expect(screen.queryByText('Urielees')).not.toBeInTheDocument()
  expect(apiMock).toHaveBeenCalledWith('/negocios/mio')
})
it('C2 respalda con el correo durante la carga y ante falla', async () => {
  let rechazar!: (error: Error) => void
  apiMock.mockImplementation(() => new Promise((_, reject) => { rechazar = reject }))
  render(barra())
  expect(document.querySelector('.user-name')).toHaveTextContent('ana@ejemplo.com')
  await act(async () => rechazar(new Error('Sin conexión')))
  expect(document.querySelector('.user-name')).toHaveTextContent('ana@ejemplo.com')
  expect(screen.queryByText('Sin conexión')).not.toBeInTheDocument()
})
it('C3 descarta el nombre previo y respuestas tardías al cambiar de cuenta', async () => {
  const vista = render(barra())
  await screen.findByText('Estética Ana')
  let resolver!: (valor: unknown) => void
  apiMock.mockImplementationOnce(() => new Promise(resolve => { resolver = resolve }))
  sesion.usuario = { uid: 'bea', email: 'bea@ejemplo.com' }
  vista.rerender(barra())
  expect(screen.queryByText('Estética Ana')).not.toBeInTheDocument()
  expect(document.querySelector('.user-name')).toHaveTextContent('bea@ejemplo.com')
  sesion.usuario = { uid: 'carla', email: 'carla@ejemplo.com' }
  apiMock.mockResolvedValue({ nombre: 'Salón Carla' })
  vista.rerender(barra())
  await screen.findByText('Salón Carla')
  await act(async () => resolver({ nombre: 'Salón Bea' }))
  expect(screen.queryByText('Salón Bea')).not.toBeInTheDocument()
  expect(screen.getByText('Salón Carla')).toBeInTheDocument()
})

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
