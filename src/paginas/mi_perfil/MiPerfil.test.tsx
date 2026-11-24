import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'
import { api, descargarMapaNegocio, ErrorApi } from '../../servicios/api'
import { MiPerfil } from './MiPerfil'
import { AVISO_REVISAR, AVISO_SUGERENCIA } from './CampoCalle'

vi.mock('../../servicios/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../servicios/api')>()
  return { ...actual, api: vi.fn(), descargarMapaNegocio: vi.fn() }
})

// Sin sesión simulada, la sección «Cambiar contraseña» (MVP-04) no se muestra aquí; se prueba en CambiarContrasena.test.tsx.
vi.mock('../../contextos/AuthContext', () => ({ useAuth: () => ({ usuario: null }) }))

const apiMock = vi.mocked(api)
const mapaMock = vi.mocked(descargarMapaNegocio)

const direccionGuardada = {
  calle: 'Blvd. Adolfo López Mateos',
  numeroExterior: '123',
  numeroInterior: '4',
  colonia: 'Centro',
  codigoPostal: '37000',
  municipio: 'León',
  estado: 'Guanajuato',
}

const perfilBase = {
  aceptaReservas: true,
  nombre: 'Barbería Norte',
  descripcion: 'Cortes y barba',
  categoriaId: 'cabello-barba',
  telefono: '4771234567',
  correoContacto: 'norte@correo.com',
  perfilCompleto: true,
  camposFaltantes: [],
}

function responder(perfil: Record<string, unknown>) {
  apiMock.mockImplementation(async (ruta: string, opciones?: RequestInit) => {
    if (ruta === '/categorias') return [{ id: 'cabello-barba', nombre: 'Cabello y barba' }]
    if (ruta === '/negocios/mio' && opciones?.method === 'PUT') return { ...perfilBase, ...JSON.parse(String(opciones.body)), direccionTexto: '' }
    return perfil
  })
}

async function abrirPaso2() {
  render(<MemoryRouter><MiPerfil /></MemoryRouter>)
  await screen.findByLabelText(/Correo de contacto/i)
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await screen.findByLabelText('Calle *')
}

const escribir = async (etiqueta: string, texto: string) => {
  const campo = screen.getByLabelText(etiqueta)
  await userEvent.clear(campo)
  if (texto) await userEvent.type(campo, texto)
}

async function llenarDireccion() {
  await escribir('Calle *', 'Juárez')
  await escribir('Número exterior *', '10')
  await escribir('Colonia *', 'Centro')
  await escribir('Código postal *', '37000')
  await escribir('Municipio *', 'León')
  await userEvent.selectOptions(screen.getByLabelText('Estado *'), 'Guanajuato')
}

