import { MENSAJE_TELEFONO_INVALIDO, MENSAJE_TELEFONO_OBLIGATORIO, normalizarTelefono, validarTelefono } from './telefono'

describe('teléfono del negocio (#122)', () => {
  it('quita espacios, guiones y paréntesis', () => {
    expect(normalizarTelefono('477 123 4567')).toBe('4771234567')
    expect(normalizarTelefono('(477) 123-4567')).toBe('4771234567')
    expect(normalizarTelefono(' 477-123-4567 ')).toBe('4771234567')
  })

  it('acepta solo 10 dígitos y explica el error en español', () => {
    expect(validarTelefono('(477) 123-4567')).toBe('')
    expect(validarTelefono('477 123 456')).toBe(MENSAJE_TELEFONO_INVALIDO)
    expect(validarTelefono('477 123 45678')).toBe(MENSAJE_TELEFONO_INVALIDO)
    expect(validarTelefono('477 123 45ab')).toBe(MENSAJE_TELEFONO_INVALIDO)
    expect(validarTelefono('  ')).toBe(MENSAJE_TELEFONO_OBLIGATORIO)
  })
})
