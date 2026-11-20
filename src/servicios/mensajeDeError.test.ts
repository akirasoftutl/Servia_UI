import { ErrorApi } from './api'
import { MENSAJE_ERROR_SERVIDOR, mensajeDeError } from './mensajeDeError'

const MENSAJE_RED = 'No pudimos enviar tu reporte. Revisa tu conexión e intenta de nuevo.'

describe('mensajeDeError', () => {
  it('muestra el mensaje de la API en un 429', () => {
    const error = new ErrorApi(429, 'Enviaste demasiados reportes; inténtalo más tarde.')
    expect(mensajeDeError(error, MENSAJE_RED)).toBe('Enviaste demasiados reportes; inténtalo más tarde.')
  })

  it.each([
    [400, 'El asunto debe tener entre 5 y 100 caracteres.'],
    [403, 'No tienes permiso para realizar esta acción.'],
    [404, 'No encontramos el recurso solicitado.'],
    [409, 'Ya existe un registro con esos datos.'],
  ])('muestra el mensaje de la API en un %i', (estado, mensaje) => {
    expect(mensajeDeError(new ErrorApi(estado, mensaje), MENSAJE_RED)).toBe(mensaje)
  })

  it('usa el texto del servidor si un 4xx llega sin mensaje útil', () => {
    expect(mensajeDeError(new ErrorApi(400, '   '), MENSAJE_RED)).toBe(MENSAJE_ERROR_SERVIDOR)
  })

  it.each([500, 502, 503, 504])('muestra el texto del servidor en un %i sin exponer detalles técnicos', (estado) => {
    expect(mensajeDeError(new ErrorApi(estado, 'Internal server error'), MENSAJE_RED)).toBe(
      MENSAJE_ERROR_SERVIDOR,
    )
  })

  it.each([
    new TypeError('Failed to fetch'),
    new Error('Sin conexión'),
    'error inesperado',
    null,
  ])('devuelve el mensaje de red de la pantalla cuando no hubo respuesta de la API (%s)', (error) => {
    expect(mensajeDeError(error, MENSAJE_RED)).toBe(MENSAJE_RED)
  })

  it('no interfiere con 401 y devuelve su mensaje sin redirigir', () => {
    expect(mensajeDeError(new ErrorApi(401, 'Sesión expirada'), MENSAJE_RED)).toBe('Sesión expirada')
  })
})
