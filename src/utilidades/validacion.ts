import { aviso } from '../servicios/alertas'

export type ErroresFormulario<K extends string = string> = Partial<Record<K, string>>

const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PATRON_HORA = /^(\d{2}):(\d{2})$/
const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/
const ZONA_NEGOCIO = 'America/Mexico_City'

export const MENSAJE_CORREO_INVALIDO =
  'Escribe un correo válido, por ejemplo contacto@negocio.com'
export const MENSAJE_TELEFONO_OBLIGATORIO = 'El teléfono es obligatorio'
export const MENSAJE_TELEFONO_INVALIDO =
  'El teléfono debe tener exactamente 10 dígitos, por ejemplo 477 123 4567'
export const MENSAJE_CODIGO_POSTAL_INVALIDO =
  'El código postal debe contener exactamente 5 dígitos'
export const MENSAJE_PRECIO_INVALIDO = 'El precio debe ser 0 o más.'
export const MENSAJE_DURACION_INVALIDA = 'La duración debe ser de al menos 1 minuto.'
export const MENSAJE_RESUMEN_VALIDACION = 'Revisa los campos marcados antes de continuar.'

export function contarCaracteres(texto: string, contarCodigoPuntos = false): number {
  const limpio = texto.trim()
  return contarCodigoPuntos ? Array.from(limpio).length : limpio.length
}

export function requerido(valor: string, mensaje = 'Este campo es obligatorio.'): string {
  return valor.trim() ? '' : mensaje
}

export function longitudEntre(
  valor: string,
  min: number,
  max: number,
  opciones: {
    mensaje?: string
    mensajeVacio?: string
    mensajeMin?: string
    mensajeMax?: string
    contarCodigoPuntos?: boolean
  } = {},
): string {
  const largo = contarCaracteres(valor, opciones.contarCodigoPuntos)
  if (largo === 0 && opciones.mensajeVacio) return opciones.mensajeVacio
  if (largo < min) {
    return opciones.mensajeMin ?? opciones.mensaje ?? `Debe tener entre ${min} y ${max} caracteres.`
  }
  if (largo > max) {
    return opciones.mensajeMax ?? opciones.mensaje ?? `Debe tener entre ${min} y ${max} caracteres.`
  }
  return ''
}

export function longitudMaxima(
  valor: string,
  max: number,
  mensaje = `No puede tener más de ${max} caracteres.`,
  sinTrim = false,
): string {
  const largo = sinTrim ? valor.length : valor.trim().length
  return largo > max ? mensaje : ''
}

export function validarCorreo(valor: string, mensaje = MENSAJE_CORREO_INVALIDO): string {
  return PATRON_CORREO.test(valor.trim()) ? '' : mensaje
}

export function normalizarTelefono(valor: string): string {
  return valor.replace(/[\s\-()]/g, '')
}

export function validarTelefono(valor: string): string {
  const limpio = normalizarTelefono(valor)
  if (!limpio) return MENSAJE_TELEFONO_OBLIGATORIO
  return /^\d{10}$/.test(limpio) ? '' : MENSAJE_TELEFONO_INVALIDO
}

export function validarCodigoPostal(
  valor: string,
  mensaje = MENSAJE_CODIGO_POSTAL_INVALIDO,
): string {
  return /^\d{5}$/.test(valor.trim()) ? '' : mensaje
}

export function validarPrecio(valor: string, mensaje = MENSAJE_PRECIO_INVALIDO): string {
  const numero = Number(valor)
  if (valor.trim() === '' || !Number.isFinite(numero) || numero < 0) {
    return mensaje
  }
  return ''
}

export function validarDuracion(valor: string, mensaje = MENSAJE_DURACION_INVALIDA): string {
  const numero = Number(valor)
  if (
    valor.trim() === '' ||
    !Number.isFinite(numero) ||
    numero < 1 ||
    !Number.isInteger(numero)
  ) {
    return mensaje
  }
  return ''
}

export function horaAMinutos(hora: string): number | null {
  const coincidencia = PATRON_HORA.exec(hora)
  if (!coincidencia) return null
  const horas = Number(coincidencia[1])
  const minutos = Number(coincidencia[2])
  if (horas > 23 || minutos > 59) return null
  return horas * 60 + minutos
}

export function validarRangoHoras(
  inicio: string,
  fin: string,
  mensajes: {
    faltantes?: string
    orden?: string
  } = {},
): string {
  const faltantes = mensajes.faltantes ?? 'Indica la hora de apertura y la de cierre.'
  const orden = mensajes.orden ?? 'La hora de cierre debe ser posterior a la de apertura.'
  if (!inicio || !fin) return faltantes
  const minInicio = horaAMinutos(inicio)
  const minFin = horaAMinutos(fin)
  if (minInicio === null || minFin === null) return faltantes
  if (minFin <= minInicio) return orden
  return ''
}

