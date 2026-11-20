import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes } from 'react-router'
import { Layout } from '../componentes/layout/Layout'
import type { AvisoEnPantalla } from '../servicios/notificaciones'

const sesion = vi.hoisted(() => ({
  usuario: { uid: 'negocio-a', email: 'a@ejemplo.com' } as { uid: string; email: string } | null,
  cargando: false,
  cerrarSesion: vi.fn(),
}))

const notifMocks = vi.hoisted(() => ({
  listarAvisos: vi.fn(),
  marcarAvisoLeido: vi.fn(),
  sincronizarTokenPushSiPermitido: vi.fn(),
  suscribirMensajesPrimerPlano: vi.fn(),
}))

vi.mock('./AuthContext', () => ({ useAuth: () => sesion }))
vi.mock('../servicios/api', () => ({ api: vi.fn().mockResolvedValue({ nombre: 'Salón Ana' }) }))
vi.mock('../servicios/notificaciones', () => notifMocks)

let dispararPush: ((aviso: AvisoEnPantalla) => void) | null = null

beforeEach(() => {
  dispararPush = null
  sesion.usuario = { uid: 'negocio-a', email: 'a@ejemplo.com' }
  notifMocks.listarAvisos.mockReset().mockResolvedValue({ items: [], noLeidas: 1, siguiente: null })
  notifMocks.marcarAvisoLeido.mockReset().mockResolvedValue({ id: 'av-1', leida: true })
  notifMocks.sincronizarTokenPushSiPermitido.mockReset().mockResolvedValue(undefined)
  notifMocks.suscribirMensajesPrimerPlano.mockReset().mockImplementation(async (cb) => {
    dispararPush = cb
    return () => {
      dispararPush = null
    }
  })
})

function montarConLayout(rutaInicial = '/resumen') {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <Layout />,
        children: [
          { path: 'resumen', element: <h1>Resumen</h1> },
          { path: 'reservas/:id', element: <h1>Detalle de reserva</h1> },
          { path: 'avisos', element: <h1>Página de avisos</h1> },
        ],
      },
    ],
    { initialEntries: [rutaInicial] },
  )
  const vista = render(<RouterProvider router={router} />)
  return { router, vista }
}

it('muestra el globo inicial, recibe push en primer plano con Ver, marca leída y abre la reserva', async () => {
  const { router } = montarConLayout()

  const botonAvisos = await screen.findByRole('button', { name: /Avisos/ })
  expect(await screen.findByText('1')).toHaveClass('panel-sidebar-globo')

  notifMocks.listarAvisos.mockResolvedValueOnce({ items: [], noLeidas: 2, siguiente: null })
  await act(async () => {
    dispararPush?.({
      id: 'av-2',
      notificacionId: 'av-2',
      reservaId: 'res-77',
      titulo: 'Nueva solicitud',
      cuerpo: 'Luis solicitó Corte.',
    })
  })

  expect(await screen.findByText('Nueva solicitud')).toBeVisible()
  expect(screen.getByText('Luis solicitó Corte.')).toBeVisible()
  expect(botonAvisos.querySelector('.panel-sidebar-globo')).toHaveTextContent('2')

  await userEvent.click(screen.getByRole('button', { name: 'Ver' }))

  expect(notifMocks.marcarAvisoLeido).toHaveBeenCalledWith('av-2')
  expect(await screen.findByRole('heading', { name: 'Detalle de reserva' })).toBeVisible()
  expect(router.state.location.pathname).toBe('/reservas/res-77')
  expect(botonAvisos.querySelector('.panel-sidebar-globo')).toHaveTextContent('1')
})

it('al llegar desde push en segundo plano con ?notificacion= marca el aviso como leído y limpia la URL', async () => {
  notifMocks.listarAvisos
    .mockResolvedValueOnce({ items: [], noLeidas: 2, siguiente: null })
    .mockResolvedValueOnce({ items: [], noLeidas: 1, siguiente: null })

  const { router } = montarConLayout('/reservas/res-90?notificacion=av-90')

  expect(await screen.findByRole('heading', { name: 'Detalle de reserva' })).toBeVisible()
  expect(notifMocks.marcarAvisoLeido).toHaveBeenCalledWith('av-90')
  expect(router.state.location.pathname).toBe('/reservas/res-90')
  expect(router.state.location.search).toBe('')
})

it('RN-46 al cambiar de cuenta reinicia el contador y descarta avisos de la cuenta anterior', async () => {
  notifMocks.listarAvisos.mockResolvedValueOnce({ items: [], noLeidas: 4, siguiente: null })
  const arbol = () => (
    <MemoryRouter initialEntries={['/resumen']}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="resumen" element={<h1>Resumen</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
  const vista = render(arbol())

  expect(await screen.findByText('4')).toHaveClass('panel-sidebar-globo')

  sesion.usuario = { uid: 'negocio-b', email: 'b@ejemplo.com' }
  notifMocks.listarAvisos.mockResolvedValueOnce({ items: [], noLeidas: 0, siguiente: null })
  vista.rerender(arbol())

  expect(await screen.findByText('b@ejemplo.com')).toBeVisible()
  expect(document.querySelector('.panel-sidebar-globo')).toBeNull()
})