describe('Mi perfil: dirección por campos', () => {
  beforeEach(() => {
    apiMock.mockReset()
    window.scrollTo = vi.fn()
  })

  it('muestra los 7 campos de la dirección, con el estado como lista de 32', async () => {
    responder({ ...perfilBase, direccion: null, direccionTexto: '' })
    await abrirPaso2()
    for (const etiqueta of ['Calle *', 'Número exterior *', 'Número interior', 'Colonia *', 'Código postal *', 'Municipio *']) {
      expect(screen.getByLabelText(etiqueta)).toBeInTheDocument()
    }
    const estado = screen.getByLabelText('Estado *')
    expect(estado.tagName).toBe('SELECT')
    expect(screen.getAllByRole('option')).toHaveLength(33)
    expect(screen.getByRole('option', { name: 'Michoacán' })).toBeInTheDocument()
  })

  it('llena los campos cuando la dirección llega como objeto', async () => {
    responder({ ...perfilBase, direccion: direccionGuardada, direccionTexto: 'texto armado' })
    await abrirPaso2()
    expect(screen.getByLabelText('Calle *')).toHaveValue('Blvd. Adolfo López Mateos')
    expect(screen.getByLabelText('Número exterior *')).toHaveValue('123')
    expect(screen.getByLabelText('Número interior')).toHaveValue('4')
    expect(screen.getByLabelText('Colonia *')).toHaveValue('Centro')
    expect(screen.getByLabelText('Código postal *')).toHaveValue('37000')
    expect(screen.getByLabelText('Municipio *')).toHaveValue('León')
    expect(screen.getByLabelText('Estado *')).toHaveValue('Guanajuato')
    expect(screen.queryByText(/guardada como texto/)).not.toBeInTheDocument()
  })

  it('con dirección vieja en texto muestra el aviso y deja los campos vacíos', async () => {
    responder({ ...perfilBase, direccion: null, direccionTexto: 'Av. Las Torres 123, Col. Centro' })
    await abrirPaso2()
    expect(screen.getByText('Tu dirección está guardada como texto. Captúrala por campos para actualizarla')).toBeInTheDocument()
    expect(screen.getByText('Av. Las Torres 123, Col. Centro')).toBeInTheDocument()
    expect(screen.getByLabelText('Calle *')).toHaveValue('')
    expect(screen.getByLabelText('Estado *')).toHaveValue('')
  })

  it('muestra el error en español junto a cada campo y no avanza', async () => {
    responder({ ...perfilBase, direccion: { ...direccionGuardada, codigoPostal: '123', calle: 'a', estado: 'Guanajuato' }, direccionTexto: '' })
    await abrirPaso2()
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByLabelText('Código postal *')).toHaveClass('is-invalid')
    expect(screen.getByText('El código postal debe contener exactamente 5 dígitos')).toBeInTheDocument()
    expect(screen.getByText('La calle debe tener entre 2 y 100 caracteres')).toBeInTheDocument()
    expect(screen.queryByText('Categoría del negocio')).not.toBeInTheDocument()
  })

  it('exige el estado de la lista y los campos obligatorios', async () => {
    responder({ ...perfilBase, direccion: null, direccionTexto: '' })
    await abrirPaso2()
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByText('Selecciona un estado de la lista')).toBeInTheDocument()
    expect(screen.getByText('El municipio debe tener entre 2 y 80 caracteres')).toBeInTheDocument()
    expect(screen.getByText('La colonia debe tener entre 2 y 80 caracteres')).toBeInTheDocument()
    expect(screen.getByText('El número exterior debe tener entre 1 y 10 caracteres')).toBeInTheDocument()
  })

  it('guarda con PUT /negocios/mio mandando direccion como objeto', async () => {
    responder({ ...perfilBase, direccion: null, direccionTexto: 'Texto viejo' })
    await abrirPaso2()
    await llenarDireccion()
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar cambios' }))
    await screen.findByText('Perfil actualizado correctamente', { exact: false })
    const put = apiMock.mock.calls.find(([, o]) => o?.method === 'PUT')!
    expect(put[0]).toBe('/negocios/mio')
    const cuerpo = JSON.parse(String(put[1]!.body))
    expect(cuerpo.direccion).toEqual({
      calle: 'Juárez',
      numeroExterior: '10',
      colonia: 'Centro',
      codigoPostal: '37000',
      municipio: 'León',
      estado: 'Guanajuato',
    })
    expect(cuerpo.nombre).toBe('Barbería Norte')
    expect(cuerpo.categoriaId).toBe('cabello-barba')
  })

  it('muestra el error 400 de la API', async () => {
    apiMock.mockImplementation(async (ruta: string, opciones?: RequestInit) => {
      if (ruta === '/categorias') return [{ id: 'cabello-barba', nombre: 'Cabello y barba' }]
      if (opciones?.method === 'PUT') throw new ErrorApi(400, 'El estado debe ser una de las 32 entidades federativas de México.')
      return { ...perfilBase, direccion: null, direccionTexto: '' }
    })
    await abrirPaso2()
    await llenarDireccion()
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar cambios' }))
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('El estado debe ser una de las 32 entidades federativas de México.')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled())
  })
})

it('C1 abre la vista previa desde Mi perfil', async () => {
  responder({ ...perfilBase, direccion: null })
  render(<MemoryRouter initialEntries={['/mi-perfil']}><Routes>
    <Route path="/mi-perfil" element={<MiPerfil />} />
    <Route path="/mi-perfil/vista-previa" element={<h1>Destino de vista previa</h1>} />
  </Routes></MemoryRouter>)
  const enlace = await screen.findByRole('link', { name: 'Ver como cliente' })
  expect(enlace).toHaveAttribute('href', '/mi-perfil/vista-previa')
  await userEvent.click(enlace)
  expect(screen.getByText('Destino de vista previa')).toBeInTheDocument()
})

