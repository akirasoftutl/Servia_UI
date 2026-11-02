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

// Llama a la API de Servia. Si hay sesión, agrega el token de Firebase.
// Ejemplo: `const perfil = await api<Perfil>('/negocios/mio')`.
export async function api<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const cabeceras = new Headers(opciones.headers)
  if (opciones.body && !cabeceras.has('Content-Type')) {
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
