import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { api, ErrorApi } from '../../servicios/api'
import { VistaPrevia } from './VistaPrevia'

vi.mock('../../servicios/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../servicios/api')>()
  return { ...actual, api: vi.fn() }
})
const apiMock = vi.mocked(api)
const perfil = {
  id: 'dueno', nombre: 'Barbería Norte', categoriaId: 'cabello',
  descripcion: 'Cortes y barba', direccionTexto: 'Juárez 10, León',
  telefono: '4771234567', correoContacto: 'norte@correo.com',
  activo: true, perfilCompleto: true, camposFaltantes: [], serviciosActivos: 1,
  aceptaReservas: true, tieneHorario: true, visible: true,
}
const servicios = [
  { id: 'corte', nombre: 'Corte clásico', precio: 150, duracionMin: 30 },
  { id: 'inactivo', nombre: 'Servicio retirado', precio: 99, duracionMin: 10, activo: false },
]
function responder(cambios: Record<string, unknown> = {}, publico: Record<string, unknown> = {}) {
  apiMock.mockImplementation(async (ruta) => {
    if (ruta === '/negocios/mio') return { ...perfil, ...cambios }
    if (ruta === '/categorias') return [{ id: 'cabello', nombre: 'Cabello y barba' }]
    if (ruta.endsWith('/servicios') || ruta.endsWith('?estado=activos')) return servicios
    if (ruta === '/negocios/dueno') return { ...perfil, nombre: 'Nombre público', ...publico }
    throw new Error(`Ruta inesperada: ${ruta}`)
  })
}
function abrir() {
  return render(<MemoryRouter><VistaPrevia /></MemoryRouter>)
}
beforeEach(() => { apiMock.mockReset() })

