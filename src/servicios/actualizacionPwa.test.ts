import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RegisterSWOptions } from 'vite-plugin-pwa/types'
import { CLAVE_ACTUALIZADA, iniciarActualizacionPwa } from './actualizacionPwa'

const MINUTO = 60 * 1000

function preparar(opciones: { confirmaciones?: boolean[] } = {}) {
  const respuestas = [...(opciones.confirmaciones ?? [])]
  let registroOpciones: RegisterSWOptions = {}
  const updateSW = vi.fn().mockResolvedValue(undefined)
  const registerSW = vi.fn((o?: RegisterSWOptions) => {
    registroOpciones = o ?? {}
    return updateSW
  })
  const alertas = {
    confirmar: vi.fn(async () => respuestas.shift() ?? false),
    exito: vi.fn().mockResolvedValue(undefined),
  }
  const registration = { update: vi.fn().mockResolvedValue(undefined), installing: null }
  const detener = iniciarActualizacionPwa({ registerSW, alertas })
  const registrar = () =>
    registroOpciones.onRegisteredSW?.('/sw.js', registration as unknown as ServiceWorkerRegistration)
  return {
    updateSW,
    alertas,
    registration,
    detener,
    registrar,
    nuevaVersion: () => registroOpciones.onNeedRefresh?.(),
    offlineListo: () => registroOpciones.onOfflineReady?.(),
  }
}

describe('actualizacionPwa', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    sessionStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('pregunta con «Actualizar» y «Más tarde» al llegar una versión nueva', async () => {
    const t = preparar({ confirmaciones: [false] })
    t.nuevaVersion()
    await vi.advanceTimersByTimeAsync(0)
    expect(t.alertas.confirmar).toHaveBeenCalledTimes(1)
    expect(t.alertas.confirmar).toHaveBeenCalledWith(
      expect.objectContaining({
        titulo: 'Hay una versión nueva de Servia',
        texto: '¿Actualizar ahora?',
        confirmar: 'Actualizar',
        cancelar: 'Más tarde',
      }),
    )
    t.detener()
  })

  it('«Actualizar» llama updateSW(true) y deja la marca', async () => {
    const t = preparar({ confirmaciones: [true] })
    t.nuevaVersion()
    await vi.advanceTimersByTimeAsync(0)
    expect(t.updateSW).toHaveBeenCalledWith(true)
    expect(sessionStorage.getItem(CLAVE_ACTUALIZADA)).toBe('1')
    t.detener()
  })

  it('«Más tarde» no actualiza ni vuelve a preguntar hasta la siguiente comprobación', async () => {
    const t = preparar({ confirmaciones: [false, false] })
    t.nuevaVersion()
    await vi.advanceTimersByTimeAsync(0)
    t.nuevaVersion()
    await vi.advanceTimersByTimeAsync(0)
    expect(t.updateSW).not.toHaveBeenCalled()
    expect(t.alertas.confirmar).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(60 * MINUTO)
    expect(t.alertas.confirmar).toHaveBeenCalledTimes(2)
    expect(t.updateSW).not.toHaveBeenCalled()
    t.detener()
  })

  it('no duplica la alerta si onNeedRefresh se dispara varias veces', async () => {
    const t = preparar({ confirmaciones: [true] })
    t.nuevaVersion()
    t.nuevaVersion()
    t.nuevaVersion()
    await vi.advanceTimersByTimeAsync(0)
    expect(t.alertas.confirmar).toHaveBeenCalledTimes(1)
    t.detener()
  })

  it('tras actualizar muestra el aviso una sola vez', async () => {
    sessionStorage.setItem(CLAVE_ACTUALIZADA, '1')
    const primera = preparar()
    expect(primera.alertas.exito).toHaveBeenCalledTimes(1)
    expect(primera.alertas.exito).toHaveBeenCalledWith(
      'Servia se actualizó a la última versión.',
      expect.any(String),
    )
    expect(sessionStorage.getItem(CLAVE_ACTUALIZADA)).toBeNull()
    primera.detener()
    const segunda = preparar()
    expect(segunda.alertas.exito).not.toHaveBeenCalled()
    segunda.detener()
  })

  it('sin actualizar no muestra aviso de «se actualizó» ni al quedar lista sin conexión', () => {
    const t = preparar()
    t.offlineListo()
    expect(t.alertas.exito).not.toHaveBeenCalled()
    expect(t.alertas.confirmar).not.toHaveBeenCalled()
    t.detener()
  })

  it('comprueba actualizaciones cada 60 minutos con registration.update()', async () => {
    const t = preparar()
    t.registrar()
    expect(t.registration.update).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(60 * MINUTO)
    expect(t.registration.update).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(60 * MINUTO)
    expect(t.registration.update).toHaveBeenCalledTimes(2)
    t.detener()
  })

  it('comprueba al volver la conexión', () => {
    const t = preparar()
    t.registrar()
    window.dispatchEvent(new Event('online'))
    expect(t.registration.update).toHaveBeenCalledTimes(1)
    t.detener()
  })

  it('al volver a la pestaña comprueba, pero no más de una vez cada 5 minutos', async () => {
    const t = preparar()
    t.registrar()
    document.dispatchEvent(new Event('visibilitychange'))
    document.dispatchEvent(new Event('visibilitychange'))
    expect(t.registration.update).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(6 * MINUTO)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(t.registration.update).toHaveBeenCalledTimes(2)
    t.detener()
  })
})
