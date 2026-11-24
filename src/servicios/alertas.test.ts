import { describe, expect, it } from 'vitest'
import { ErrorApi, ErrorSinConexion } from './api'
import { MENSAJE_ERROR_SERVIDOR } from './mensajeDeError'
import { alertaDeError, aviso, confirmar, error, exito } from './alertas'
import {
  llamadasAlertas,
  mockearConfirmacion,
  swalFireMock,
  ultimaAlerta,
} from '../pruebas/mockAlertas'

describe('servicio de alertas (SweetAlert2)', () => {
  it('muestra alerta de éxito en español con botón Aceptar, Esc y clases del panel', async () => {
    await exito('Se guardó con éxito.')

    expect(swalFireMock).toHaveBeenCalledTimes(1)
    const opciones = ultimaAlerta()
    expect(opciones).toMatchObject({
      icon: 'success',
      title: 'Listo',
      text: 'Se guardó con éxito.',
      confirmButtonText: 'Aceptar',
      buttonsStyling: false,
      allowEscapeKey: true,
      returnFocus: true,
      heightAuto: false,
    })
    expect(opciones?.customClass).toMatchObject({
      popup: 'servia-swal-popup servia-swal-popup--exito',
      confirmButton: 'servia-swal-btn servia-swal-btn--primario',
    })
  })

  it('muestra alerta de error con título personalizado opcional', async () => {
    await error('No pudimos guardar los cambios.', 'Error al guardar')

    expect(ultimaAlerta()).toMatchObject({
      icon: 'error',
      title: 'Error al guardar',
      text: 'No pudimos guardar los cambios.',
      confirmButtonText: 'Aceptar',
      allowEscapeKey: true,
      returnFocus: true,
    })
    expect(ultimaAlerta()?.customClass).toMatchObject({
      popup: 'servia-swal-popup servia-swal-popup--error',
    })
  })

  it('muestra alerta de aviso con icono warning', async () => {
    await aviso('Revisa los campos marcados.')

    expect(ultimaAlerta()).toMatchObject({
      icon: 'warning',
      title: 'Aviso',
      text: 'Revisa los campos marcados.',
      confirmButtonText: 'Aceptar',
    })
    expect(ultimaAlerta()?.customClass).toMatchObject({
      popup: 'servia-swal-popup servia-swal-popup--aviso',
    })
  })

  it('confirmar devuelve true cuando el usuario acepta y false cuando cancela', async () => {
    mockearConfirmacion(true)
    const aceptada = await confirmar({
      titulo: '¿Cerrar sesión?',
      texto: 'Tendrás que volver a ingresar tus datos.',
    })
    expect(aceptada).toBe(true)

    mockearConfirmacion(false)
    const cancelada = await confirmar({
      titulo: '¿Eliminar servicio?',
      texto: 'Esta acción no se puede deshacer.',
      confirmar: 'Eliminar',
      cancelar: 'Volver',
      peligro: true,
    })
    expect(cancelada).toBe(false)

    const [primera, segunda] = llamadasAlertas()
    expect(primera).toMatchObject({
      icon: 'question',
      title: '¿Cerrar sesión?',
      text: 'Tendrás que volver a ingresar tus datos.',
      showCancelButton: true,
      confirmButtonText: 'Aceptar',
      cancelButtonText: 'Cancelar',
      allowEscapeKey: true,
      allowOutsideClick: false,
      reverseButtons: true,
      focusCancel: false,
    })
    expect(segunda).toMatchObject({
      icon: 'warning',
      title: '¿Eliminar servicio?',
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Volver',
      focusCancel: true,
    })
    expect(segunda?.customClass).toMatchObject({
      popup: 'servia-swal-popup servia-swal-popup--peligro',
      confirmButton: 'servia-swal-btn servia-swal-btn--peligro',
    })
  })

  it('alertaDeError reutiliza mensajeDeError para 4xx, 5xx, offline y fallos de red', async () => {
    const m400 = await alertaDeError(new ErrorApi(400, 'El horario se cruza.'), 'Error de red')
    expect(m400).toBe('El horario se cruza.')
    expect(ultimaAlerta()?.text).toBe('El horario se cruza.')

    const m500 = await alertaDeError(new ErrorApi(500, 'Internal error'), 'Error de red')
    expect(m500).toBe(MENSAJE_ERROR_SERVIDOR)
    expect(ultimaAlerta()?.text).toBe(MENSAJE_ERROR_SERVIDOR)

    const mOffline = await alertaDeError(new ErrorSinConexion('Sin conexión local.'), 'Error de red')
    expect(mOffline).toBe('Sin conexión local.')
    expect(ultimaAlerta()?.text).toBe('Sin conexión local.')

    const mRed = await alertaDeError(new TypeError('Failed to fetch'), 'Revisa tu conexión.')
    expect(mRed).toBe('Revisa tu conexión.')
    expect(ultimaAlerta()?.text).toBe('Revisa tu conexión.')
  })
})
