import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { NotificacionesProvider } from '../../contextos/NotificacionesProvider'
import { ErrorApi } from '../../servicios/api'
import { MENSAJE_ERROR_SERVIDOR } from '../../servicios/mensajeDeError'
import type { Aviso, EstadoPermisoPush } from '../../servicios/notificaciones'
import { Avisos } from './Avisos'

const notifMocks = vi.hoisted(() => ({
  listarAvisos: vi.fn(),
  marcarAvisoLeido: vi.fn(),
  consultarEstadoPermisoPush: vi.fn<() => Promise<EstadoPermisoPush>>(),
  activarNotificacionesPush: vi.fn(),
  sincronizarTokenPushSiPermitido: vi.fn(),
  suscribirMensajesPrimerPlano: vi.fn(),
}))

vi.mock('../../contextos/AuthContext', () => ({
  useAuth: () => ({ usuario: { uid: 'negocio-1', email: 'negocio@ejemplo.com' }, cargando: false, cerrarSesion: vi.fn() }),
}))
vi.mock('../../servicios/notificaciones', () => notifMocks)

const avisoNuevo: Aviso = {
  id: 'av-2',
  tipo: 'NUEVA_SOLICITUD',
  reservaId: 'res-200',
  titulo: 'Nueva solicitud',
  cuerpo: 'Ana pidió Corte para el 21/11/2026 a las 10:00.',
  leida: false,
  creadaEn: '2026-11-20T03:30:00.000Z',
}

const avisoCancelado: Aviso = {
  id: 'av-1',
  tipo: 'RESERVA_CANCELADA_CLIENTE',
  reservaId: 'res-100',
  titulo: 'Reserva cancelada por el cliente',
  cuerpo: 'Luis canceló su reserva SRV-123456 de Barba.',
  leida: true,
  creadaEn: '2026-11-19T18:00:00.000Z',
}

beforeEach(() => {
  notifMocks.listarAvisos.mockReset().mockResolvedValue({
    items: [avisoNuevo, avisoCancelado],
    noLeidas: 1,
    siguiente: null,
  })
  notifMocks.marcarAvisoLeido.mockReset().mockResolvedValue({ ...avisoNuevo, leida: true })
  notifMocks.consultarEstadoPermisoPush.mockReset().mockResolvedValue('default')
  notifMocks.activarNotificacionesPush.mockReset().mockResolvedValue('granted')
  notifMocks.sincronizarTokenPushSiPermitido.mockReset().mockResolvedValue(undefined)
  notifMocks.suscribirMensajesPrimerPlano.mockReset().mockResolvedValue(() => {})
})

function montarAvisos() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <NotificacionesProvider>
            <Avisos />
          </NotificacionesProvider>
        ),
      },
      {
        path: '/avisos',
        element: (
          <NotificacionesProvider>
            <Avisos />
          </NotificacionesProvider>
        ),
      },
      { path: '/reservas/:id', element: <h1>Detalle de reserva</h1> },
    ],
    { initialEntries: ['/avisos'] },
  )
  const vista = render(<RouterProvider router={router} />)
  return { router, vista }
}

it('muestra solicitud nueva y cancelación del más nuevo al más viejo, resalta no leídos y formatea fecha en México', async () => {
  montarAvisos()

  const botones = await screen.findAllByRole('button', { name: /solicitud|cancelada/i })
  expect(botones).toHaveLength(2)

  expect(botones[0]).toHaveClass('panel-item--no-leido')
  expect(within(botones[0]).getByText('Nueva solicitud')).toBeVisible()
  expect(within(botones[0]).getByText(avisoNuevo.cuerpo)).toBeVisible()
  expect(within(botones[0]).getByText('Sin leer')).toBeVisible()
  // 2026-11-20T03:30:00.000Z en America/Mexico_City (UTC-6) es 19 nov 2026, 21:30
  const tiempoNuevo = botones[0].querySelector('time')
  expect(tiempoNuevo).toHaveAttribute('datetime', avisoNuevo.creadaEn)
  expect(tiempoNuevo).toHaveTextContent(/19 nov 2026/)

  expect(botones[1]).not.toHaveClass('panel-item--no-leido')
  expect(within(botones[1]).getByText('Reserva cancelada por el cliente')).toBeVisible()
  expect(within(botones[1]).queryByText('Sin leer')).not.toBeInTheDocument()
  expect(screen.getByText('1 sin leer')).toBeVisible()
})

