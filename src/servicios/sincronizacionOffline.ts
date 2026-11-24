import { reenviarAccionesPendientes } from './api'

// Reintento mientras haya acciones en cola. El servicio puede volver (o caer)
// sin que cambie `navigator.onLine`, así que no basta con el evento `online`.
const INTERVALO_REINTENTO_MS = 15_000

let iniciado = false

export function iniciarSincronizacionOffline(): void {
  if (iniciado || typeof window === 'undefined') return
  iniciado = true

  window.addEventListener('online', () => void reenviarAccionesPendientes())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void reenviarAccionesPendientes()
  })
  window.setInterval(() => void reenviarAccionesPendientes(), INTERVALO_REINTENTO_MS)

  // Si la app se abre con acciones guardadas de una sesión anterior, se envían.
  void reenviarAccionesPendientes()
}
