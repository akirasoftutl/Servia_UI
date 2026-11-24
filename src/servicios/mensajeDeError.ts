import type { ErrorApi } from './api'

export const MENSAJE_ERROR_SERVIDOR =
  'Tuvimos un problema en el servidor. Inténtalo de nuevo en unos minutos.'

function esErrorApi(error: unknown): error is ErrorApi {
  return (
    error instanceof Error &&
    'estado' in error &&
    typeof (error as { estado: unknown }).estado === 'number'
  )
}

// Elige el texto que debe ver el usuario ante un fallo al consultar la API:
// - 5xx: aviso genérico del servidor (nunca «revisa tu conexión»).
// - 4xx con mensaje útil: el mensaje que respondió la API.
// - Fallo de red (TypeError / sin respuesta): el mensaje propio de la pantalla.
// 401 no se intercepta aquí para no alterar la salida de sesión existente.
export function mensajeDeError(error: unknown, mensajeRed: string): string {
  // Los errores offline ya traen el texto exacto que debe ver el usuario.
  if (error instanceof Error && 'sinConexion' in error && error.message) {
    return error.message
  }
  if (esErrorApi(error)) {
    if (error.estado >= 500) {
      return MENSAJE_ERROR_SERVIDOR
    }
    const mensaje = error.message.trim()
    return mensaje || MENSAJE_ERROR_SERVIDOR
  }
  return mensajeRed
}