it('al tocar un aviso no leído llama PATCH /notificaciones/{id}/leida y abre el detalle de la reserva', async () => {
  const { router } = montarAvisos()

  const botonNoLeido = await screen.findByRole('button', { name: /Nueva solicitud/i })
  await userEvent.click(botonNoLeido)

  expect(notifMocks.marcarAvisoLeido).toHaveBeenCalledWith('av-2')
  expect(await screen.findByRole('heading', { name: 'Detalle de reserva' })).toBeVisible()
  expect(router.state.location.pathname).toBe('/reservas/res-200')
})

it('al tocar un aviso ya leído abre el detalle sin volver a marcar PATCH', async () => {
  const { router } = montarAvisos()

  const botonLeido = await screen.findByRole('button', { name: /Reserva cancelada por el cliente/i })
  await userEvent.click(botonLeido)

  expect(notifMocks.marcarAvisoLeido).not.toHaveBeenCalled()
  expect(await screen.findByRole('heading', { name: 'Detalle de reserva' })).toBeVisible()
  expect(router.state.location.pathname).toBe('/reservas/res-100')
})

it('pagina con siguiente usando Cargar más', async () => {
  notifMocks.listarAvisos.mockResolvedValue({
    items: [avisoNuevo],
    noLeidas: 1,
    siguiente: 'v1.cursor-pagina-2',
  })
  montarAvisos()

  expect(await screen.findByText('Nueva solicitud')).toBeVisible()
  const botonMas = screen.getByRole('button', { name: 'Cargar más' })

  notifMocks.listarAvisos.mockResolvedValueOnce({
    items: [avisoCancelado],
    noLeidas: 1,
    siguiente: null,
  })
  await userEvent.click(botonMas)

  expect(notifMocks.listarAvisos).toHaveBeenLastCalledWith('v1.cursor-pagina-2')
  expect(await screen.findByText('Reserva cancelada por el cliente')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument()
})

it('muestra estado vacío exacto con ilustración cuando no hay avisos', async () => {
  notifMocks.listarAvisos.mockResolvedValue({ items: [], noLeidas: 0, siguiente: null })
  const { vista } = montarAvisos()

  expect(await screen.findByText('Todavía no tienes avisos.')).toBeVisible()
  expect(vista.container.querySelector('.panel-ilustracion')).toBeInTheDocument()
})

it('muestra esqueleto durante la carga y estado de error con Reintentar al fallar', async () => {
  const rechazos: Array<(causa: Error) => void> = []
  notifMocks.listarAvisos.mockImplementation(
    () => new Promise((_, reject) => { rechazos.push(reject) }),
  )

  montarAvisos()

  expect(screen.getByRole('status', { name: 'Cargando avisos' }).querySelector('.panel-esqueleto-fila')).toBeInTheDocument()
  expect(screen.queryByText('Todavía no tienes avisos.')).not.toBeInTheDocument()

  await act(async () => {
    for (const rechazar of rechazos) rechazar(new TypeError('Failed to fetch'))
  })

  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar tus avisos.')
  notifMocks.listarAvisos.mockResolvedValue({ items: [avisoNuevo], noLeidas: 1, siguiente: null })
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText('Nueva solicitud')).toBeVisible()
})

it('muestra el recuadro de permiso por defecto y activa las notificaciones al hacer clic', async () => {
  notifMocks.consultarEstadoPermisoPush.mockResolvedValue('default')
  notifMocks.activarNotificacionesPush.mockResolvedValue('granted')
  montarAvisos()

  expect(
    await screen.findByText('Activa las notificaciones para enterarte de nuevas solicitudes aunque no tengas el panel abierto.'),
  ).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'Activar notificaciones' }))

  expect(notifMocks.activarNotificacionesPush).toHaveBeenCalledTimes(1)
  expect(await screen.findByText('Notificaciones activadas.')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Activar notificaciones' })).not.toBeInTheDocument()
})

it('muestra el mensaje de bloqueo cuando el permiso fue negado y conserva la lista', async () => {
  notifMocks.consultarEstadoPermisoPush.mockResolvedValue('denied')
  montarAvisos()

  expect(
    await screen.findByText('Bloqueaste las notificaciones. Puedes permitirlas desde la configuración del navegador.'),
  ).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Activar notificaciones' })).not.toBeInTheDocument()
  expect(await screen.findByText('Nueva solicitud')).toBeVisible()
})