describe('Mi perfil: sugerencias de domicilio (#40)', () => {
  const SUGERENCIA = 'Blvd. Adolfo López Mateos 1102, Jardines del Moral, León, Gto., México'

  function responderConLugares(lugares: () => Promise<unknown>) {
    apiMock.mockImplementation(async (ruta: string, opciones?: RequestInit) => {
      if (ruta === '/categorias') return [{ id: 'cabello-barba', nombre: 'Cabello y barba' }]
      if (ruta.startsWith('/lugares/autocompletar')) return lugares()
      if (ruta === '/negocios/mio' && opciones?.method === 'PUT') return { ...perfilBase, ...JSON.parse(String(opciones.body)), direccionTexto: '' }
      return { ...perfilBase, direccion: direccionGuardada, direccionTexto: '' }
    })
  }

  const llamadasALugares = () => apiMock.mock.calls.filter(([ruta]) => ruta.startsWith('/lugares'))

  async function guardar() {
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar cambios' }))
    await screen.findByText('Perfil actualizado correctamente', { exact: false })
    const put = apiMock.mock.calls.find(([, o]) => o?.method === 'PUT')!
    return JSON.parse(String(put[1]!.body))
  }

  beforeEach(() => {
    apiMock.mockReset()
    window.scrollTo = vi.fn()
  })

  it('no pide sugerencias al cargar el perfil, solo al teclear en la calle', async () => {
    responderConLugares(async () => [{ texto: SUGERENCIA }])
    await abrirPaso2()
    expect(screen.getByLabelText('Calle *')).toHaveValue('Blvd. Adolfo López Mateos')
    await new Promise((r) => setTimeout(r, 400))
    expect(llamadasALugares()).toHaveLength(0)
    expect(screen.getByLabelText('Calle *')).toHaveAttribute('aria-expanded', 'false')
  })

  it('elegir con teclado sobrescribe la calle y el PUT manda la dirección por campos', async () => {
    responderConLugares(async () => [{ texto: SUGERENCIA }, { texto: 'Otra' }])
    await abrirPaso2()
    await escribir('Calle *', 'Blvd López')
    await screen.findByRole('option', { name: SUGERENCIA })
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(screen.getByLabelText('Calle *')).toHaveValue(SUGERENCIA)
    expect(screen.getByLabelText('Calle *')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Revisa que la calle quede sin colonia ni ciudad y completa el resto de los campos.')).toBeInTheDocument()
    const cuerpo = await guardar()
    expect(cuerpo.direccion).toEqual({ ...direccionGuardada, calle: SUGERENCIA })
  })

  it('escribir a mano y guardar sin elegir manda lo escrito', async () => {
    responderConLugares(async () => [{ texto: SUGERENCIA }])
    await abrirPaso2()
    await escribir('Calle *', 'Calle Hidalgo')
    await screen.findByRole('option', { name: SUGERENCIA })
    const cuerpo = await guardar()
    expect(cuerpo.direccion.calle).toBe('Calle Hidalgo')
    expect(cuerpo.direccion.colonia).toBe('Centro')
  })

  it('con 503 deja una nota discreta y se puede guardar sin alerta de error', async () => {
    responderConLugares(async () => { throw new ErrorApi(503, 'No se pudieron obtener sugerencias. Escribe la dirección a mano.') })
    await abrirPaso2()
    await escribir('Calle *', 'Calle Hidalgo')
    await screen.findByText('No hay sugerencias por ahora; escribe la dirección a mano.')
    expect(screen.getByLabelText('Calle *')).not.toHaveClass('is-invalid')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    const cuerpo = await guardar()
    expect(cuerpo.direccion.calle).toBe('Calle Hidalgo')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('Mi perfil: domicilio por campos al elegir una sugerencia (#93)', () => {
  const SUGERENCIA = 'Blvd. Adolfo López Mateos 1102, Jardines del Moral, León, Gto., México'
  const OTRA = 'Calle Hidalgo 45, Centro, León, Gto., México'
  const DETALLE = {
    calle: 'Blvd. Adolfo López Mateos',
    numeroExterior: '1102',
    colonia: 'Jardines del Moral',
    codigoPostal: '37160',
    municipio: 'León',
    estado: 'Jalisco',
  }
  const lugares = [
    { texto: SUGERENCIA, lugarId: 'lugar-1' },
    { texto: OTRA, lugarId: 'lugar-2' },
  ]

  function responderConDetalle(detalle: (lugarId: string) => Promise<unknown>) {
    apiMock.mockImplementation(async (ruta: string, opciones?: RequestInit) => {
      if (ruta === '/categorias') return [{ id: 'cabello-barba', nombre: 'Cabello y barba' }]
      if (ruta.startsWith('/lugares/autocompletar')) return lugares
      if (ruta.startsWith('/lugares/detalle')) return detalle(new URLSearchParams(ruta.split('?')[1]).get('lugarId') ?? '')
      if (ruta === '/negocios/mio' && opciones?.method === 'PUT') return { ...perfilBase, ...JSON.parse(String(opciones.body)), direccionTexto: '' }
      return { ...perfilBase, direccion: direccionGuardada, direccionTexto: '' }
    })
  }

  async function elegirPrimera() {
    await escribir('Calle *', 'Blvd López')
    await screen.findByRole('option', { name: SUGERENCIA })
    await userEvent.keyboard('{ArrowDown}{Enter}')
  }

  const valor = (etiqueta: string) => (screen.getByLabelText(etiqueta) as HTMLInputElement).value

  async function guardar() {
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar cambios' }))
    await screen.findByText('Perfil actualizado correctamente', { exact: false })
    const put = apiMock.mock.calls.find(([, o]) => o?.method === 'PUT')!
    return JSON.parse(String(put[1]!.body))
  }

  beforeEach(() => {
    apiMock.mockReset()
    window.scrollTo = vi.fn()
  })

  it('C1 y C2: llena los seis campos con su dato, conserva el interior y el PUT va por campos', async () => {
    responderConDetalle(async () => DETALLE)
    await abrirPaso2()
    await elegirPrimera()
    await waitFor(() => expect(valor('Número exterior *')).toBe('1102'))
    expect(valor('Calle *')).toBe(DETALLE.calle)
    expect(valor('Colonia *')).toBe(DETALLE.colonia)
    expect(valor('Código postal *')).toBe(DETALLE.codigoPostal)
    expect(valor('Municipio *')).toBe(DETALLE.municipio)
    expect(valor('Estado *')).toBe('Jalisco')
    expect(valor('Número interior')).toBe('4')
    expect(screen.queryByText(AVISO_REVISAR)).not.toBeInTheDocument()
    expect(screen.queryByText(AVISO_SUGERENCIA)).not.toBeInTheDocument()
    const detalle = apiMock.mock.calls.find(([ruta]) => ruta.startsWith('/lugares/detalle'))!
    const [, consulta] = detalle[0].split('?')
    const parametros = new URLSearchParams(consulta)
    const autocompletar = apiMock.mock.calls.find(([ruta]) => ruta.startsWith('/lugares/autocompletar'))!
    expect(parametros.get('lugarId')).toBe('lugar-1')
    expect(parametros.get('sesion')).toBe(new URLSearchParams(autocompletar[0].split('?')[1]).get('sesion'))
    const cuerpo = await guardar()
    expect(cuerpo.direccion).toEqual({ ...DETALLE, numeroInterior: '4' })
  })

  it('C3: un dato vacío del detalle no borra el valor actual y se ve el aviso', async () => {
    responderConDetalle(async () => ({ ...DETALLE, colonia: '', codigoPostal: '' }))
    await abrirPaso2()
    await elegirPrimera()
    expect(await screen.findByText(AVISO_REVISAR)).toBeInTheDocument()
    expect(valor('Número exterior *')).toBe('1102')
    expect(valor('Colonia *')).toBe('Centro')
    expect(valor('Código postal *')).toBe('37000')
    expect(screen.getByLabelText('Colonia *')).not.toBeDisabled()
  })

  it('C4: un estado fuera de la lista no cambia el selector', async () => {
    responderConDetalle(async () => ({ ...DETALLE, estado: 'Texas' }))
    await abrirPaso2()
    await elegirPrimera()
    expect(await screen.findByText(AVISO_REVISAR)).toBeInTheDocument()
    expect(valor('Estado *')).toBe('Guanajuato')
    expect(valor('Colonia *')).toBe('Jardines del Moral')
  })

  it.each([
    ['503', () => new ErrorApi(503, 'No se pudo obtener el lugar.')],
    ['429', () => new ErrorApi(429, 'Demasiadas solicitudes.')],
    ['red', () => new TypeError('Failed to fetch')],
  ])('C5: si el detalle falla (%s) cae a la calle con el texto y el aviso, sin bloquear', async (_caso, error) => {
    responderConDetalle(async () => { throw error() })
    await abrirPaso2()
    await elegirPrimera()
    expect(await screen.findByText(AVISO_SUGERENCIA)).toBeInTheDocument()
    expect(valor('Calle *')).toBe(SUGERENCIA)
    expect(valor('Colonia *')).toBe('Centro')
    expect(valor('Número interior')).toBe('4')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Calle *')).not.toBeDisabled()
  })

  it('C6: la respuesta tardía no pisa lo que el negocio escribió en la calle', async () => {
    let resolver: (d: unknown) => void = () => {}
    responderConDetalle(() => new Promise((r) => { resolver = r }))
    await abrirPaso2()
    await elegirPrimera()
    await escribir('Calle *', 'Calle Nueva')
    await act(async () => { resolver(DETALLE) })
    expect(valor('Calle *')).toBe('Calle Nueva')
    expect(valor('Colonia *')).toBe('Centro')
    expect(valor('Número exterior *')).toBe('123')
    expect(screen.queryByText(AVISO_REVISAR)).not.toBeInTheDocument()
  })

  it('C6: la respuesta tardía de una sugerencia anterior no pisa a la elegida después', async () => {
    const pendientes: Record<string, (d: unknown) => void> = {}
    responderConDetalle((id) => new Promise((r) => { pendientes[id] = r }))
    await abrirPaso2()
    await elegirPrimera()
    await escribir('Calle *', 'Calle Hidalgo')
    await screen.findByRole('option', { name: OTRA })
    await userEvent.click(screen.getByRole('option', { name: OTRA }))
    const nueva = { ...DETALLE, calle: 'Calle Hidalgo', numeroExterior: '45', colonia: 'Centro', codigoPostal: '37000', estado: 'Guanajuato' }
    await act(async () => { pendientes['lugar-2'](nueva) })
    await waitFor(() => expect(valor('Número exterior *')).toBe('45'))
    await act(async () => { pendientes['lugar-1'](DETALLE) })
    expect(valor('Calle *')).toBe('Calle Hidalgo')
    expect(valor('Número exterior *')).toBe('45')
    expect(valor('Colonia *')).toBe('Centro')
    expect(valor('Estado *')).toBe('Guanajuato')
  })
})

describe('Mi perfil: sección Fotos (#42)', () => {
  beforeEach(() => {
    apiMock.mockReset()
    window.scrollTo = vi.fn()
  })

  it('muestra la portada y la galería que llegan en fotos de GET /negocios/mio', async () => {
    responder({
      ...perfilBase,
      direccion: direccionGuardada,
      fotos: {
        portada: { id: 'p-1', url: 'https://cdn.servia.test/portada.jpg' },
        galeria: [
          { id: 'g-1', url: 'https://cdn.servia.test/g1.jpg' },
          { id: 'g-2', url: 'https://cdn.servia.test/g2.jpg' },
        ],
      },
    })

    render(<MemoryRouter><MiPerfil /></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: 'Fotos' })).toBeInTheDocument()
    expect(screen.getByAltText('Portada actual del negocio')).toHaveAttribute('src', 'https://cdn.servia.test/portada.jpg')
    expect(screen.getByAltText('Foto 1 de la galería')).toHaveAttribute('src', 'https://cdn.servia.test/g1.jpg')
    expect(screen.getByAltText('Foto 2 de la galería')).toHaveAttribute('src', 'https://cdn.servia.test/g2.jpg')
    expect(screen.getByText('2 / 5 en galería')).toBeInTheDocument()
  })
})

describe('Mi perfil: correo de contacto (#122)', () => {
  beforeEach(() => {
    apiMock.mockReset()
    window.scrollTo = vi.fn()
  })

  const put = () => apiMock.mock.calls.find(([, o]) => o?.method === 'PUT')

  it('C1: carga el correo de contacto desde GET /negocios/mio y el PUT envía el valor nuevo', async () => {
    responder({ ...perfilBase, correoContacto: 'viejo@negocio.com', direccion: direccionGuardada })
    render(<MemoryRouter><MiPerfil /></MemoryRouter>)
    const correo = await screen.findByLabelText(/Correo de contacto del negocio/)
    expect(correo).toHaveValue('viejo@negocio.com')

    await userEvent.clear(correo)
    await userEvent.type(correo, 'nuevo@negocio.com')
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar cambios' }))
    await screen.findByText('Perfil actualizado correctamente', { exact: false })

    expect(JSON.parse(String(put()![1]!.body)).correoContacto).toBe('nuevo@negocio.com')
    expect(JSON.parse(String(put()![1]!.body)).nombre).toBe('Barbería Norte')
  })

  it('C1: un correo inválido muestra el error en español y no avanza', async () => {
    responder({ ...perfilBase, direccion: direccionGuardada })
    render(<MemoryRouter><MiPerfil /></MemoryRouter>)
    const correo = await screen.findByLabelText(/Correo de contacto del negocio/)
    await userEvent.clear(correo)
    await userEvent.type(correo, 'sin-arroba')
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByText(/Escribe un correo válido/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Calle *')).not.toBeInTheDocument()
  })
})

describe('Mi perfil: teléfono (#122)', () => {
  beforeEach(() => {
    apiMock.mockReset()
    window.scrollTo = vi.fn()
  })

  const put = () => apiMock.mock.calls.find(([, o]) => o?.method === 'PUT')

  it('C3: normaliza espacios, guiones y paréntesis a 10 dígitos antes del PUT', async () => {
    responder({ ...perfilBase, direccion: direccionGuardada })
    render(<MemoryRouter><MiPerfil /></MemoryRouter>)
    const telefono = await screen.findByLabelText(/Teléfono de contacto/)
    await userEvent.clear(telefono)
    await userEvent.type(telefono, '(477) 123-4567')
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar cambios' }))
    await screen.findByText('Perfil actualizado correctamente', { exact: false })
    expect(JSON.parse(String(put()![1]!.body)).telefono).toBe('4771234567')
  })

  it.each(['477 123 456', '477 123 45678'])('C3: con %s muestra el error claro y no envía nada', async (valor) => {
    responder({ ...perfilBase, direccion: direccionGuardada })
    render(<MemoryRouter><MiPerfil /></MemoryRouter>)
    const telefono = await screen.findByLabelText(/Teléfono de contacto/)
    await userEvent.clear(telefono)
    await userEvent.type(telefono, valor)
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByText(/El teléfono debe tener exactamente 10 dígitos/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Teléfono de contacto/)).toHaveClass('is-invalid')
    expect(screen.queryByLabelText('Calle *')).not.toBeInTheDocument()
    expect(put()).toBeUndefined()
  })
})

describe('Mi perfil: después de guardar (#122)', () => {
  beforeEach(() => {
    apiMock.mockReset()
    window.scrollTo = vi.fn()
  })

  it('C2: sube al inicio y deja el aviso de éxito visible, sin modal que atrape', async () => {
    responder({ ...perfilBase, direccion: direccionGuardada })
    render(<MemoryRouter><MiPerfil /></MemoryRouter>)
    await screen.findByLabelText(/Correo de contacto/)
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar' }))
    const guardar = await screen.findByRole('button', { name: 'Guardar cambios' })
    vi.mocked(window.scrollTo).mockClear()

    await userEvent.click(guardar)

    const aviso = await screen.findByRole('status')
    expect(aviso).toHaveTextContent('Perfil actualizado correctamente')
    expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }))
    expect(screen.queryByText('¡Éxito!')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aceptar' })).not.toBeInTheDocument()
    // Sigue en Mi perfil y se puede seguir editando sin cerrar nada.
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
  })

  it('C2: si la API falla no sube ni muestra el aviso de éxito', async () => {
    apiMock.mockImplementation(async (ruta: string, opciones?: RequestInit) => {
      if (ruta === '/categorias') return [{ id: 'cabello-barba', nombre: 'Cabello y barba' }]
      if (opciones?.method === 'PUT') throw new ErrorApi(400, 'Datos inválidos')
      return { ...perfilBase, direccion: direccionGuardada }
    })
    render(<MemoryRouter><MiPerfil /></MemoryRouter>)
    await screen.findByLabelText(/Correo de contacto/)
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar' }))
    const guardar = await screen.findByRole('button', { name: 'Guardar cambios' })
    vi.mocked(window.scrollTo).mockClear()
    await userEvent.click(guardar)
    await screen.findByRole('alert')
    expect(screen.queryByText('Perfil actualizado correctamente')).not.toBeInTheDocument()
    expect(window.scrollTo).not.toHaveBeenCalled()
  })
})

describe('Mi perfil: limpieza (#116)', () => {
  beforeEach(() => {
    apiMock.mockReset()
    window.scrollTo = vi.fn()
  })

  it('C1: el paso 1 ya no tiene «Imagen de tu negocio» y «Fotos» explica que se suben aparte', async () => {
    responder({ ...perfilBase, direccion: direccionGuardada })
    const { container } = render(<MemoryRouter><MiPerfil /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Información general' })).toBeInTheDocument()
    expect(screen.queryByText('Imagen de tu negocio')).not.toBeInTheDocument()
    expect(screen.queryByText('Seleccionar imagen')).not.toBeInTheDocument()
    expect(container.querySelector('#logo-upload')).toBeNull()
    // Los únicos selectores de archivo son los de la sección Fotos.
    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'Fotos' })).toBeInTheDocument()
    expect(screen.getByText(/se suben aparte y al instante/)).toBeInTheDocument()
    expect(screen.getByText(/se suben aparte y al instante/)).toHaveTextContent('Guardar cambios')
  })

  it('C2: «Referencias de ubicación» ya no aparece y el PUT no la manda', async () => {
    responder({ ...perfilBase, direccion: direccionGuardada })
    await abrirPaso2()
    expect(screen.queryByText('Referencias de ubicación')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Referencias/)).not.toBeInTheDocument()
    expect(document.querySelector('textarea[name="referencias"]')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar cambios' }))
    await screen.findByText('Perfil actualizado correctamente', { exact: false })
    const put = apiMock.mock.calls.find(([, o]) => o?.method === 'PUT')!
    expect(JSON.parse(String(put[1]!.body))).not.toHaveProperty('referencias')
  })
})

