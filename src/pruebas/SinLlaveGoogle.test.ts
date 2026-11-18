import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// La llave de Google vive solo en la API (#40): el panel pide sugerencias a
// `/lugares` y nunca llama a Places ni guarda una llave de Google.
// Se lee con `fs` porque Vitest entrega vacíos los `.css` importados con `?raw`.
const ESTA_PRUEBA = 'src/pruebas/SinLlaveGoogle.test.ts'

const archivos: Record<string, string> = Object.fromEntries(
  readdirSync('src', { recursive: true, encoding: 'utf8' })
    .map((ruta) => join('src', ruta).split('\\').join('/'))
    .filter((ruta) => /\.(ts|tsx|css)$/.test(ruta) && ruta !== ESTA_PRUEBA)
    .map((ruta) => [ruta, readFileSync(ruta, 'utf8')]),
)

// fonts.googleapis.com (tipografías) no es de Places y queda permitido.
const PROHIBIDO = /(maps|places)\.googleapis\.com|AIza[0-9A-Za-z_-]{10,}|GOOGLE/

it('lee los archivos del panel, incluidos los CSS con su contenido', () => {
  expect(Object.keys(archivos).length).toBeGreaterThan(10)
  const css = Object.entries(archivos).filter(([ruta]) => ruta.endsWith('.css'))
  expect(css.length).toBeGreaterThan(5)
  expect(css.filter(([, contenido]) => contenido.trim() === '').map(([ruta]) => ruta)).toEqual([])
  expect(archivos['src/componentes/sidebar/Sidebar.css']).toContain('fonts.googleapis.com')
})

it('ningún archivo del panel menciona la API de Places, una llave de Google ni variables GOOGLE', () => {
  const conCoincidencia = Object.entries(archivos)
    .filter(([, contenido]) => PROHIBIDO.test(contenido))
    .map(([ruta]) => ruta)
  expect(conCoincidencia).toEqual([])
})

it('las sugerencias se piden a la API de Servia, no a Google', () => {
  const gancho = archivos['src/paginas/mi_perfil/useAutocompletarDomicilio.ts']
  expect(gancho).toContain('/lugares/autocompletar')
  expect(gancho).not.toMatch(/googleapis|https?:\/\//)
})
