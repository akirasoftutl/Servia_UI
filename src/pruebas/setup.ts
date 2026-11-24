import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { reiniciarMockAlertas, swalFireMock } from './mockAlertas'

vi.mock('sweetalert2', () => ({
  default: {
    fire: (...args: Parameters<typeof swalFireMock>) => swalFireMock(...args),
  },
}))

beforeEach(() => {
  reiniciarMockAlertas()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