it('muestra el mensaje para iPhone o iPad sin instalar y conserva la lista', async () => {
  notifMocks.consultarEstadoPermisoPush.mockResolvedValue('ios-sin-instalar')
  montarAvisos()

  expect(
    await screen.findByText('En iPhone, instala el panel en tu pantalla de inicio para recibir notificaciones (iOS 16.4 o posterior).'),
  ).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Activar notificaciones' })).not.toBeInTheDocument()
  expect(await screen.findByText('Nueva solicitud')).toBeVisible()
})

it('oculta el recuadro de permiso cuando el navegador no soporta push y mantiene la lista', async () => {
  notifMocks.consultarEstadoPermisoPush.mockResolvedValue('no-soportado')
  montarAvisos()

  expect(await screen.findByText('Nueva solicitud')).toBeVisible()
  expect(screen.queryByText(/Activa las notificaciones/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/Bloqueaste las notificaciones/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/En iPhone, instala el panel/i)).not.toBeInTheDocument()
})

it('cumple el sistema visual compartido del panel sin estilos ni valores sueltos', async () => {
  const { vista } = montarAvisos()
  await screen.findByText('Nueva solicitud')

  expect(vista.container.querySelector('.panel-pagina .panel-contenedor .panel-encabezado .panel-titulo')).toHaveTextContent('Avisos')
  expect(vista.container.querySelector('.panel-tarjeta')).toBeInTheDocument()
  expect(vista.container.querySelector('[style]')).toBeNull()

  const fuente = readFileSync('src/paginas/avisos/Avisos.tsx', 'utf8')
  expect(fuente).not.toMatch(/style=|\b\d+(?:px|rem)\b|#[\da-f]{3,8}\b|alert\(/i)
  expect(fuente).toContain("import '../../estilos/panel.css'")

  const clases = [...vista.container.querySelectorAll('[class]')].flatMap((n) => [...n.classList])
  expect(clases.every((c) => c.startsWith('panel-') || c.startsWith('btn-servia-') || c.startsWith('lucide'))).toBe(true)
})

it.each([
  [new ErrorApi(429, 'Demasiadas consultas de avisos.'), 'Demasiadas consultas de avisos.'],
  [new ErrorApi(500, 'Internal server error'), MENSAJE_ERROR_SERVIDOR],
  [new TypeError('Failed to fetch'), 'No se pudieron cargar tus avisos.'],
])('distingue 429, 500 y red al cargar avisos', async (error, esperado) => {
  notifMocks.listarAvisos.mockRejectedValue(error)
  montarAvisos()
  expect(await screen.findByRole('alert')).toHaveTextContent(esperado)
})

it.each([
  [new ErrorApi(429, 'Demasiadas peticiones.'), 'Demasiadas peticiones.'],
  [new ErrorApi(500, 'Internal server error'), MENSAJE_ERROR_SERVIDOR],
  [new TypeError('Failed to fetch'), 'No se pudieron cargar más avisos. Inténtalo de nuevo.'],
])('distingue 429, 500 y red al cargar más avisos', async (error, esperado) => {
  notifMocks.listarAvisos.mockResolvedValue({ items: [avisoNuevo], noLeidas: 1, siguiente: 'cursor-2' })
  montarAvisos()
  await screen.findByText('Nueva solicitud')
  notifMocks.listarAvisos.mockRejectedValueOnce(error)
  await userEvent.click(screen.getByRole('button', { name: 'Cargar más' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(esperado)
})

it.each([
  [new ErrorApi(429, 'Demasiados intentos de registro.'), 'Demasiados intentos de registro.'],
  [new ErrorApi(500, 'Internal server error'), MENSAJE_ERROR_SERVIDOR],
  [new TypeError('Failed to fetch'), 'No se pudieron activar las notificaciones. Inténtalo de nuevo.'],
])('distingue 429, 500 y red al activar notificaciones', async (error, esperado) => {
  notifMocks.activarNotificacionesPush.mockRejectedValueOnce(error)
  montarAvisos()
  await userEvent.click(await screen.findByRole('button', { name: 'Activar notificaciones' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(esperado)
})
