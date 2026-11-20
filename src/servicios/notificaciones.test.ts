import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { api } from './api'
import {
  activarNotificacionesPush,
  consultarEstadoPermisoPush,
  construirUrlServiceWorkerPush,
  desactivarTokenPushActual,
  esIosSinInstalar,
  limpiarTokenPushGuardado,
  listarAvisos,
  marcarAvisoLeido,
  obtenerTokenPushGuardado,
  registrarTokenPush,
  sincronizarTokenPushSiPermitido,
  suscribirMensajesPrimerPlano,
} from './notificaciones'

const messagingMocks = vi.hoisted(() => ({
  getMessaging: vi.fn(() => ({ instancia: 'fcm' })),
  getToken: vi.fn(),
  isSupported: vi.fn(),
  onMessage: vi.fn(),
}))

vi.mock('firebase/messaging', () => messagingMocks)
vi.mock('./api', () => ({ api: vi.fn() }))
vi.mock('./firebase', () => ({
  app: { name: '[DEFAULT]' },
  configFirebase: {
    apiKey: 'clave-publica-prueba',
    authDomain: 'servia-prueba.firebaseapp.com',
    projectId: 'servia-prueba',
    messagingSenderId: '123456789',
    appId: '1:123456789:web:abc',
  },
}))

const apiMock = vi.mocked(api)

function configurarNavegadorPush(permiso: NotificationPermission = 'default') {
  const requestPermission = vi.fn().mockResolvedValue(permiso)
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: { permission: permiso, requestPermission },
  })
  const register = vi.fn().mockResolvedValue({ scope: '/firebase-cloud-messaging-push-scope' })
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { register },
  })
  return { requestPermission, register }
}

function configurarUserAgent(userAgent: string, standalone = false, platform = 'Linux x86_64', maxTouchPoints = 0) {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: userAgent })
  Object.defineProperty(navigator, 'platform', { configurable: true, value: platform })
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: maxTouchPoints })
  Object.defineProperty(navigator, 'standalone', { configurable: true, value: standalone })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query === '(display-mode: standalone)' ? standalone : false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

