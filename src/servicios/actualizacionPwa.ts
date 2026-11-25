import type { RegisterSWOptions } from 'vite-plugin-pwa/types'

/** Marca que sobrevive a la recarga para avisar «ya se actualizó» una sola vez. */
export const CLAVE_ACTUALIZADA = 'servia:pwa-actualizada'

export const MINUTOS_ENTRE_COMPROBACIONES = 60
/** Al volver a la pestaña no se comprueba más seguido que esto. */
const MINIMO_ENTRE_COMPROBACIONES_MS = 5 * 60 * 1000

type RegistrarSW = (opciones?: RegisterSWOptions) => (recargar?: boolean) => Promise<void>

interface ServicioAlertas {
  confirmar: (opciones: {
    titulo: string
    texto?: string
    confirmar?: string
    cancelar?: string
  }) => Promise<boolean>
  exito: (mensaje: string, titulo?: string) => Promise<void>
}

type Almacenamiento = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface DependenciasActualizacionPwa {
  registerSW: RegistrarSW
  alertas: ServicioAlertas
  almacenamiento?: Almacenamiento
  intervaloMs?: number
}

function almacenamientoDeSesion(): Almacenamiento | undefined {
  try {
    return globalThis.sessionStorage
  } catch {
    return undefined
  }
}

/**
 * Registra el service worker en modo «prompt»: la versión nueva se descarga sola,
 * pero solo se activa (y recarga la página) si la persona acepta, para no
 * perder lo que tenga escrito en un formulario.
 */
export function iniciarActualizacionPwa({
  registerSW,
  alertas,
  almacenamiento = almacenamientoDeSesion(),
  intervaloMs = MINUTOS_ENTRE_COMPROBACIONES * 60 * 1000,
}: DependenciasActualizacionPwa): () => void {
  let registro: ServiceWorkerRegistration | undefined
  let preguntando = false
  let pendiente = false
  let pospuesta = false
  let ultimaComprobacion = 0

  // Tras recargar por actualizar: avisa una sola vez.
  try {
    if (almacenamiento?.getItem(CLAVE_ACTUALIZADA)) {
      almacenamiento.removeItem(CLAVE_ACTUALIZADA)
      void alertas.exito('Servia se actualizó a la última versión.', 'Actualizado')
    }
  } catch {
    // Sin almacenamiento no hay aviso posterior; no es grave.
  }

  const actualizarSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      pendiente = true
      void preguntar()
    },
    // Sin aviso: poder trabajar sin conexión no requiere que la persona haga nada.
    onOfflineReady() {},
    onRegisteredSW(_urlSW, registration) {
      registro = registration
    },
  })

  async function preguntar() {
    if (preguntando || pospuesta) return
    preguntando = true
    try {
      const aceptada = await alertas.confirmar({
        titulo: 'Hay una versión nueva de Servia',
        texto: '¿Actualizar ahora?',
        confirmar: 'Actualizar',
        cancelar: 'Más tarde',
      })
      if (!aceptada) {
        pospuesta = true
        return
      }
      try {
        almacenamiento?.setItem(CLAVE_ACTUALIZADA, '1')
      } catch {
        // Sin almacenamiento solo se pierde el aviso posterior.
      }
      try {
        await actualizarSW(true)
      } catch {
        try {
          almacenamiento?.removeItem(CLAVE_ACTUALIZADA)
        } catch {
          // nada que limpiar
        }
      }
    } finally {
      preguntando = false
    }
  }

  function comprobar() {
    if (!registro || registro.installing) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    ultimaComprobacion = Date.now()
    registro.update().catch(() => {
      // Sin red o servidor caído: se reintenta en la próxima comprobación.
    })
  }

  // Comprobación periódica: si quedó una versión aplazada, vuelve a preguntar.
  const temporizador = setInterval(() => {
    comprobar()
    if (pendiente && pospuesta) {
      pospuesta = false
      void preguntar()
    }
  }, intervaloMs)

  const alVolver = () => {
    if (document.visibilityState !== 'visible') return
    if (Date.now() - ultimaComprobacion < MINIMO_ENTRE_COMPROBACIONES_MS) return
    comprobar()
  }
  const alConectar = () => comprobar()
  document.addEventListener('visibilitychange', alVolver)
  window.addEventListener('online', alConectar)

  return () => {
    clearInterval(temporizador)
    document.removeEventListener('visibilitychange', alVolver)
    window.removeEventListener('online', alConectar)
  }
}
