import {
  DIRECCION_VACIA,
  ESTADOS_MEXICO,
  direccionParaApi,
  validarDireccion,
  type DireccionForm,
} from './direccion'

const valida: DireccionForm = {
  calle: 'Blvd. Adolfo López Mateos',
  numeroExterior: '123',
  numeroInterior: '',
  colonia: 'Centro',
  codigoPostal: '37000',
  municipio: 'León',
  estado: 'Guanajuato',
}

describe('validarDireccion (mismas reglas que la API)', () => {
  it('acepta una dirección completa', () => {
    expect(validarDireccion(valida)).toEqual({})
  })

  it('pide los campos obligatorios vacíos, cada uno con su error', () => {
    expect(Object.keys(validarDireccion(DIRECCION_VACIA)).sort()).toEqual(
      ['calle', 'codigoPostal', 'colonia', 'estado', 'municipio', 'numeroExterior'],
    )
  })

  it.each([
    ['calle', '1', 'calle'],
    ['calle', 'a'.repeat(101), 'calle'],
    ['numeroExterior', 'a'.repeat(11), 'numeroExterior'],
    ['numeroInterior', 'a'.repeat(11), 'numeroInterior'],
    ['colonia', 'a', 'colonia'],
    ['colonia', 'a'.repeat(81), 'colonia'],
    ['codigoPostal', '123', 'codigoPostal'],
    ['codigoPostal', '1234a', 'codigoPostal'],
    ['codigoPostal', '123456', 'codigoPostal'],
    ['municipio', 'a', 'municipio'],
    ['municipio', 'a'.repeat(81), 'municipio'],
    ['estado', 'Texas', 'estado'],
    ['estado', 'Coahuila de Zaragoza', 'estado'],
  ])('rechaza %s = %j', (campo, valor, esperado) => {
    const errores = validarDireccion({ ...valida, [campo]: valor })
    expect(Object.keys(errores)).toEqual([esperado])
  })

  it('acepta los límites exactos', () => {
    expect(
      validarDireccion({
        ...valida,
        calle: 'ab',
        numeroExterior: 'a',
        numeroInterior: 'a'.repeat(10),
        colonia: 'a'.repeat(80),
        municipio: 'a'.repeat(80),
      }),
    ).toEqual({})
  })

  it('recorta espacios como la API', () => {
    expect(validarDireccion({ ...valida, calle: '  a ' })).toHaveProperty('calle')
  })
})

describe('lista de estados', () => {
  it('tiene las 32 entidades con los nombres cortos de la API', () => {
    expect(ESTADOS_MEXICO).toHaveLength(32)
    expect(ESTADOS_MEXICO).toEqual(expect.arrayContaining(['Coahuila', 'Michoacán', 'Veracruz']))
  })
})

describe('direccionParaApi', () => {
  it('omite el interior vacío y recorta', () => {
    expect(direccionParaApi({ ...valida, calle: ' Juárez ' })).toEqual({
      calle: 'Juárez',
      numeroExterior: '123',
      colonia: 'Centro',
      codigoPostal: '37000',
      municipio: 'León',
      estado: 'Guanajuato',
    })
  })

  it('incluye el interior cuando existe', () => {
    expect(direccionParaApi({ ...valida, numeroInterior: '4' }).numeroInterior).toBe('4')
  })
})
