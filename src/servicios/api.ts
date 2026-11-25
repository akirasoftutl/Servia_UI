import { auth } from './firebase'
import { guardarDato, invalidarDatosDe, leerDato, vaciarCacheDatos } from './cacheOffline'
import {
  avisarOffline,
  borrarAccion,
  descartarAccionesSensibles,
  guardarAccion,
  leerAcciones,   type AccionPendiente,
} from './colaOffline'

const URL_API = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')

export const MENSAJE_SIN_CONEXION =
  'Sin conexión. Estás viendo los últimos datos guardados en este dispositivo.'
export const MENSAJE_REQUIERE_CONEXION =
  'Necesitas conexión para realizar esta acción. Conéctate e inténtalo de nuevo.'
export const MENSAJE_ACCION_PENDIENTE =
  'Sin conexión. Guardamos tu acción y la enviaremos automáticamente cuando vuelva la conexión.'

// Error de la API con su código HTTP, el mensaje que mandó el servidor y, si
// existe, el cuerpo completo de la respuesta (por ejemplo, las reservas en
// conflicto de un 409).
export class ErrorApi extends Error {
  readonly estado: number
  readonly datos: unknown

  constructor(estado: number, mensaje: string, datos?: unknown) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.estado = estado
    this.datos = datos
  }
}

// Sin red: las lecturas se sirven desde la caché local. La marca `sinConexion`
// permite a la UI (y al AuthContext) distinguirlo de un error de la API sin
// importar esta clase, útil también en pruebas con mocks.
export class ErrorSinConexion extends Error {
  readonly sinConexion = true

  constructor(mensaje = MENSAJE_SIN_CONEXION) {
    super(mensaje)
    this.name = 'ErrorSinConexion'
  }
}

// Una escritura hecha sin red queda en la cola; el error avisa al usuario de
// que la acción no se perdió y se enviará después.
export class ErrorAccionPendiente extends ErrorSinConexion {
  constructor() {
    super(MENSAJE_ACCION_PENDIENTE)
    this.name = 'ErrorAccionPendiente'
  }
}

// Opciones de `api()`: las de `fetch` más `sinCola`, que impide guardar la
// escritura en la cola offline (por ejemplo, si lleva contraseñas).
export type OpcionesApi = RequestInit & { sinCola?: boolean }

export type TipoFotoNegocio = 'portada' | 'galeria'

export interface FotoNegocio {
  id: string
  url: string
}

export interface FotosNegocio {
  portada: FotoNegocio | null
  galeria: FotoNegocio[]
}

// Imagen de un servicio tal como la devuelve la API (HU-N27, RN-15).
export interface ImagenServicio {
  id: string
  url: string
}

const METODOS_LECTURA = new Set(['GET', 'HEAD', 'OPTIONS'])
let reenviando = false

function esLectura(metodo: string): boolean {
  return METODOS_LECTURA.has(metodo)
}

function esEscritura(metodo: string): boolean {
  return !esLectura(metodo)
}