describe('Mi perfil: mapa de la ubicación (UI#139, HU-N103)', () => {
  const UBICACION = { lat: 21.1236, lng: -101.6827 }
  const SUGERENCIA = 'Blvd. Adolfo López Mateos 1102, Jardines del Moral, León, Gto., México'
  const DETALLE = {
    calle: 'Blvd. Adolfo López Mateos',
    numeroExterior: '1102',
    colonia: 'Jardines del Moral',
    codigoPostal: '37160',
    municipio: 'León',
    estado: 'Guanajuato',
    ubicacion: UBICACION,
  }
  const TITULO_MAPA = 'Así te ve el cliente en el mapa'
  const ALT_MAPA = 'Mapa con la ubicación de tu negocio'

  // GET /negocios/mio con la dirección guardada y, si se pide, la ubicación.
  function responderMapa(ubicacion: unknown, detalle: unknown = DETALLE) {
    apiMock.mockImplementation(async (ruta: string, opciones?: RequestInit) => {
      if (ruta === '/categorias') return [{ id: 'cabello-barba', nombre: 'Cabello y barba' }]
      if (ruta.startsWith('/lugares/autocompletar')) return [{ texto: SUGERENCIA, lugarId: 'lugar-1' }]
      if (ruta.startsWith('/lugares/detalle')) return detalle
      if (ruta === '/negocios/mio' && opciones?.method === 'PUT') return { ...perfilBase, ...JSON.parse(String(opciones.body)), direccionTexto: '' }
      return { ...perfilBase, direccion: direccionGuardada, direccionTexto: '', ubicacion }
    })
  }

  async function guardarYLeerPut() {
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar cambios' }))
    await screen.findByText('Perfil actualizado correctamente', { exact: false })
    return JSON.parse(String(apiMock.mock.calls.find(([, o]) => o?.method === 'PUT')![1]!.body))
  }

  async function elegirSugerencia() {
    await escribir('Calle *', 'Blvd López')
    await screen.findByRole('option', { name: SUGERENCIA })
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await waitFor(() => expect(apiMock.mock.calls.some(([ruta]) => ruta.startsWith('/lugares/detalle'))).toBe(true))
    await act(async () => {})
  }

  beforeEach(() => {
    apiMock.mockReset()
    mapaMock.mockReset()
    mapaMock.mockResolvedValue('blob:mapa-1')
    window.scrollTo = vi.fn()
  })

  it('con ubicación guardada muestra el título y la imagen con su texto alternativo', async () => {
    responderMapa(UBICACION)
    await abrirPaso2()
    expect(await screen.findByRole('heading', { name: TITULO_MAPA })).toBeInTheDocument()
    expect(await screen.findByAltText(ALT_MAPA)).toHaveAttribute('src', 'blob:mapa-1')
    expect(mapaMock).toHaveBeenCalledTimes(1)
  })

  it('sin ubicación no pide ni muestra nada del mapa', async () => {
    responderMapa(null)
    await abrirPaso2()
    expect(screen.queryByRole('heading', { name: TITULO_MAPA })).not.toBeInTheDocument()
    expect(screen.queryByAltText(ALT_MAPA)).not.toBeInTheDocument()
    expect(mapaMock).not.toHaveBeenCalled()
  })

  it('con error de la API avisa «No se pudo cargar el mapa.» y el resto de la pantalla sigue', async () => {
    mapaMock.mockRejectedValue(new ErrorApi(503, 'No se pudo cargar el mapa.'))
    responderMapa(UBICACION)
    await abrirPaso2()
    expect(await screen.findByText('No se pudo cargar el mapa.')).toBeInTheDocument()
    expect(screen.queryByAltText(ALT_MAPA)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Calle *')).toHaveValue(direccionGuardada.calle)
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()
  })

  it('al salir de la pantalla libera la URL temporal de la imagen', async () => {
    const revocar = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    responderMapa(UBICACION)
    const { unmount } = render(<MemoryRouter><MiPerfil /></MemoryRouter>)
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar' }))
    await screen.findByAltText(ALT_MAPA)
    unmount()
    expect(revocar).toHaveBeenCalledWith('blob:mapa-1')
    revocar.mockRestore()
  })

  it('al elegir una sugerencia y guardar manda la ubicación y el mapa se vuelve a pedir', async () => {
    responderMapa(null)
    await abrirPaso2()
    await elegirSugerencia()
    expect(mapaMock).not.toHaveBeenCalled()
    const cuerpo = await guardarYLeerPut()
    expect(cuerpo.ubicacion).toEqual(UBICACION)
    expect(cuerpo.direccion).toMatchObject({ numeroExterior: '1102', colonia: 'Jardines del Moral' })
    await userEvent.click(await screen.findByRole('button', { name: 'Anterior' }))
    expect(await screen.findByAltText(ALT_MAPA)).toBeInTheDocument()
    expect(mapaMock).toHaveBeenCalledTimes(1)
  })

  it('si edita el domicilio a mano después de la sugerencia no manda la ubicación', async () => {
    responderMapa(null)
    await abrirPaso2()
    await elegirSugerencia()
    await escribir('Número exterior *', '2000')
    const cuerpo = await guardarYLeerPut()
    expect(cuerpo).not.toHaveProperty('ubicacion')
    expect(cuerpo.direccion.numeroExterior).toBe('2000')
  })

  it('si la dirección no cambió no manda la ubicación', async () => {
    responderMapa(UBICACION, { ...direccionGuardada, ubicacion: UBICACION })
    await abrirPaso2()
    await elegirSugerencia()
    const cuerpo = await guardarYLeerPut()
    expect(cuerpo).not.toHaveProperty('ubicacion')
  })

  it('al guardar un cambio a mano la API deja la ubicación en null y el mapa desaparece', async () => {
    responderMapa(UBICACION)
    await abrirPaso2()
    await screen.findByAltText(ALT_MAPA)
    await escribir('Número exterior *', '2000')
    const cuerpo = await guardarYLeerPut()
    expect(cuerpo).not.toHaveProperty('ubicacion')
    await userEvent.click(await screen.findByRole('button', { name: 'Anterior' }))
    await screen.findByLabelText('Calle *')
    expect(screen.queryByRole('heading', { name: TITULO_MAPA })).not.toBeInTheDocument()
  })
})
