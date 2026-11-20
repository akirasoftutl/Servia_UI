/* Service worker de Firebase Cloud Messaging para el panel de Servia (MVP-29).
 * La configuración pública llega en los parámetros de la URL al registrarlo,
 * sin valores escritos a mano en el repositorio. */

const VERSION_FIREBASE = '13.1.0'

if (typeof importScripts === 'function') {
  importScripts(
    `https://www.gstatic.com/firebasejs/${VERSION_FIREBASE}/firebase-app-compat.js`,
    `https://www.gstatic.com/firebasejs/${VERSION_FIREBASE}/firebase-messaging-compat.js`,
  )
}

function leerConfigDeUrl() {
  const parametros = new URL(self.location.href).searchParams
  const config = {
    apiKey: parametros.get('apiKey') || '',
    authDomain: parametros.get('authDomain') || '',
    projectId: parametros.get('projectId') || '',
    messagingSenderId: parametros.get('messagingSenderId') || '',
    appId: parametros.get('appId') || '',
  }
  if (!config.apiKey || !config.projectId || !config.appId || !config.messagingSenderId) {
    return null
  }
  return config
}

function rutaDestinoDeAviso(data) {
  const reservaId = typeof data?.reservaId === 'string' ? data.reservaId.trim() : ''
  const notificacionId = typeof data?.notificacionId === 'string' ? data.notificacionId.trim() : ''
  const base = reservaId ? `/reservas/${encodeURIComponent(reservaId)}` : '/avisos'
  if (!notificacionId) return base
  return `${base}?notificacion=${encodeURIComponent(notificacionId)}`
}

async function abrirOEnfocarPanel(ruta, data) {
  const destino = new URL(ruta, self.location.origin).href
  const clientes = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const cliente of clientes) {
    if (new URL(cliente.url).origin !== self.location.origin) continue
    if (typeof cliente.navigate === 'function') {
      await cliente.navigate(destino)
    } else if (typeof cliente.postMessage === 'function') {
      cliente.postMessage({
        tipo: 'SERVIA_ABRIR_AVISO',
        ruta,
        reservaId: data?.reservaId ?? null,
        notificacionId: data?.notificacionId ?? null,
      })
    }
    if (typeof cliente.focus === 'function') {
      await cliente.focus()
    }
    return
  }
  await self.clients.openWindow(destino)
}

self.addEventListener('notificationclick', (evento) => {
  const crudos = evento.notification?.data ?? {}
  const data = crudos.FCM_MSG?.data ?? crudos
  const ruta = rutaDestinoDeAviso(data)
  evento.notification?.close?.()
  evento.stopImmediatePropagation?.()
  evento.waitUntil(abrirOEnfocarPanel(ruta, data))
})

const configFirebase = leerConfigDeUrl()
if (configFirebase && typeof firebase !== 'undefined' && firebase?.messaging) {
  if (!firebase.apps?.length) {
    firebase.initializeApp(configFirebase)
  }
  const messaging = firebase.messaging()
  messaging.onBackgroundMessage((payload) => {
    // Si el payload incluye `notification`, FCM ya muestra el aviso.
    if (payload?.notification) return
    const data = payload?.data ?? {}
    const titulo = data.titulo || data.title || 'Servia'
    const cuerpo = data.cuerpo || data.body || ''
    return self.registration.showNotification(titulo, {
      body: cuerpo,
      icon: '/pwa-192x192.png',
      data,
    })
  })
}
