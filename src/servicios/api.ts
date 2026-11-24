import { auth } from './firebase'

const URL_API = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')

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

// Llama a la API de Servia. Si hay sesión, agrega el token de Firebase.
// Ejemplo: `const perfil = await api<Perfil>('/negocios/mio')`.
export async function api<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const cabeceras = new Headers(opciones.headers)
  if (opciones.body && !(opciones.body instanceof FormData) && !cabeceras.has('Content-Type')) {
    cabeceras.set('Content-Type', 'application/json')
  }
  const token = await auth?.currentUser?.getIdToken()
  if (token) {
    cabeceras.set('Authorization', `Bearer ${token}`)
  }

  const respuesta = await fetch(`${URL_API}${ruta}`, { ...opciones, headers: cabeceras })
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
  return datos as T
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
