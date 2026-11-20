import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes } from 'react-router'
import { NotificacionesContext, type NotificacionesContextValue } from '../../contextos/notificacionesContexto'
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
it('UI88 abre Estadísticas desde Operaciones', async () => {
  render(<MemoryRouter initialEntries={['/']}><Sidebar /><Routes><Route path="/estadisticas" element={<h1>Estadísticas del negocio</h1>} /></Routes></MemoryRouter>)
  const enlace = screen.getByRole('button', { name: 'Estadísticas' })
  expect(enlace.closest('.nav-group')).toHaveTextContent('OPERACIONES')
  await userEvent.click(enlace)
  expect(await screen.findByRole('heading', { name: 'Estadísticas del negocio' })).toBeVisible()
})

it('abre Clientes desde Principal después de Servicios y Resumen al inicio', async () => {
  const router = createMemoryRouter([
    { path: '/', element: <Sidebar /> },
    { path: '/clientes', element: <h1>Clientes del negocio</h1> },
  ])
  render(<RouterProvider router={router} />)
  const clientes = screen.getByRole('button', { name: 'Clientes' })
  const grupo = clientes.closest('.nav-group')!
  expect(grupo).toHaveTextContent('PRINCIPAL')
  expect([...grupo.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Resumen', 'Reservas', 'Servicios', 'Clientes', 'Avisos'])
  fireEvent.click(clientes)
  expect(await screen.findByRole('heading', { name: 'Clientes del negocio' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/clientes')
})

function pantalla(angosta: boolean) {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: angosta, addEventListener: vi.fn(), removeEventListener: vi.fn() })) })
}
it('C4 colapsa, abre y cierra por botón, Escape, fuera y navegación; gestiona foco', async () => {
  pantalla(true)
  render(barra())
  const menu = screen.getByRole('button', { name: 'Abrir menú' })
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  await userEvent.click(menu)
  const cerrar = screen.getAllByRole('button', { name: 'Cerrar menú' }).at(-1)!
  expect(cerrar).toHaveFocus()
  await userEvent.tab({ shift: true })
  expect(screen.getByRole('button', { name: 'Menú de la cuenta' })).toHaveFocus()
  await userEvent.tab()
  expect(cerrar).toHaveFocus()
  await userEvent.click(cerrar)
  expect(menu).toHaveFocus()
  await userEvent.click(menu)
  await userEvent.keyboard('{Escape}')
  expect(menu).toHaveAttribute('aria-expanded', 'false')
  expect(menu).toHaveFocus()
  await userEvent.click(menu)
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar menú al tocar fuera' }))
  expect(menu).toHaveAttribute('aria-expanded', 'false')
  await userEvent.click(menu)
  await userEvent.click(screen.getByRole('button', { name: 'Reservas' }))
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
})
it('C5 conserva las cuatro entradas visibles en escritorio', async () => {
  pantalla(false)
  render(barra())
  expect(screen.getByRole('complementary')).not.toHaveAttribute('hidden')
  for (const name of ['Reservas', 'Servicios', 'Bloqueos', 'Horario']) expect(screen.getByRole('button', { name })).toBeInTheDocument()
  await screen.findByText('Estética Ana')
})
it('C6 anuncia en español estado y destino del botón', async () => {
  pantalla(true)
  render(barra())
  const boton = screen.getByRole('button', { name: 'Abrir menú' })
  expect(boton).toHaveAttribute('aria-expanded', 'false')
  expect(boton).toHaveAttribute('aria-controls', screen.getByLabelText('Navegación del panel').id)
  await userEvent.click(boton)
  expect(boton).toHaveAccessibleName('Cerrar menú')
  expect(boton).toHaveAttribute('aria-expanded', 'true')
})

it('UI102 abre Notificaciones desde el menú móvil y lo cierra al navegar', async () => {
  pantalla(true)
  render(<MemoryRouter><Sidebar /><Routes><Route path="/preferencias-notificaciones" element={<h1>Preferencias push</h1>} /></Routes></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))
  await userEvent.click(screen.getByRole('button', { name: 'Notificaciones' }))
  expect(await screen.findByRole('heading', { name: 'Preferencias push' })).toBeVisible()
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute('aria-expanded', 'false')
})

it('UI69 muestra Avisos en PRINCIPAL con globo cuando hay no leídas y sin globo en 0', async () => {
  pantalla(false)
  const contextoBase: NotificacionesContextValue = {
    noLeidas: 3,
    versionLista: 0,
    actualizarNoLeidas: vi.fn(),
    decrementarNoLeidas: vi.fn(),
    refrescarNoLeidas: vi.fn(),
    abrirAviso: vi.fn(),
  }
  const { rerender } = render(
    <MemoryRouter initialEntries={['/resumen']}>
      <NotificacionesContext.Provider value={contextoBase}>
        <Sidebar />
        <Routes>
          <Route path="/avisos" element={<h1>Bandeja de avisos</h1>} />
        </Routes>
      </NotificacionesContext.Provider>
    </MemoryRouter>,
  )
  const botonAvisos = screen.getByRole('button', { name: /Avisos/ })
  expect(botonAvisos.closest('.nav-group')).toHaveTextContent('PRINCIPAL')
  expect(within(botonAvisos).getByText('3')).toHaveClass('panel-sidebar-globo')

  rerender(
    <MemoryRouter initialEntries={['/resumen']}>
      <NotificacionesContext.Provider value={{ ...contextoBase, noLeidas: 0 }}>
        <Sidebar />
        <Routes>
          <Route path="/avisos" element={<h1>Bandeja de avisos</h1>} />
        </Routes>
      </NotificacionesContext.Provider>
    </MemoryRouter>,
  )
  const botonSinGlobo = screen.getByRole('button', { name: 'Avisos' })
  expect(botonSinGlobo.querySelector('.panel-sidebar-globo')).toBeNull()

  await userEvent.click(botonSinGlobo)
  expect(await screen.findByRole('heading', { name: 'Bandeja de avisos' })).toBeVisible()
})
