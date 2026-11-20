import { existsSync } from 'node:fs'
import { join } from 'node:path'

describe('carpeta de reservas (#116)', () => {
  it('C6: el archivo suelto «R» ya no existe', () => {
    expect(existsSync(join(__dirname, 'R'))).toBe(false)
  })
})
