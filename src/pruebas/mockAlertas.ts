import { vi } from 'vitest'
import type { SweetAlertOptions, SweetAlertResult } from 'sweetalert2'

const resultadoConfirmado = (): SweetAlertResult => ({
  isConfirmed: true,
  isDenied: false,
  isDismissed: false,
  value: true,
})

const resultadoCancelado = (): SweetAlertResult => ({
  isConfirmed: false,
  isDenied: false,
  isDismissed: true,
  dismiss: 'cancel' as SweetAlertResult['dismiss'],
})

export const swalFireMock = vi.fn<(opciones?: SweetAlertOptions) => Promise<SweetAlertResult>>()

export function reiniciarMockAlertas() {
  swalFireMock.mockReset()
  swalFireMock.mockResolvedValue(resultadoConfirmado())
}

export function mockearConfirmacion(confirmada: boolean) {
  swalFireMock.mockResolvedValueOnce(confirmada ? resultadoConfirmado() : resultadoCancelado())
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