describe('Vista previa', () => {
  it('C1 muestra cada dato público y resuelve el nombre de la categoría', async () => {
    responder()
    abrir()
    for (const dato of ['Nombre público', 'Cabello y barba', 'Cortes y barba', 'Juárez 10, León', '4771234567', 'norte@correo.com']) {
      expect(await screen.findByText(dato)).toBeInTheDocument()
    }
    expect(apiMock).toHaveBeenCalledWith('/negocios/dueno')
    expect(screen.queryByText('Así te verán cuando aparezcas')).not.toBeInTheDocument()
  })

  it('C2 muestra precio y duración, excluye inactivos y conserva servicios públicos sin campo activo', async () => {
    responder()
    abrir()
    expect(await screen.findByText('Corte clásico')).toBeInTheDocument()
    expect(screen.getByText('$150.00 · 30 minutos')).toBeInTheDocument()
    expect(screen.queryByText('Servicio retirado')).not.toBeInTheDocument()
    expect(apiMock).toHaveBeenCalledWith('/negocios/dueno/servicios')
  })

  it.each([
    ['cuenta desactivada', { activo: false, perfilCompleto: false, serviciosActivos: 0 }, 'tu cuenta está desactivada'],
    ['perfil incompleto', { perfilCompleto: false, camposFaltantes: ['nombre', 'telefono'], serviciosActivos: 0 }, 'falta completar el perfil: nombre, telefono'],
    ['sin servicios', { serviciosActivos: 0 }, 'no tienes servicios activos'],
  ])('C3 explica %s pese a visible guardado true y consulta datos propios', async (_, cambios, motivo) => {
    responder(cambios)
    abrir()
    expect(await screen.findByText(`No aparece en las búsquedas porque ${motivo}.`)).toBeInTheDocument()
    expect(screen.getByText('Así te verán cuando aparezcas')).toBeInTheDocument()
    expect(screen.getByText('Barbería Norte')).toBeInTheDocument()
    expect(apiMock).toHaveBeenCalledWith('/negocios/mio/servicios?estado=activos')
    expect(apiMock.mock.calls.some(([ruta]) => ruta.startsWith('/negocios/dueno'))).toBe(false)
    expect(screen.queryByText('Servicio retirado')).not.toBeInTheDocument()
  })

  it.each(['/negocios/dueno', '/negocios/dueno/servicios'])('F1 arma la vista desde /mio si %s responde 404 por el desfase de visibilidad', async (fallo) => {
    responder({ visible: false })
    const respuesta = apiMock.getMockImplementation()!
    apiMock.mockImplementation((ruta, opciones) => ruta === fallo
      ? Promise.reject(new ErrorApi(404, 'Negocio no encontrado')) : respuesta(ruta, opciones))
    abrir()
    expect(await screen.findByText('Barbería Norte')).toBeInTheDocument()
    expect(screen.getByText('Así te verán cuando aparezcas')).toBeInTheDocument()
    expect(screen.getByText('Corte clásico')).toBeInTheDocument()
    expect(screen.getByText('$150.00 · 30 minutos')).toBeInTheDocument()
    expect(screen.getByText('Cabello y barba')).toBeInTheDocument()
    expect(screen.queryByText('Servicio retirado')).not.toBeInTheDocument()
    expect(screen.queryByText('Nombre público')).not.toBeInTheDocument()
    expect(screen.queryByText('Tu negocio aparece en las búsquedas.')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(apiMock).toHaveBeenCalledWith('/negocios/mio')
    expect(apiMock).toHaveBeenCalledWith(fallo)
    expect(apiMock).toHaveBeenCalledWith('/negocios/mio/servicios?estado=activos')
  })

  it.each(['/negocios/dueno', '/negocios/dueno/servicios'])('F1 conserva el error y permite reintentar si %s responde 500', async (fallo) => {
    responder()
    const respuesta = apiMock.getMockImplementation()!
    apiMock.mockImplementation((ruta, opciones) => ruta === fallo
      ? Promise.reject(new ErrorApi(500, 'Error del servidor')) : respuesta(ruta, opciones))
    abrir()
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar la vista previa.')
    expect(screen.queryByText('Así te verán cuando aparezcas')).not.toBeInTheDocument()
    expect(apiMock).not.toHaveBeenCalledWith('/negocios/mio/servicios?estado=activos')
    responder()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Nombre público')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    ['pausa', { aceptaReservas: false, tieneHorario: true }],
    ['sin horario', { aceptaReservas: true, tieneHorario: false }],
  ])('C3 anuncia que no acepta reservas por %s', async (_, cambios) => {
    responder(cambios)
    abrir()
    expect(await screen.findByText('No acepta reservas por ahora')).toBeInTheDocument()
  })

  it('C3 no anuncia pausa si tiene horario y acepta reservas', async () => {
    responder()
    abrir()
    await screen.findByText('Nombre público')
    expect(screen.queryByText('No acepta reservas por ahora')).not.toBeInTheDocument()
  })

  it('C4 solo lee, no ofrece edición y vuelve a Mi perfil sin guardar', async () => {
    responder()
    const { container } = render(<MemoryRouter initialEntries={['/vista']}><Routes>
      <Route path="/vista" element={<VistaPrevia />} />
      <Route path="/mi-perfil" element={<h1>Mi perfil de regreso</h1>} />
    </Routes></MemoryRouter>)
    await screen.findByText('Nombre público')
    expect(container.querySelector('input, textarea, select, form, [contenteditable="true"]')).toBeNull()
    expect(screen.queryByRole('button', { name: /guardar|editar/i })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Volver a Mi perfil' }))
    expect(screen.getByText('Mi perfil de regreso')).toBeInTheDocument()
    expect(apiMock.mock.calls.length).toBeGreaterThan(0)
    expect(apiMock.mock.calls.every(([, opciones]) => (opciones?.method ?? 'GET') === 'GET')).toBe(true)
  })

  it('C5 muestra carga, error y reintenta sin alert', async () => {
    const alerta = vi.spyOn(window, 'alert').mockImplementation(() => {})
    let rechazar!: (motivo: Error) => void
    apiMock.mockImplementation(() => new Promise((_, reject) => { rechazar = reject }))
    abrir()
    expect(screen.getByRole('status')).toHaveTextContent('Cargando vista previa...')
    rechazar(new Error('Fallo simulado'))
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar la vista previa.')
    responder()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Nombre público')).toBeInTheDocument()
    expect(apiMock.mock.calls.filter(([ruta]) => ruta === '/negocios/mio')).toHaveLength(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(alerta).not.toHaveBeenCalled()
  })

  it.each(['/negocios/dueno', '/negocios/dueno/servicios', '/negocios/mio/servicios?estado=activos'])('C5 maneja fallo en %s', async (fallo) => {
    responder(fallo.includes('?') ? { serviciosActivos: 0 } : {})
    const respuesta = apiMock.getMockImplementation()!
    apiMock.mockImplementation((ruta, opciones) => ruta === fallo ? Promise.reject(new Error('Fallo')) : respuesta(ruta, opciones))
    abrir()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it.each([
    { caso: 'público con HTTP 500', cambios: {}, fallo: new ErrorApi(500, 'Error del servidor'), nombre: 'Nombre público' },
    { caso: 'propio con error de red', cambios: { serviciosActivos: 0 }, fallo: new Error('Sin conexión'), nombre: 'Barbería Norte' },
  ])('F2 muestra el perfil $caso aunque falle /categorias', async ({ cambios, fallo, nombre }) => {
    responder(cambios)
    const respuesta = apiMock.getMockImplementation()!
    apiMock.mockImplementation((ruta, opciones) => ruta === '/categorias'
      ? Promise.reject(fallo) : respuesta(ruta, opciones))
    abrir()
    expect(await screen.findByText(nombre)).toBeInTheDocument()
    for (const dato of ['Categoría no disponible', 'Cortes y barba', 'Juárez 10, León', '4771234567', 'norte@correo.com', 'Corte clásico', '$150.00 · 30 minutos']) {
      expect(screen.getByText(dato)).toBeInTheDocument()
    }
    expect(screen.queryByText('Servicio retirado')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    expect(apiMock).toHaveBeenCalledWith('/categorias')
  })

  it('contempla dirección estructurada, categoría ausente y servicios vacíos', async () => {
    responder({ serviciosActivos: 0, categoriaId: 'ausente', direccionTexto: '', direccion: {
      calle: 'Juárez', numeroExterior: '10', numeroInterior: '2', colonia: 'Centro', codigoPostal: '37000', municipio: 'León', estado: 'Guanajuato',
    } })
    const respuesta = apiMock.getMockImplementation()!
    apiMock.mockImplementation((ruta, opciones) => ruta.includes('/servicios') ? Promise.resolve([]) : respuesta(ruta, opciones))
    abrir()
    expect(await screen.findByText('Juárez, 10, Int. 2, Centro, 37000, León, Guanajuato')).toBeInTheDocument()
    expect(screen.getByText('Categoría no disponible')).toBeInTheDocument()
    expect(screen.getByText('No hay servicios activos para mostrar.')).toBeInTheDocument()
  })

  it('no actualiza la pantalla después de desmontar', async () => {
    let resolver!: (valor: unknown) => void
    apiMock.mockReturnValue(new Promise(resolve => { resolver = resolve }))
    const vista = abrir()
    vista.unmount()
    responder()
    resolver(perfil)
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/categorias'))
    expect(screen.queryByText('Nombre público')).not.toBeInTheDocument()
  })
})
