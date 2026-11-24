// Caché de las respuestas GET de la API. Se guarda por usuario para que los
// datos de un negocio no aparezcan en la cuenta de otro en el mismo dispositivo.
// Es caché de solo lectura: las escrituras siempre van a la red (o a la cola).

import { auth } from './firebase'

const PREFIJO_CACHE = 'servia-datos-'
const VERSION_CACHE = 'v1'

function nombreCache(): string {
  return `${PREFIJO_CACHE}${auth?.currentUser?.uid ?? 'anon'}-${VERSION_CACHE}`
}

function abrirCache(): Promise<Cache | null> {
  if (typeof caches === 'undefined') return Promise.resolve(null)
  return caches.open(nombreCache()).catch(() => null)
}

export async function leerDato<T>(url: string): Promise<T | undefined> {
  const cache = await abrirCache()
  if (!cache) return undefined
  try {
    const respuesta = await cache.match(url)
    if (!respuesta) return undefined
    const texto = await respuesta.text()
    return texto ? (JSON.parse(texto) as T) : undefined
  } catch {
    return undefined
  }
}

export async function guardarDato(url: string, respuesta: Response): Promise<void> {
  const cache = await abrirCache()
  if (!cache) return
  try {
    await cache.put(url, respuesta)
  } catch {
    // Sin espacio o sin soporte: seguimos sin caché, pero la app funciona.
  }
}

// Después de escribir, invalidamos el grupo de rutas relacionado para que una
// consulta offline posterior no muestre datos ya cambiados.
export async function invalidarDatosDe(url: string): Promise<void> {
  const cache = await abrirCache()
  if (!cache) return
  try {
    const grupo = new URL(url).pathname.split('/').slice(0, 3).join('/')
    const claves = await cache.keys()
    await Promise.all(
      claves.map((solicitud) => {
        const ruta = new URL(solicitud.url).pathname
        return ruta === grupo || ruta.startsWith(`${grupo}/`)
          ? cache.delete(solicitud)
          : Promise.resolve(false)
      }),
    )
  } catch {
    // La invalidación es best-effort; la próxima respuesta en línea la actualiza.
  }
}

export async function vaciarCacheDatos(): Promise<void> {
  if (typeof caches === 'undefined') return
  try {
    const claves = await caches.keys()
    await Promise.all(
      claves.filter((clave) => clave.startsWith(PREFIJO_CACHE)).map((clave) => caches.delete(clave)),
    )
  } catch {
    // Nada que limpiar.
  }
}
