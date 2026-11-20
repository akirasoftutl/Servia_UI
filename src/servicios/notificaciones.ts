import type { FirebaseApp } from 'firebase/app'
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type MessagePayload,
  type Messaging,
} from 'firebase/messaging'
import { api } from './api'
import * as firebaseModulo from './firebase'

export interface Aviso {
  id: string
  tipo: string
  reservaId: string | null
  titulo: string
  cuerpo: string
  leida: boolean
  creadaEn: string
}

export interface PaginaAvisos {
  items: Aviso[]
  noLeidas: number
  siguiente: string | null
}

export interface AvisoEnPantalla {
  id: string
  notificacionId: string | null
  reservaId: string | null
  titulo: string
  cuerpo: string
}

export type EstadoPermisoPush = 'cargando' | 'ios-sin-instalar' | 'no-soportado' | 'default' | 'denied' | 'granted'

const CLAVE_TOKEN_PUSH = 'servia_fcm_token_web'
const ALCANCE_SW_FCM = '/firebase-cloud-messaging-push-scope'
let tokenPushEnMemoria: string | null = null

export async function listarAvisos(cursor?: string): Promise<PaginaAvisos> {
  const ruta = cursor ? `/notificaciones?cursor=${encodeURIComponent(cursor)}` : '/notificaciones'
  return api<PaginaAvisos>(ruta)
}

export async function marcarAvisoLeido(id: string): Promise<Aviso> {
  return api<Aviso>(`/notificaciones/${encodeURIComponent(id)}/leida`, { method: 'PATCH' })
}

export async function registrarTokenPush(token: string): Promise<void> {
  await api<void>('/notificaciones/tokens', {
    method: 'POST',
    body: JSON.stringify({ token, plataforma: 'web' }),
  })
  guardarTokenLocal(token)
}

export async function eliminarTokenPush(token: string): Promise<void> {
  await api<void>('/notificaciones/tokens', {
    method: 'DELETE',
    body: JSON.stringify({ token }),
  })
}

function guardarTokenLocal(token: string): void {
  tokenPushEnMemoria = token
  try {
    window.localStorage?.setItem(CLAVE_TOKEN_PUSH, token)
  } catch {
    // Algunos contextos bloquean localStorage; el token sigue en memoria.
  }
}

export function obtenerTokenPushGuardado(): string | null {
  if (tokenPushEnMemoria) return tokenPushEnMemoria
  try {
    return window.localStorage?.getItem(CLAVE_TOKEN_PUSH) ?? null
  } catch {
    return null
  }
}

export function limpiarTokenPushGuardado(): void {
  tokenPushEnMemoria = null
  try {
    window.localStorage?.removeItem(CLAVE_TOKEN_PUSH)
  } catch {
    // Ignoramos fallos de almacenamiento al limpiar.
  }
}

export function esIosSinInstalar(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
  const agente = navigator.userAgent ?? ''
  const esIos =
    /iPad|iPhone|iPod/i.test(agente) ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1)
  if (!esIos) return false
  const instalada =
    Boolean(window.matchMedia?.('(display-mode: standalone)').matches) ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return !instalada
}

function obtenerAppFirebase(): FirebaseApp | null {
  try {
    return firebaseModulo.app ?? null
  } catch {
    return null
  }
}

function obtenerConfigFirebase(): Record<string, string | undefined> {
  try {
    return firebaseModulo.configFirebase ?? {}
  } catch {
    return {}
  }
}

export function construirUrlServiceWorkerPush(): string {
  const parametros = new URLSearchParams()
  for (const [clave, valor] of Object.entries(obtenerConfigFirebase())) {
    if (valor) parametros.set(clave, valor)
  }
  const consulta = parametros.toString()
  return consulta ? `/firebase-messaging-sw.js?${consulta}` : '/firebase-messaging-sw.js'
}

export async function soportaPushWeb(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return false
  }
  try {
    return await isSupported()
  } catch {
    return false
  }
}

export async function consultarEstadoPermisoPush(): Promise<EstadoPermisoPush> {
  if (esIosSinInstalar()) return 'ios-sin-instalar'
  const soportado = await soportaPushWeb()
  if (!soportado) return 'no-soportado'
  return Notification.permission
}

async function obtenerInstanciaMessaging(): Promise<Messaging | null> {
  const app = obtenerAppFirebase()
  if (!app) return null
  if (!(await soportaPushWeb())) return null
  return getMessaging(app)
}

async function obtenerTokenFcm(): Promise<string | null> {
  const messaging = await obtenerInstanciaMessaging()
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
  if (!messaging || !vapidKey) return null

  const registro = await navigator.serviceWorker.register(construirUrlServiceWorkerPush(), {
    scope: ALCANCE_SW_FCM,
  })
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registro,
  })
  return token || null
}

export async function activarNotificacionesPush(): Promise<'granted' | 'denied' | 'default' | 'no-soportado'> {
  if (esIosSinInstalar() || !(await soportaPushWeb())) {
    return 'no-soportado'
  }
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') return permiso

  const token = await obtenerTokenFcm()
  if (!token) {
    throw new Error('No se pudo obtener el token de notificaciones.')
  }
  await registrarTokenPush(token)
  return 'granted'
}

export async function sincronizarTokenPushSiPermitido(): Promise<void> {
  if (esIosSinInstalar() || !(await soportaPushWeb())) return
  if (Notification.permission !== 'granted') return
  try {
    const token = await obtenerTokenFcm()
    if (token) {
      await registrarTokenPush(token)
    }
  } catch {
    // Si falla el registro en segundo plano, los avisos siguen en la lista.
  }
}

export async function desactivarTokenPushActual(): Promise<void> {
  const token = obtenerTokenPushGuardado()
  if (!token) return
  try {
    await eliminarTokenPush(token)
  } catch {
    // No impedimos cerrar sesión si falla la red o el servidor.
  } finally {
    limpiarTokenPushGuardado()
  }
}

function convertirMensajePrimerPlano(payload: MessagePayload): AvisoEnPantalla {
  const data = payload.data ?? {}
  const notificacionId = typeof data.notificacionId === 'string' && data.notificacionId ? data.notificacionId : null
  const reservaId = typeof data.reservaId === 'string' && data.reservaId ? data.reservaId : null
  const titulo = payload.notification?.title ?? data.titulo ?? 'Nuevo aviso'
  const cuerpo = payload.notification?.body ?? data.cuerpo ?? ''
  return {
    id: notificacionId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    notificacionId,
    reservaId,
    titulo,
    cuerpo,
  }
}

export async function suscribirMensajesPrimerPlano(
  alRecibir: (aviso: AvisoEnPantalla) => void,
): Promise<() => void> {
  const messaging = await obtenerInstanciaMessaging()
  if (!messaging) return () => {}
  return onMessage(messaging, (payload) => {
    alRecibir(convertirMensajePrimerPlano(payload))
  })
}
