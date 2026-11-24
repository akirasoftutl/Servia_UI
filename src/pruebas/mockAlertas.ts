import { vi } from 'vitest'
import type { SweetAlertOptions, SweetAlertResult } from 'sweetalert2'

const resultadoConfirmado = (): SweetAlertResult => ({
  isConfirmed: true,
  isDenied: false,
  isDismissed: false,
  value: true,
})

const resultadoCancelado = (dismiss = 'cancel'): SweetAlertResult => ({
  isConfirmed: false,
  isDenied: false,
  isDismissed: true,
  dismiss: dismiss as SweetAlertResult['dismiss'],
})

export const swalFireMock = vi.fn<(opciones?: SweetAlertOptions) => Promise<SweetAlertResult>>()
export const swalIsVisibleMock = vi.fn<() => boolean>()

let alertaVisible = false
let colaConfirmaciones: SweetAlertResult[] = []

export function reiniciarMockAlertas() {
  alertaVisible = false
  colaConfirmaciones = []
  swalIsVisibleMock.mockReset()
  swalIsVisibleMock.mockImplementation(() => alertaVisible)
  swalFireMock.mockReset()
  swalFireMock.mockImplementation(async (opciones?: SweetAlertOptions) => {
    if (opciones?.showCancelButton) {
      const respuesta = colaConfirmaciones.shift()
      if (!respuesta) {
        throw new Error(
          `Confirmación de SweetAlert2 sin configurar en la prueba («${String(opciones.title ?? '')}»). ` +
            'Llama a mockearConfirmacion(true | false) antes de disparar la acción.',
        )
      }
      return respuesta
    }
    return resultadoConfirmado()
  })
}

export function mockearAlertaVisible(visible: boolean) {
  alertaVisible = visible
}

export function mockearConfirmacion(confirmada: boolean, motivoCierre = 'cancel') {
  colaConfirmaciones.push(confirmada ? resultadoConfirmado() : resultadoCancelado(motivoCierre))
}

export function mockearConfirmaciones(...respuestas: boolean[]) {
  for (const confirmada of respuestas) {
    mockearConfirmacion(confirmada)
  }
}

export function llamadasAlertas(): SweetAlertOptions[] {
  return swalFireMock.mock.calls.map(([opciones]) => (opciones ?? {}) as SweetAlertOptions)
}

export function ultimaAlerta(): SweetAlertOptions | undefined {
  const llamadas = llamadasAlertas()
  return llamadas[llamadas.length - 1]
}

reiniciarMockAlertas()
