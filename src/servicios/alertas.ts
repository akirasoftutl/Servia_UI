import Swal, { type SweetAlertOptions } from 'sweetalert2'
import { mensajeDeError } from './mensajeDeError'

export interface OpcionesConfirmar {
  titulo: string
  texto?: string
  confirmar?: string
  cancelar?: string
  peligro?: boolean
}

const CLASES_BASE = {
  container: 'servia-swal-contenedor',
  popup: 'servia-swal-popup',
  title: 'servia-swal-titulo',
  htmlContainer: 'servia-swal-texto',
  actions: 'servia-swal-acciones',
  confirmButton: 'servia-swal-btn servia-swal-btn--primario',
  cancelButton: 'servia-swal-btn servia-swal-btn--secundario',
  icon: 'servia-swal-icono',
} as const

const OPCIONES_BASE: SweetAlertOptions = {
  buttonsStyling: false,
  allowEscapeKey: true,
  returnFocus: true,
  heightAuto: false,
  reverseButtons: true,
}

export async function exito(mensaje: string, titulo = 'Listo'): Promise<void> {
  await Swal.fire({
    ...OPCIONES_BASE,
    icon: 'success',
    title: titulo,
    text: mensaje,
    confirmButtonText: 'Aceptar',
    customClass: {
      ...CLASES_BASE,
      popup: 'servia-swal-popup servia-swal-popup--exito',
    },
  })
}

export async function error(mensaje: string, titulo = 'Ocurrió un error'): Promise<void> {
  await Swal.fire({
    ...OPCIONES_BASE,
    icon: 'error',
    title: titulo,
    text: mensaje,
    confirmButtonText: 'Aceptar',
    customClass: {
      ...CLASES_BASE,
      popup: 'servia-swal-popup servia-swal-popup--error',
    },
  })
}

export async function aviso(mensaje: string, titulo = 'Aviso'): Promise<void> {
  await Swal.fire({
    ...OPCIONES_BASE,
    icon: 'warning',
    title: titulo,
    text: mensaje,
    confirmButtonText: 'Aceptar',
    customClass: {
      ...CLASES_BASE,
      popup: 'servia-swal-popup servia-swal-popup--aviso',
    },
  })
}

export async function confirmar({
  titulo,
  texto,
  confirmar: textoConfirmar = 'Aceptar',
  cancelar: textoCancelar = 'Cancelar',
  peligro = false,
}: OpcionesConfirmar): Promise<boolean> {
  const resultado = await Swal.fire({
    ...OPCIONES_BASE,
    icon: peligro ? 'warning' : 'question',
    title: titulo,
    text: texto,
    showCancelButton: true,
    allowOutsideClick: false,
    focusCancel: peligro,
    confirmButtonText: textoConfirmar,
    cancelButtonText: textoCancelar,
    customClass: {
      ...CLASES_BASE,
      popup: peligro
        ? 'servia-swal-popup servia-swal-popup--peligro'
        : 'servia-swal-popup servia-swal-popup--confirmar',
      confirmButton: peligro
        ? 'servia-swal-btn servia-swal-btn--peligro'
        : 'servia-swal-btn servia-swal-btn--primario',
    },
  })
  return Boolean(resultado.isConfirmed)
}

export async function alertaDeError(
  causa: unknown,
  textoRed: string,
  titulo?: string,
): Promise<string> {
  const mensaje = mensajeDeError(causa, textoRed)
  await error(mensaje, titulo)
  return mensaje
}
