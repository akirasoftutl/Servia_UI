import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { readFileSync } from 'node:fs'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import { api, ErrorApi } from '../../servicios/api'
import { MENSAJE_ERROR_SERVIDOR } from '../../servicios/mensajeDeError'
import { Configuracion } from './Configuracion'
import { mockearConfirmacion, swalFireMock, ultimaAlerta } from '../../pruebas/mockAlertas'

const sesion = vi.hoisted(() => ({ usuario: null as unknown, cerrarSesion: vi.fn() }))
vi.mock('../../contextos/AuthContext', () => ({ useAuth: () => sesion }))
vi.mock('../../servicios/api', async (original) => ({
  ...(await original<typeof import('../../servicios/api')>()),
  api: vi.fn(),
}))
vi.mock('../../servicios/firebase', () => ({ auth: null }))
vi.mock('firebase/auth', async (original) => ({
  ...(await original<typeof import('firebase/auth')>()),
  EmailAuthProvider: { credential: vi.fn((correo: string, clave: string) => ({ correo, clave })) },
  reauthenticateWithCredential: vi.fn(),
  updatePassword: vi.fn(),
}))
const apiMock = vi.mocked(api)

const reportes = [
  { id: 'r1', asunto: 'No carga el horario', estado: 'abierto', creadaEn: '2026-11-18T16:00:00.000Z' },
  { id: 'r2', asunto: 'Error al guardar servicio', estado: 'abierto', creadaEn: '2026-11-19T16:00:00.000Z' },
  { id: 'r3', asunto: 'Pregunta sobre pagos', estado: 'abierto', creadaEn: '2026-11-17T16:00:00.000Z' },
  { id: 'r4', asunto: 'Reporte más viejo', estado: 'abierto', creadaEn: '2026-11-01T16:00:00.000Z' },
]
let listaReportes: unknown = reportes

beforeEach(() => {
  sesion.usuario = { uid: 'ana', email: 'ana@ejemplo.com', providerData: [{ providerId: 'password' }] }
  sesion.cerrarSesion = vi.fn().mockResolvedValue(undefined)
  listaReportes = reportes
  vi.mocked(reauthenticateWithCredential).mockReset().mockResolvedValue({} as never)
  vi.mocked(updatePassword).mockReset().mockResolvedValue(undefined)
  vi.mocked(EmailAuthProvider.credential).mockClear()
  apiMock.mockReset().mockImplementation(async (ruta: string, opciones?: RequestInit) => {
    if (ruta === '/negocios/mio') return { nombre: 'Estética Ana', aceptaReservas: true }
    if (ruta === '/notificaciones/preferencias') return { nuevaSolicitud: true, reservaCancelada: false, recordatorioCita: true }
    if (ruta === '/soporte/reportes/mios') {
      if (listaReportes instanceof Error) throw listaReportes
      return listaReportes
    }
    throw new Error(`Ruta sin simular: ${ruta} ${opciones?.method ?? ''}`)
  })
})

const pagina = () => {
  const router = createMemoryRouter([
    { path: '/configuracion', element: <Configuracion /> },
    { path: '/mi-perfil', element: <h1>Perfil del negocio</h1> },
    { path: '/ayuda', element: <h1>Página de ayuda</h1> },
    { path: '/soporte', element: <h1>Página de soporte</h1> },
    { path: '/login', element: <h1>Iniciar sesión</h1> },
  ], { initialEntries: ['/configuracion'] })
  render(<RouterProvider router={router} />)
  return router
}
const tarjeta = (nombre: string) => screen.getByRole('region', { name: nombre })

