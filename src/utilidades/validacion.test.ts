import { describe, expect, it } from 'vitest'
import {
  MENSAJE_CODIGO_POSTAL_INVALIDO,
  MENSAJE_CORREO_INVALIDO,
  MENSAJE_DURACION_INVALIDA,
  MENSAJE_PRECIO_INVALIDO,
  MENSAJE_RESUMEN_VALIDACION,
  MENSAJE_TELEFONO_INVALIDO,
  MENSAJE_TELEFONO_OBLIGATORIO,
  atributosErrorCampo,
  enfocarPrimerError,
  esFechaCalendario,
  horaAMinutos,
  idErrorCampo,
  longitudEntre,
  longitudMaxima,
  normalizarTelefono,
  notificarErroresFormulario,
  primerCampoConError,
  requerido,
  tieneErrores,
  validarCambioContrasena,
  validarCodigoPostal,
  validarCorreo,
  validarDuracion,
  validarFechaNoPasada,
  validarMotivo,
  validarPrecio,
  validarRangoFechas,
  validarRangoHoras,
  validarTelefono,
} from './validacion'
import { swalFireMock, ultimaAlerta } from '../pruebas/mockAlertas'

describe('utilidades de validación única', () => {
  it('valida requerido ignorando espacios', () => {
    expect(requerido('')).toBe('Este campo es obligatorio.')
    expect(requerido('   ', 'Escribe el nombre.')).toBe('Escribe el nombre.')
    expect(requerido('Corte')).toBe('')
  })

  it('valida longitudEntre con y sin conteo de puntos de código', () => {
    expect(longitudEntre('', 5, 10, { mensajeVacio: 'Vacío' })).toBe('Vacío')
    expect(longitudEntre('abc', 5, 10, { mensajeMin: 'Muy corto' })).toBe('Muy corto')
    expect(longitudEntre('12345678901', 5, 10, { mensajeMax: 'Muy largo' })).toBe('Muy largo')
    expect(longitudEntre('  abcde  ', 5, 10)).toBe('')
    // 5 emojis cuentan como 5 caracteres con contarCodigoPuntos, no 10 code units
    expect(longitudEntre('😀😀😀😀😀', 5, 5, { contarCodigoPuntos: true })).toBe('')
    expect(longitudEntre('😀😀😀😀', 5, 5, { contarCodigoPuntos: true })).not.toBe('')
  })

  it('valida longitudMaxima', () => {
    expect(longitudMaxima('12345', 4, 'Máximo 4')).toBe('Máximo 4')
    expect(longitudMaxima('  1234  ', 4)).toBe('')
    expect(longitudMaxima('  1234  ', 4, 'Excede', true)).toBe('Excede')
  })

  it('valida correo, teléfono y código postal', () => {
    expect(validarCorreo('sin-arroba')).toBe(MENSAJE_CORREO_INVALIDO)
    expect(validarCorreo('contacto@negocio.com')).toBe('')

    expect(normalizarTelefono('(477) 123-4567')).toBe('4771234567')
    expect(validarTelefono('   ')).toBe(MENSAJE_TELEFONO_OBLIGATORIO)
    expect(validarTelefono('477123')).toBe(MENSAJE_TELEFONO_INVALIDO)
    expect(validarTelefono('477 123 4567')).toBe('')

    expect(validarCodigoPostal('3700')).toBe(MENSAJE_CODIGO_POSTAL_INVALIDO)
    expect(validarCodigoPostal('37000')).toBe('')
  })

  it('valida precio y duración de servicios', () => {
    expect(validarPrecio('')).toBe(MENSAJE_PRECIO_INVALIDO)
    expect(validarPrecio('-1')).toBe(MENSAJE_PRECIO_INVALIDO)
    expect(validarPrecio('abc')).toBe(MENSAJE_PRECIO_INVALIDO)
    expect(validarPrecio('0')).toBe('')
    expect(validarPrecio('149.50')).toBe('')

    expect(validarDuracion('')).toBe(MENSAJE_DURACION_INVALIDA)
    expect(validarDuracion('0')).toBe(MENSAJE_DURACION_INVALIDA)
    expect(validarDuracion('15.5')).toBe(MENSAJE_DURACION_INVALIDA)
    expect(validarDuracion('30')).toBe('')
  })

  it('valida horas, fechas de calendario, rangos y fechas no pasadas', () => {
    expect(horaAMinutos('09:30')).toBe(570)
    expect(horaAMinutos('25:00')).toBeNull()

    expect(validarRangoHoras('', '18:00')).toBe('Indica la hora de apertura y la de cierre.')
    expect(validarRangoHoras('18:00', '09:00')).toBe('La hora de cierre debe ser posterior a la de apertura.')
    expect(validarRangoHoras('09:00', '18:00')).toBe('')

    expect(esFechaCalendario('2026-02-28')).toBe(true)
    expect(esFechaCalendario('2026-02-30')).toBe(false)

    expect(validarRangoFechas('', '2026-05-01')).toBe('Ingresa la fecha inicial y la fecha final.')
    expect(validarRangoFechas('2026-05-10', '2026-05-01')).toBe('La fecha inicial no puede ser posterior a la fecha final.')
    expect(validarRangoFechas('2025-01-01', '2026-05-01', { maxDias: 366 })).toBe('El periodo no puede pasar de 366 días.')
    expect(validarRangoFechas('2026-05-01', '2026-05-10', { maxDias: 366 })).toBe('')

    const ahora = new Date('2026-06-15T18:00:00Z') // 12:00 en Mexico City
    expect(validarFechaNoPasada('2026-06-14', { ahora })).toBe('No puedes bloquear fechas que ya pasaron.')
    expect(validarFechaNoPasada('2026-06-15', { ahora, horaFin: '11:00' })).toBe('No puedes bloquear fechas que ya pasaron.')
    expect(validarFechaNoPasada('2026-06-15', { ahora, horaFin: '15:00' })).toBe('')
    expect(validarFechaNoPasada('2026-06-16', { ahora })).toBe('')
  })

  it('valida motivo con límites 20 a 500 caracteres', () => {
    expect(validarMotivo('', 'del rechazo')).toBe('Escribe el motivo del rechazo.')
    expect(validarMotivo('muy corto', 'del rechazo')).toBe('El motivo debe tener al menos 20 caracteres.')
    expect(validarMotivo('a'.repeat(501), 'de la cancelación')).toBe('El motivo no puede exceder 500 caracteres.')
    expect(validarMotivo('Motivo válido con suficiente detalle para el cliente.', 'del rechazo')).toBe('')
  })

  it('valida el cambio de contraseña conservando reglas y textos sin recortar espacios', () => {
    expect(validarCambioContrasena({ actual: '', nueva: 'nueva-5678', confirmacion: 'nueva-5678' })).toEqual({
      actual: 'Escribe tu contraseña actual.',
    })
    expect(validarCambioContrasena({ actual: 'vieja-1234', nueva: 'corta12', confirmacion: 'corta12' })).toEqual({
      nueva: 'La contraseña nueva debe tener al menos 8 caracteres.',
    })
    expect(validarCambioContrasena({ actual: 'misma-1234', nueva: 'misma-1234', confirmacion: 'misma-1234' })).toEqual({
      nueva: 'La contraseña nueva debe ser distinta de la actual.',
    })
    expect(validarCambioContrasena({ actual: 'vieja-1234', nueva: 'nueva-5678', confirmacion: 'nueva-0000' })).toEqual({
      confirmacion: 'Las contraseñas no coinciden.',
    })
    expect(validarCambioContrasena({ actual: 'vieja-1234', nueva: 'ocho-888', confirmacion: 'ocho-888' })).toEqual({})
    expect(validarCambioContrasena({ actual: '   ', nueva: '   12345', confirmacion: '   12345' })).toEqual({})
  })

  it('genera atributos accesibles, enfoca el primer campo con error y puede mostrar resumen de aviso', () => {
    expect(atributosErrorCampo('nombre', undefined, 'ayuda-nombre')).toEqual({
      'aria-invalid': false,
      'aria-describedby': 'ayuda-nombre',
    })
    expect(atributosErrorCampo('nombre', 'Requerido', 'ayuda-nombre')).toEqual({
      'aria-invalid': true,
      'aria-describedby': `${idErrorCampo('nombre')} ayuda-nombre`,
    })

    const primero = document.createElement('input')
    primero.id = 'campo-a'
    const segundo = document.createElement('input')
    segundo.id = 'campo-b'
    document.body.append(primero, segundo)

    const errores = { b: 'Error B', a: 'Error A' }
    expect(tieneErrores(errores)).toBe(true)
    expect(primerCampoConError(errores, ['a', 'b'])).toBe('a')

    const enfocado = enfocarPrimerError(errores, ['a', 'b'], { a: 'campo-a', b: 'campo-b' })
    expect(enfocado).toBe('a')
    expect(document.activeElement).toBe(primero)

    const ok = notificarErroresFormulario(errores, ['a', 'b'], {
      mapaIds: { a: 'campo-a', b: 'campo-b' },
      mostrarAviso: true,
    })
    expect(ok).toBe(false)
    expect(swalFireMock).toHaveBeenCalledTimes(1)
    expect(ultimaAlerta()).toMatchObject({
      icon: 'warning',
      text: MENSAJE_RESUMEN_VALIDACION,
    })

    primero.remove()
    segundo.remove()
  })
})
