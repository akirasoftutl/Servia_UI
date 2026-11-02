import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { api, ErrorApi } from '../../servicios/api'
import { MiPerfil } from './MiPerfil'

vi.mock('../../servicios/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../servicios/api')>()
  return { ...actual, api: vi.fn() }
})

const apiMock = vi.mocked(api)

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
  await userEvent.type(await screen.findByLabelText(/Correo/i, { selector: 'input[name="email"]' }), 'norte@correo.com')
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