describe('UI109 página Configuración', () => {
  it('muestra la cabecera con el grupo Configuración y las cuatro tarjetas', async () => {
    pagina()
    expect(screen.getByRole('heading', { name: 'Configuración', level: 1 })).toBeVisible()
    expect(document.querySelector('.panel-eyebrow')).toHaveTextContent('Configuración')
    const titulos = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(titulos).toEqual(['Cuenta', 'Recepción de reservas', 'Notificaciones', 'Ayuda y soporte'])
    expect(await screen.findByRole('switch', { name: 'Nueva solicitud' })).toBeVisible()
  })
  it('no inventa funciones: sin eliminar cuenta, idioma ni tema', async () => {
    pagina()
    await screen.findByRole('switch', { name: 'Nueva solicitud' })
    expect(screen.queryByText(/eliminar|borrar cuenta|idioma|tema|oscuro/i)).not.toBeInTheDocument()
  })

  describe('tarjeta Cuenta', () => {
    it('muestra el correo de la sesión y abre Mi perfil', async () => {
      const router = pagina()
      const cuenta = tarjeta('Cuenta')
      expect(within(cuenta).getByText('ana@ejemplo.com')).toBeVisible()
      await userEvent.click(within(cuenta).getByRole('link', { name: 'Mi perfil' }))
      expect(router.state.location.pathname).toBe('/mi-perfil')
    })
    it('cambia la contraseña con el componente existente, dentro de la tarjeta', async () => {
      pagina()
      const cuenta = tarjeta('Cuenta')
      const subtitulo = within(cuenta).getByRole('heading', { name: 'Cambiar contraseña', level: 3 })
      expect(subtitulo).toBeVisible()
      // Título menor que el de la tarjeta, para que no parezca una tarjeta hermana.
      expect(subtitulo).toHaveClass('panel-item-titulo')
      expect(subtitulo).not.toHaveClass('panel-tarjeta-titulo')
      expect(within(cuenta).getByRole('heading', { name: 'Cuenta', level: 2 })).toHaveClass('panel-tarjeta-titulo')
      await userEvent.type(within(cuenta).getByLabelText('Contraseña actual'), 'Actual123')
      await userEvent.type(within(cuenta).getByLabelText('Contraseña nueva'), 'Nueva12345')
      await userEvent.type(within(cuenta).getByLabelText('Confirma la contraseña nueva'), 'Nueva12345')
      await userEvent.click(within(cuenta).getByRole('button', { name: 'Cambiar contraseña' }))
      expect(await within(cuenta).findByText(/cambiaste tu contraseña/)).toBeVisible()
      expect(updatePassword).toHaveBeenCalledWith(sesion.usuario, 'Nueva12345')
    })
    it('valida la contraseña nueva antes de llamar a Firebase', async () => {
      pagina()
      const cuenta = tarjeta('Cuenta')
      await userEvent.type(within(cuenta).getByLabelText('Contraseña actual'), 'Actual123')
      await userEvent.type(within(cuenta).getByLabelText('Contraseña nueva'), 'corta')
      await userEvent.click(within(cuenta).getByRole('button', { name: 'Cambiar contraseña' }))
      expect(await within(cuenta).findByRole('alert')).toHaveTextContent(/al menos 8 caracteres/)
      expect(updatePassword).not.toHaveBeenCalled()
    })
    it('pide confirmación antes de cerrar sesión y no cierra si se cancela', async () => {
      mockearConfirmacion(false)
      const router = pagina()
      await userEvent.click(within(tarjeta('Cuenta')).getByRole('button', { name: 'Cerrar sesión' }))
      expect(swalFireMock).toHaveBeenCalledTimes(1)
      expect(ultimaAlerta()).toMatchObject({ title: '¿Cerrar sesión?', showCancelButton: true })
      expect(sesion.cerrarSesion).not.toHaveBeenCalled()
      expect(router.state.location.pathname).toBe('/configuracion')
    })
    it('cierra la sesión y lleva al login al aceptar la confirmación', async () => {
      mockearConfirmacion(true)
      const router = pagina()
      await userEvent.click(within(tarjeta('Cuenta')).getByRole('button', { name: 'Cerrar sesión' }))
      expect(swalFireMock).toHaveBeenCalledTimes(1)
      expect(sesion.cerrarSesion).toHaveBeenCalledTimes(1)
      expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
      expect(router.state.location.pathname).toBe('/login')
    })
  })

  describe('tarjeta Recepción de reservas', () => {
    it('reutiliza el componente compartido: carga el estado del negocio y pide confirmar la pausa', async () => {
      mockearConfirmacion(false)
      pagina()
      const recepcion = tarjeta('Recepción de reservas')
      expect(recepcion).toHaveAttribute('id', 'recepcion-reservas')
      expect(apiMock).toHaveBeenCalledWith('/negocios/mio')
      const interruptor = await within(recepcion).findByRole('switch')
      await userEvent.click(interruptor)
      expect(ultimaAlerta()).toMatchObject({ title: '¿Pausar las reservas?', showCancelButton: true })
    })
  })

  describe('tarjeta Notificaciones', () => {
    it('muestra los tres interruptores con lo guardado y guarda un cambio', async () => {
      pagina()
      const notificaciones = tarjeta('Notificaciones')
      const solicitud = await within(notificaciones).findByRole('switch', { name: 'Nueva solicitud' })
      expect(solicitud).toHaveAttribute('aria-checked', 'true')
      expect(within(notificaciones).getByRole('switch', { name: 'Reserva cancelada por el cliente' })).toHaveAttribute('aria-checked', 'false')
      expect(within(notificaciones).getByRole('switch', { name: 'Recordatorio de cita' })).toHaveAttribute('aria-checked', 'true')
      apiMock.mockImplementationOnce(async () => ({ nuevaSolicitud: false, reservaCancelada: false, recordatorioCita: true }))
      await userEvent.click(solicitud)
      expect(apiMock).toHaveBeenCalledWith('/notificaciones/preferencias', { method: 'PUT', body: JSON.stringify({ nuevaSolicitud: false, reservaCancelada: false, recordatorioCita: true }) })
      expect(ultimaAlerta()).toMatchObject({ icon: 'success', text: 'Preferencias guardadas.' })
    })
    it('si las preferencias no cargan, ofrece reintentar sin afectar las demás tarjetas', async () => {
      apiMock.mockImplementation(async (ruta: string) => {
        if (ruta === '/notificaciones/preferencias') throw new Error('caído')
        if (ruta === '/soporte/reportes/mios') return reportes
        return { nombre: 'Estética Ana', aceptaReservas: true }
      })
      pagina()
      const notificaciones = tarjeta('Notificaciones')
      expect(await within(notificaciones).findByRole('button', { name: 'Reintentar' })).toBeVisible()
      expect(await within(tarjeta('Ayuda y soporte')).findByText('Error al guardar servicio')).toBeVisible()
    })
  })

  describe('tarjeta Ayuda y soporte', () => {
    it('enlaza a /ayuda y /soporte', async () => {
      const router = pagina()
      const ayuda = tarjeta('Ayuda y soporte')
      expect(within(ayuda).getByRole('link', { name: /Preguntas frecuentes/ })).toHaveAttribute('href', '/ayuda')
      await userEvent.click(within(ayuda).getByRole('link', { name: /Reportar un problema/ }))
      expect(router.state.location.pathname).toBe('/soporte')
    })
    it('lista solo los tres reportes más recientes, del más nuevo al más viejo', async () => {
      pagina()
      const ayuda = tarjeta('Ayuda y soporte')
      await within(ayuda).findByText('Error al guardar servicio')
      const asuntos = within(ayuda).getAllByRole('article').map((a) => within(a).getByRole('heading').textContent)
      expect(asuntos).toEqual(['Error al guardar servicio', 'No carga el horario', 'Pregunta sobre pagos'])
      expect(within(ayuda).queryByText('Reporte más viejo')).not.toBeInTheDocument()
    })
    it('avisa cuando todavía no hay reportes', async () => {
      listaReportes = []
      pagina()
      expect(await within(tarjeta('Ayuda y soporte')).findByText('Todavía no has enviado reportes.')).toBeVisible()
    })
    it('si falla la carga muestra el error, deja los enlaces y reintenta', async () => {
      listaReportes = new Error('sin red')
      pagina()
      const ayuda = tarjeta('Ayuda y soporte')
      expect(await within(ayuda).findByRole('alert')).toHaveTextContent('No pudimos cargar tus reportes.')
      expect(within(ayuda).getByRole('link', { name: /Reportar un problema/ })).toBeVisible()
      listaReportes = reportes
      await userEvent.click(within(ayuda).getByRole('button', { name: 'Reintentar' }))
      expect(await within(ayuda).findByText('Error al guardar servicio')).toBeVisible()
    })
    it.each([
      [new ErrorApi(429, 'Demasiadas solicitudes; inténtalo más tarde.'), 'Demasiadas solicitudes; inténtalo más tarde.'],
      [new ErrorApi(500, 'Internal server error'), MENSAJE_ERROR_SERVIDOR],
      [new TypeError('Failed to fetch'), 'No pudimos cargar tus reportes.'],
    ])('distingue 429, 500 y fallo de red al cargar los últimos reportes', async (error, esperado) => {
      listaReportes = error
      pagina()
      const ayuda = tarjeta('Ayuda y soporte')
      expect(await within(ayuda).findByRole('alert')).toHaveTextContent(esperado)
    })
  })

  it('usa solo clases y variables del sistema del panel, sin colores ni medidas sueltas', () => {
    const fuente = readFileSync('src/paginas/configuracion/Configuracion.tsx', 'utf8')
    expect(fuente).not.toMatch(/#[0-9a-f]{3,8}\b|\d\s*(px|rem)\b|style=\{/i)
    expect(fuente).not.toContain('console.log')
  })
})

describe('UI109 Recepción de reservas y Cambiar contraseña viven en Configuración, no en Mi perfil', () => {
  it('Mi perfil ya no las muestra', async () => {
    const { MiPerfil } = await import('../mi_perfil/MiPerfil')
    const router = createMemoryRouter([{ path: '/', element: <MiPerfil /> }])
    render(<RouterProvider router={router} />)
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('region', { name: 'Recepción de reservas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Cambiar contraseña' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Contraseña actual')).not.toBeInTheDocument()
  })
  it('Configuración sí las muestra (control negativo de la prueba anterior)', async () => {
    pagina()
    expect(screen.getByRole('region', { name: 'Recepción de reservas' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Cambiar contraseña' })).toBeVisible()
  })
})