function esFalloDeRed(error: unknown): boolean {
  if (error instanceof TypeError) return true
  if (error instanceof Error && error.name === 'NetworkError') return true
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

async function tokenDeSesion(): Promise<string | null> {
  if (!auth?.currentUser) return null
  try {
    return (await auth.currentUser.getIdToken()) || null
  } catch {
    // Con el servicio de autenticación caído se conserva el token que ya estaba
    // en la petición encolada; al reenviar se intenta obtener uno nuevo.
    return null
  }
}

function cuerpoParaCola(cuerpo: BodyInit | null | undefined): string | FormData | null {
  if (cuerpo == null) return null
  if (typeof cuerpo === 'string' || cuerpo instanceof FormData) return cuerpo
  if (typeof cuerpo === 'object' && 'toString' in cuerpo) return String(cuerpo)
  return null
}

function clonarCuerpo(cuerpo: AccionPendiente['body']): BodyInit | undefined {
  if (cuerpo == null) return undefined
  if (typeof cuerpo === 'string') return cuerpo
  const copia = new FormData()
  for (const [clave, valor] of cuerpo.entries()) {
    copia.append(clave, valor)
  }
  return copia
}

function mensajeDeRespuesta(texto: string): string {
  try {
    const datos = JSON.parse(texto) as { message?: string | string[] } | undefined
    const mensaje = datos?.message
    if (Array.isArray(mensaje)) return mensaje.join(' ')
    return mensaje?.trim() || 'No se pudo enviar el cambio.'
  } catch {
    return 'No se pudo enviar el cambio.'
  }
}

async function encolarAccion(
  url: string,
  metodo: string,
  cabeceras: Headers,
  cuerpo: BodyInit | null | undefined,
): Promise<never> {
  await guardarAccion({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    url,
    method: metodo,
    headers: Object.fromEntries(cabeceras.entries()),
    body: cuerpoParaCola(cuerpo),
    creadaEn: Date.now(),
    usuarioId: auth?.currentUser?.uid ?? null,
  })
  throw new ErrorAccionPendiente()
}

// Llama a la API de Servia. Si hay sesión, agrega el token de Firebase.
// Las lecturas usan la red primero y, si falla, el último dato guardado.
// Las escrituras que fallan por red se guardan y se reenvían al volver la conexión.
// Con `sinCola: true` una escritura sin red no se guarda: lanza `ErrorSinConexion`.
// Ejemplo: `const perfil = await api<Perfil>('/negocios/mio')`.
export async function api<T>(ruta: string, { sinCola = false, ...opciones }: OpcionesApi = {}): Promise<T> {
  const url = `${URL_API}${ruta}`
  const metodo = (opciones.method ?? 'GET').toUpperCase()
  const cabeceras = new Headers(opciones.headers)
  if (opciones.body && !(opciones.body instanceof FormData) && !cabeceras.has('Content-Type')) {
    cabeceras.set('Content-Type', 'application/json')
  }
  const token = await tokenDeSesion()
  if (token) {
    cabeceras.set('Authorization', `Bearer ${token}`)
  }

  let respuesta: Response
  try {
    respuesta = await fetch(url, { ...opciones, headers: cabeceras })
  } catch (error) {
    if (!esFalloDeRed(error)) throw error
    if (esEscritura(metodo) && sinCola) throw new ErrorSinConexion(MENSAJE_REQUIERE_CONEXION)
    if (esEscritura(metodo)) return encolarAccion(url, metodo, cabeceras, opciones.body)
    const guardado = await leerDato<T>(url)
    if (guardado !== undefined) return guardado
    throw new ErrorSinConexion()
  }

  const copia = esLectura(metodo) && respuesta.ok ? respuesta.clone() : null

  // Servicio caído (502/503/504): mostramos la última lectura conocida.
  if (!respuesta.ok && esLectura(metodo) && respuesta.status >= 500) {
    const guardado = await leerDato<T>(url)
    if (guardado !== undefined) return guardado
  }

  const texto = await respuesta.text()
  const datos: unknown = texto ? JSON.parse(texto) : undefined

  if (!respuesta.ok) {
    const mensaje = (datos as { message?: string | string[] } | undefined)?.message
    throw new ErrorApi(
      respuesta.status,
      Array.isArray(mensaje) ? mensaje.join(' ') : (mensaje ?? 'Ocurrió un error con el servidor.'),
      datos,
    )
  }

  if (copia) {
    await guardarDato(url, copia)
  } else if (esEscritura(metodo)) {
    await invalidarDatosDe(url)
  }
  return datos as T
}

// Envía las acciones pendientes en el orden en que se hicieron. Se llama al
// abrir la app, al recuperar la red y periódicamente (el servicio puede volver
// sin que `navigator.onLine` cambie).
export async function reenviarAccionesPendientes(): Promise<void> {
  if (reenviando) return
  reenviando = true
  try {
    await descartarAccionesSensibles()
    const acciones = await leerAcciones()
    if (acciones.length === 0) return

    for (const accion of acciones) {
      const uid = auth?.currentUser?.uid ?? null
      if (accion.usuarioId && uid && accion.usuarioId !== uid) {
        await borrarAccion(accion.id)
        avisarOffline('Descartamos un cambio pendiente de otra sesión.')
        continue
      }

      const cabeceras = new Headers(accion.headers)
      const token = await tokenDeSesion()
      if (token) cabeceras.set('Authorization', `Bearer ${token}`)

      let respuesta: Response
      try {
        respuesta = await fetch(accion.url, {
          method: accion.method,
          headers: cabeceras,
          body: clonarCuerpo(accion.body),
        })
      } catch (error) {
        if (esFalloDeRed(error)) break // queda en la cola para el próximo intento
        throw error
      }

      if (respuesta.status === 401) {
        avisarOffline('Inicia sesión de nuevo para enviar los cambios pendientes.')
        break
      }

      await borrarAccion(accion.id)
      await invalidarDatosDe(accion.url)

      if (!respuesta.ok) {
        const texto = await respuesta.text().catch(() => '')
        avisarOffline(`No se pudo enviar un cambio pendiente: ${mensajeDeRespuesta(texto)}`)
        break
      }
    }

    const restantes = await leerAcciones()
    if (restantes.length === 0 && acciones.length > 0) {
      avisarOffline('Cambios pendientes enviados. Recarga la página para ver los datos más recientes.')
    }
  } catch {
    avisarOffline('No pudimos enviar los cambios pendientes. Lo intentaremos de nuevo.')
  } finally {
    reenviando = false
  }
}

// Sube una foto de portada o galería del negocio autenticado (multipart/form-data).
export function subirFotoNegocio(archivo: File, tipo: TipoFotoNegocio): Promise<FotoNegocio> {
  const cuerpo = new FormData()
  cuerpo.append('archivo', archivo)
  cuerpo.append('tipo', tipo)
  return api<FotoNegocio>('/negocios/mio/fotos', { method: 'POST', body: cuerpo })
}

// Elimina una foto del negocio autenticado por su identificador.
export function eliminarFotoNegocio(fotoId: string): Promise<void> {
  return api<void>(`/negocios/mio/fotos/${encodeURIComponent(fotoId)}`, { method: 'DELETE' })
}

// Sube una imagen a un servicio del negocio autenticado (multipart/form-data, campo `archivo`).
export function subirImagenServicio(servicioId: string, archivo: File): Promise<ImagenServicio> {
  const cuerpo = new FormData()
  cuerpo.append('archivo', archivo)
  return api<ImagenServicio>(`/negocios/mio/servicios/${encodeURIComponent(servicioId)}/imagenes`, {
    method: 'POST',
    body: cuerpo,
  })
}

// Quita una imagen de un servicio del negocio autenticado.
export function eliminarImagenServicio(servicioId: string, imagenId: string): Promise<void> {
  return api<void>(
    `/negocios/mio/servicios/${encodeURIComponent(servicioId)}/imagenes/${encodeURIComponent(imagenId)}`,
    { method: 'DELETE' },
  )
}

// Se usa al cerrar sesión para no dejar datos ni acciones de ese negocio.
export { vaciarCacheDatos }

// Descarga la imagen del mapa del negocio (`GET /negocios/mio/mapa`, Servia_BE#119)
// y devuelve una URL temporal. Un `<img src>` no manda el token de Firebase, por eso
// se pide con `fetch`. Quien la use debe llamar a `URL.revokeObjectURL()` al soltarla.
export async function descargarMapaNegocio(): Promise<string> {
  const cabeceras = new Headers()
  const token = await auth?.currentUser?.getIdToken()
  if (token) {
    cabeceras.set('Authorization', `Bearer ${token}`)
  }

  const respuesta = await fetch(`${URL_API}/negocios/mio/mapa`, { headers: cabeceras, cache: 'no-store' })
  if (!respuesta.ok) {
    throw new ErrorApi(respuesta.status, 'No se pudo cargar el mapa.')
  }
  return URL.createObjectURL(await respuesta.blob())
}
