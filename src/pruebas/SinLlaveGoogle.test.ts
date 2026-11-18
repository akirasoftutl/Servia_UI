// La llave de Google vive solo en la API (#40): el panel pide sugerencias a
// `/lugares` y nunca llama a Places ni guarda una llave de Google.
const archivos = import.meta.glob(['/src/**/*.{ts,tsx,css}', '!/src/pruebas/SinLlaveGoogle.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// fonts.googleapis.com (tipografías) no es de Places y queda permitido.
const PROHIBIDO = /(maps|places)\.googleapis\.com|AIza[0-9A-Za-z_-]{10,}|GOOGLE/

it('ningún archivo del panel menciona la API de Places, una llave de Google ni variables GOOGLE', () => {
  expect(Object.keys(archivos).length).toBeGreaterThan(10)
  const conCoincidencia = Object.entries(archivos)
    .filter(([, contenido]) => PROHIBIDO.test(contenido))
    .map(([ruta]) => ruta)
  expect(conCoincidencia).toEqual([])
})

it('las sugerencias se piden a la API de Servia, no a Google', () => {
  const gancho = archivos['/src/paginas/mi_perfil/useAutocompletarDomicilio.ts']
  expect(gancho).toContain('/lugares/autocompletar')
  expect(gancho).not.toMatch(/googleapis|https?:\/\//)
})
