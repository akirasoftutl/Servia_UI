// Cola de acciones que no pudieron enviarse (sin red o con el servicio caído).
// Se guarda en IndexedDB para que sobreviva a cerrar la pestaña; si el navegador
// no permite IndexedDB, se usa una copia en memoria para que la app siga funcionando.

export const EVENTO_COLA_OFFLINE = 'servia:cola-offline'
export const EVENTO_AVISO_OFFLINE = 'servia:aviso-offline'

export interface AccionPendiente {
  id: string
  url: string
  method: string
  headers: Record<string, string>
  body?: string | FormData | null
  creadaEn: number
  usuarioId?: string | null
}

const NOMBRE_BASE = 'servia-offline'
const NOMBRE_TIENDA = 'acciones'

let promesaBase: Promise<IDBDatabase | null> | null = null
let accionesEnMemoria: AccionPendiente[] = []

function abrirBase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  if (!promesaBase) {
    promesaBase = new Promise<IDBDatabase | null>((resolve) => {
      let solicitud: IDBOpenDBRequest
      try {
        solicitud = indexedDB.open(NOMBRE_BASE, 1)
      } catch {
        resolve(null)
        return
      }
      solicitud.onupgradeneeded = () => {
        const base = solicitud.result
        if (!base.objectStoreNames.contains(NOMBRE_TIENDA)) {
          base.createObjectStore(NOMBRE_TIENDA, { keyPath: 'id' })
        }
      }
      solicitud.onsuccess = () => resolve(solicitud.result)
      solicitud.onerror = () => resolve(null)
      solicitud.onblocked = () => resolve(null)
    })
  }
  return promesaBase
}

export async function guardarAccion(accion: AccionPendiente): Promise<void> {
  const base = await abrirBase()
  if (base) {
    const guardado = await new Promise<boolean>((resolve) => {
      try {
        const transaccion = base.transaction(NOMBRE_TIENDA, 'readwrite')
        transaccion.objectStore(NOMBRE_TIENDA).put(accion)
        transaccion.oncomplete = () => resolve(true)
        transaccion.onerror = () => resolve(false)
        transaccion.onabort = () => resolve(false)
      } catch {
        resolve(false)
      }
    })
    if (guardado) {
      notificarCambioCola()
      return
    }
  }
  accionesEnMemoria = [...accionesEnMemoria, accion]
  notificarCambioCola()
}

export async function leerAcciones(): Promise<AccionPendiente[]> {
  const base = await abrirBase()
  if (!base) return [...accionesEnMemoria]

  const guardadas = await new Promise<AccionPendiente[] | null>((resolve) => {
    try {
      const transaccion = base.transaction(NOMBRE_TIENDA, 'readonly')
      const solicitud = transaccion.objectStore(NOMBRE_TIENDA).getAll()
      solicitud.onsuccess = () => resolve((solicitud.result ?? []) as AccionPendiente[])
      solicitud.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })

  return (guardadas ?? accionesEnMemoria)
    .slice()
    .sort((a, b) => a.creadaEn - b.creadaEn)
}

export async function borrarAccion(id: string): Promise<void> {
  const base = await abrirBase()
  if (base) {
    await new Promise<void>((resolve) => {
      try {
        const transaccion = base.transaction(NOMBRE_TIENDA, 'readwrite')
        transaccion.objectStore(NOMBRE_TIENDA).delete(id)
        transaccion.oncomplete = () => resolve()
        transaccion.onerror = () => resolve()
        transaccion.onabort = () => resolve()
      } catch {
        resolve()
      }
    })
  }
  accionesEnMemoria = accionesEnMemoria.filter((accion) => accion.id !== id)
  notificarCambioCola()
}

export async function vaciarCola(): Promise<void> {
  const base = await abrirBase()
  if (base) {
    await new Promise<void>((resolve) => {
      try {
        const transaccion = base.transaction(NOMBRE_TIENDA, 'readwrite')
        transaccion.objectStore(NOMBRE_TIENDA).clear()
        transaccion.oncomplete = () => resolve()
        transaccion.onerror = () => resolve()
        transaccion.onabort = () => resolve()
      } catch {
        resolve()
      }
    })
  }
  accionesEnMemoria = []
  notificarCambioCola()
}

export async function cantidadAccionesPendientes(): Promise<number> {
  return (await leerAcciones()).length
}

export function notificarCambioCola(): void {
  if (typeof window === 'undefined') return
  void cantidadAccionesPendientes().then((cantidad) => {
    window.dispatchEvent(new CustomEvent(EVENTO_COLA_OFFLINE, { detail: { cantidad } }))
  })
}

export function avisarOffline(mensaje: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVENTO_AVISO_OFFLINE, { detail: { mensaje } }))
}