export function fechaHoyMexico(ahora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_NEGOCIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora)
}

export function esFechaCalendario(valor: string): boolean {
  if (!PATRON_FECHA.test(valor)) return false
  const ms = Date.parse(`${valor}T00:00:00Z`)
  if (!Number.isFinite(ms)) return false
  return new Date(ms).toISOString().slice(0, 10) === valor
}

export function validarFechaNoPasada(
  fecha: string,
  opciones: { horaFin?: string; ahora?: Date; mensaje?: string } = {},
): string {
  if (!fecha) return ''
  const ahora = opciones.ahora ?? new Date()
  const hoy = fechaHoyMexico(ahora)
  const mensaje = opciones.mensaje ?? 'No puedes bloquear fechas que ya pasaron.'
  if (fecha < hoy) return mensaje
  if (
    opciones.horaFin &&
    new Date(`${fecha}T${opciones.horaFin}:00-06:00`).getTime() <= ahora.getTime()
  ) {
    return mensaje
  }
  return ''
}

export function validarRangoFechas(
  desde: string,
  hasta: string,
  opciones: {
    maxDias?: number
    mensajeFaltantes?: string
    mensajeFormato?: string
    mensajeOrden?: string
    mensajeMaxDias?: string
  } = {},
): string {
  if (!desde || !hasta) {
    return opciones.mensajeFaltantes ?? 'Ingresa la fecha inicial y la fecha final.'
  }
  if (!esFechaCalendario(desde) || !esFechaCalendario(hasta)) {
    return opciones.mensajeFormato ?? 'Ingresa fechas válidas con formato AAAA-MM-DD.'
  }
  if (desde > hasta) {
    return opciones.mensajeOrden ?? 'La fecha inicial no puede ser posterior a la fecha final.'
  }
  if (opciones.maxDias !== undefined) {
    const dias = (Date.parse(hasta) - Date.parse(desde)) / 86400000 + 1
    if (dias > opciones.maxDias) {
      return opciones.mensajeMaxDias ?? `El periodo no puede pasar de ${opciones.maxDias} días.`
    }
  }
  return ''
}

export function validarMotivo(
  texto: string,
  complemento: string,
  min = 20,
  max = 500,
): string {
  return longitudEntre(texto, min, max, {
    mensajeVacio: `Escribe el motivo ${complemento}.`,
    mensajeMin: `El motivo debe tener al menos ${min} caracteres.`,
    mensajeMax: `El motivo no puede exceder ${max} caracteres.`,
  })
}

export function idErrorCampo(idCampo: string): string {
  return `${idCampo}-error`
}

export function atributosErrorCampo(
  idCampo: string,
  error?: string,
  descritoPorExtra?: string,
): {
  'aria-invalid': boolean
  'aria-describedby': string | undefined
} {
  const hayError = Boolean(error)
  const partes = [hayError ? idErrorCampo(idCampo) : '', descritoPorExtra ?? '']
    .map((parte) => parte.trim())
    .filter(Boolean)
  return {
    'aria-invalid': hayError,
    'aria-describedby': partes.length > 0 ? partes.join(' ') : undefined,
  }
}

export function primerCampoConError<K extends string>(
  errores: ErroresFormulario<K>,
  orden: readonly K[],
): K | null {
  for (const campo of orden) {
    if (errores[campo]) return campo
  }
  return null
}

export function enfocarPrimerError<K extends string>(
  errores: ErroresFormulario<K>,
  orden: readonly K[],
  mapaIds: Partial<Record<K, string>> = {},
): K | null {
  const primero = primerCampoConError(errores, orden)
  if (!primero) return null
  const id = mapaIds[primero] ?? primero
  const elemento = document.getElementById(id)
  if (elemento && typeof elemento.focus === 'function') {
    elemento.focus()
  }
  return primero
}

export function tieneErrores<K extends string>(errores: ErroresFormulario<K>): boolean {
  return Object.values(errores).some((mensaje) => Boolean(mensaje))
}

export function notificarErroresFormulario<K extends string>(
  errores: ErroresFormulario<K>,
  orden: readonly K[],
  opciones: {
    mapaIds?: Partial<Record<K, string>>
    mostrarAviso?: boolean
    mensajeAviso?: string
  } = {},
): boolean {
  if (!tieneErrores(errores)) return true
  enfocarPrimerError(errores, orden, opciones.mapaIds)
  if (opciones.mostrarAviso) {
    void aviso(opciones.mensajeAviso ?? MENSAJE_RESUMEN_VALIDACION)
  }
  return false
}