beforeEach(() => {
  apiMock.mockReset()
  messagingMocks.getMessaging.mockClear()
  messagingMocks.getToken.mockReset()
  messagingMocks.isSupported.mockReset().mockResolvedValue(true)
  messagingMocks.onMessage.mockReset()
  limpiarTokenPushGuardado()
  configurarUserAgent('Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0.0.0')
  configurarNavegadorPush('default')
  vi.stubEnv('VITE_FIREBASE_VAPID_KEY', 'vapid-publica-prueba')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('servicio de notificaciones', () => {
  it('lista avisos sin cursor y con cursor codificado', async () => {
    apiMock.mockResolvedValue({ items: [], noLeidas: 0, siguiente: null })
    await listarAvisos()
    expect(apiMock).toHaveBeenCalledWith('/notificaciones')
    await listarAvisos('v1.abc+123')
    expect(apiMock).toHaveBeenLastCalledWith('/notificaciones?cursor=v1.abc%2B123')
  })

  it('marca un aviso como leído con PATCH /notificaciones/{id}/leida', async () => {
    apiMock.mockResolvedValue({ id: 'av-1', leida: true })
    await marcarAvisoLeido('av-1')
    expect(apiMock).toHaveBeenCalledWith('/notificaciones/av-1/leida', { method: 'PATCH' })
  })

  it('construye la URL del service worker con la config pública sin valores fijos', () => {
    const url = construirUrlServiceWorkerPush()
    expect(url).toContain('/firebase-messaging-sw.js?')
    const params = new URL(url, 'https://panel.servia.test').searchParams
    expect(params.get('apiKey')).toBe('clave-publica-prueba')
    expect(params.get('projectId')).toBe('servia-prueba')
    expect(params.get('messagingSenderId')).toBe('123456789')
    expect(params.get('appId')).toBe('1:123456789:web:abc')
  })

  it('activa notificaciones push, registra SW con alcance propio y manda token web', async () => {
    const { requestPermission, register } = configurarNavegadorPush('default')
    requestPermission.mockResolvedValue('granted')
    messagingMocks.getToken.mockResolvedValue('token-fcm-web-1')
    apiMock.mockResolvedValue(undefined)

    const resultado = await activarNotificacionesPush()

    expect(resultado).toBe('granted')
    expect(requestPermission).toHaveBeenCalledTimes(1)
    expect(register).toHaveBeenCalledWith(
      expect.stringContaining('/firebase-messaging-sw.js?'),
      { scope: '/firebase-cloud-messaging-push-scope' },
    )
    expect(messagingMocks.getToken).toHaveBeenCalledWith(
      { instancia: 'fcm' },
      {
        vapidKey: 'vapid-publica-prueba',
        serviceWorkerRegistration: { scope: '/firebase-cloud-messaging-push-scope' },
      },
    )
    expect(apiMock).toHaveBeenCalledWith('/notificaciones/tokens', {
      method: 'POST',
      body: JSON.stringify({ token: 'token-fcm-web-1', plataforma: 'web' }),
    })
    expect(obtenerTokenPushGuardado()).toBe('token-fcm-web-1')
  })

  it('no registra token si el usuario niega el permiso', async () => {
    const { requestPermission } = configurarNavegadorPush('default')
    requestPermission.mockResolvedValue('denied')

    const resultado = await activarNotificacionesPush()

    expect(resultado).toBe('denied')
    expect(messagingMocks.getToken).not.toHaveBeenCalled()
    expect(apiMock).not.toHaveBeenCalled()
  })

  it('detecta iOS sin instalar, navegador sin soporte y permisos', async () => {
    configurarUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15', false, 'iPhone', 5)
    messagingMocks.isSupported.mockResolvedValue(false)
    expect(esIosSinInstalar()).toBe(true)
    expect(await consultarEstadoPermisoPush()).toBe('ios-sin-instalar')

    // iOS instalada como PWA sí puede continuar a consultar soporte/permiso
    configurarUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15', true, 'iPhone', 5)
    messagingMocks.isSupported.mockResolvedValue(true)
    configurarNavegadorPush('default')
    expect(esIosSinInstalar()).toBe(false)
    expect(await consultarEstadoPermisoPush()).toBe('default')

    // Navegador de escritorio sin soporte
    configurarUserAgent('Mozilla/5.0 (X11; Linux x86_64)')
    messagingMocks.isSupported.mockResolvedValue(false)
    expect(await consultarEstadoPermisoPush()).toBe('no-soportado')

    // Permiso denegado
    messagingMocks.isSupported.mockResolvedValue(true)
    configurarNavegadorPush('denied')
    expect(await consultarEstadoPermisoPush()).toBe('denied')
  })

  it('sincroniza token cuando el permiso ya fue concedido', async () => {
    configurarNavegadorPush('granted')
    messagingMocks.getToken.mockResolvedValue('token-existente')
    apiMock.mockResolvedValue(undefined)

    await sincronizarTokenPushSiPermitido()

    expect(apiMock).toHaveBeenCalledWith('/notificaciones/tokens', {
      method: 'POST',
      body: JSON.stringify({ token: 'token-existente', plataforma: 'web' }),
    })
  })

  it('desactiva el token guardado con DELETE /notificaciones/tokens y lo limpia', async () => {
    apiMock.mockResolvedValue(undefined)
    await registrarTokenPush('token-para-borrar')
    apiMock.mockClear()

    await desactivarTokenPushActual()

    expect(apiMock).toHaveBeenCalledWith('/notificaciones/tokens', {
      method: 'DELETE',
      body: JSON.stringify({ token: 'token-para-borrar' }),
    })
    expect(obtenerTokenPushGuardado()).toBeNull()
  })

  it('limpia el token aunque DELETE falle por red', async () => {
    apiMock.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await registrarTokenPush('token-fallo-red')

    await expect(desactivarTokenPushActual()).resolves.toBeUndefined()
    expect(obtenerTokenPushGuardado()).toBeNull()
  })

  it('suscribe a mensajes en primer plano con onMessage', async () => {
    let callbackMensaje: ((payload: unknown) => void) | undefined
    const desuscribirMock = vi.fn()
    messagingMocks.onMessage.mockImplementation((_m, cb) => {
      callbackMensaje = cb
      return desuscribirMock
    })

    const recibidos: unknown[] = []
    const desuscribir = await suscribirMensajesPrimerPlano((aviso) => recibidos.push(aviso))

    callbackMensaje?.({
      notification: { title: 'Nueva solicitud', body: 'Ana pidió Corte' },
      data: { reservaId: 'res-42', notificacionId: 'av-99' },
    })

    expect(recibidos).toEqual([
      {
        id: 'av-99',
        notificacionId: 'av-99',
        reservaId: 'res-42',
        titulo: 'Nueva solicitud',
        cuerpo: 'Ana pidió Corte',
      },
    ])
    desuscribir()
    expect(desuscribirMock).toHaveBeenCalledTimes(1)
  })
})

describe('service worker public/firebase-messaging-sw.js', () => {
  const fuenteSw = readFileSync('public/firebase-messaging-sw.js', 'utf8')

  function ejecutarSw(url = 'http://localhost:4173/firebase-messaging-sw.js?apiKey=k1&authDomain=d1&projectId=p1&messagingSenderId=m1&appId=a1') {
    const listeners: Record<string, (evento: unknown) => void> = {}
    let backgroundHandler: ((payload: unknown) => unknown) | undefined
    const initializeApp = vi.fn()
    const showNotification = vi.fn()
    const openWindow = vi.fn().mockResolvedValue(undefined)
    const matchAll = vi.fn().mockResolvedValue([])
    const importScripts = vi.fn()

    const selfObj = {
      location: new URL(url),
      addEventListener: vi.fn((tipo: string, fn: (evento: unknown) => void) => {
        listeners[tipo] = fn
      }),
      registration: { showNotification },
      clients: { openWindow, matchAll },
    }
    const firebaseObj = {
      apps: [],
      initializeApp,
      messaging: vi.fn(() => ({
        onBackgroundMessage: vi.fn((fn: (payload: unknown) => unknown) => {
          backgroundHandler = fn
        }),
      })),
    }

    runInNewContext(fuenteSw, {
      self: selfObj,
      URL,
      importScripts,
      firebase: firebaseObj,
    })

    return { listeners, getBackgroundHandler: () => backgroundHandler, initializeApp, showNotification, openWindow, matchAll, importScripts }
  }

  it('no tiene valores de Firebase escritos a mano y lee la configuración desde la URL', () => {
    expect(fuenteSw).not.toMatch(/AIza[0-9A-Za-z_-]{10,}/)
    expect(fuenteSw).not.toContain('import.meta.env')

    const sw = ejecutarSw()
    expect(sw.importScripts).toHaveBeenCalledTimes(1)
    expect(sw.initializeApp).toHaveBeenCalledWith({
      apiKey: 'k1',
      authDomain: 'd1',
      projectId: 'p1',
      messagingSenderId: 'm1',
      appId: 'a1',
    })
  })

  it('muestra el aviso en segundo plano para payloads solo de datos', () => {
    const sw = ejecutarSw()
    sw.getBackgroundHandler()?.({
      data: { titulo: 'Nueva solicitud', cuerpo: 'Ana reservó Corte', reservaId: 'res-7', notificacionId: 'av-7' },
    })
    expect(sw.showNotification).toHaveBeenCalledWith('Nueva solicitud', {
      body: 'Ana reservó Corte',
      icon: '/pwa-192x192.png',
      data: { titulo: 'Nueva solicitud', cuerpo: 'Ana reservó Corte', reservaId: 'res-7', notificacionId: 'av-7' },
    })
  })

  it('en notificationclick abre el detalle de la reserva cuando el panel está cerrado', async () => {
    const sw = ejecutarSw()
    let promesa!: Promise<unknown>
    const close = vi.fn()
    const stopImmediatePropagation = vi.fn()

    sw.listeners.notificationclick({
      notification: {
        data: { FCM_MSG: { data: { reservaId: 'res-55', notificacionId: 'av-55' } } },
        close,
      },
      stopImmediatePropagation,
      waitUntil: (p: Promise<unknown>) => {
        promesa = p
      },
    })

    await promesa
    expect(close).toHaveBeenCalledTimes(1)
    expect(stopImmediatePropagation).toHaveBeenCalledTimes(1)
    expect(sw.openWindow).toHaveBeenCalledWith('http://localhost:4173/reservas/res-55?notificacion=av-55')
  })

  it('en notificationclick enfoca y navega una pestaña abierta del panel al detalle de la reserva', async () => {
    const sw = ejecutarSw()
    const navigate = vi.fn().mockResolvedValue(undefined)
    const focus = vi.fn().mockResolvedValue(undefined)
    sw.matchAll.mockResolvedValue([{ url: 'http://localhost:4173/resumen', navigate, focus }])

    let promesa!: Promise<unknown>
    sw.listeners.notificationclick({
      notification: {
        data: { reservaId: 'res-88', notificacionId: 'av-88' },
        close: vi.fn(),
      },
      stopImmediatePropagation: vi.fn(),
      waitUntil: (p: Promise<unknown>) => {
        promesa = p
      },
    })

    await promesa
    expect(navigate).toHaveBeenCalledWith('http://localhost:4173/reservas/res-88?notificacion=av-88')
    expect(focus).toHaveBeenCalledTimes(1)
    expect(sw.openWindow).not.toHaveBeenCalled()
  })

  it('en notificationclick sin reservaId abre /avisos', async () => {
    const sw = ejecutarSw()
    let promesa!: Promise<unknown>
    sw.listeners.notificationclick({
      notification: { data: {}, close: vi.fn() },
      stopImmediatePropagation: vi.fn(),
      waitUntil: (p: Promise<unknown>) => {
        promesa = p
      },
    })
    await promesa
    expect(sw.openWindow).toHaveBeenCalledWith('http://localhost:4173/avisos')
  })
})
