// Dirección del negocio por campos. Mismo contrato y mismas reglas que la API
// (Servia_BE#65, DireccionDto). Ajusta la decisión D8.

// Ubicación del negocio que entrega Google al elegir una sugerencia (Servia_BE#109).
export interface Ubicacion {
  lat: number;
  lng: number;
}

export const ESTADOS_MEXICO = [
  'Aguascalientes',
  'Baja California',
  'Baja California Sur',
  'Campeche',
  'Chiapas',
  'Chihuahua',
  'Ciudad de México',
  'Coahuila',
  'Colima',
  'Durango',
  'Estado de México',
  'Guanajuato',
  'Guerrero',
  'Hidalgo',
  'Jalisco',
  'Michoacán',
  'Morelos',
  'Nayarit',
  'Nuevo León',
  'Oaxaca',
  'Puebla',
  'Querétaro',
  'Quintana Roo',
  'San Luis Potosí',
  'Sinaloa',
  'Sonora',
  'Tabasco',
  'Tamaulipas',
  'Tlaxcala',
  'Veracruz',
  'Yucatán',
  'Zacatecas',
] as const;

export interface Direccion {
  calle: string;
  numeroExterior: string;
  numeroInterior?: string;
  colonia: string;
  codigoPostal: string;
  municipio: string;
  estado: string;
}

export type DireccionForm = Required<Direccion>;

export const DIRECCION_VACIA: DireccionForm = {
  calle: '',
  numeroExterior: '',
  numeroInterior: '',
  colonia: '',
  codigoPostal: '',
  municipio: '',
  estado: '',
};

export function direccionAForm(direccion: Direccion): DireccionForm {
  return { ...DIRECCION_VACIA, ...direccion, numeroInterior: direccion.numeroInterior ?? '' };
}

// Valida con las mismas reglas que la API; devuelve un error por campo.
export function validarDireccion(d: DireccionForm): Record<string, string> {
  const e: Record<string, string> = {};
  const calle = d.calle.trim();
  const exterior = d.numeroExterior.trim();
  const colonia = d.colonia.trim();
  const municipio = d.municipio.trim();

  if (calle.length < 2 || calle.length > 100) e.calle = 'La calle debe tener entre 2 y 100 caracteres';
  if (exterior.length < 1 || exterior.length > 10) e.numeroExterior = 'El número exterior debe tener entre 1 y 10 caracteres';
  if (d.numeroInterior.trim().length > 10) e.numeroInterior = 'El número interior no puede exceder 10 caracteres';
  if (colonia.length < 2 || colonia.length > 80) e.colonia = 'La colonia debe tener entre 2 y 80 caracteres';
  if (!/^\d{5}$/.test(d.codigoPostal.trim())) e.codigoPostal = 'El código postal debe contener exactamente 5 dígitos';
  if (municipio.length < 2 || municipio.length > 80) e.municipio = 'El municipio debe tener entre 2 y 80 caracteres';
  if (!(ESTADOS_MEXICO as readonly string[]).includes(d.estado)) e.estado = 'Selecciona un estado de la lista';
  return e;
}

// Objeto que se manda en `PUT /negocios/mio`; el interior vacío se omite.
export function direccionParaApi(d: DireccionForm): Direccion {
  const interior = d.numeroInterior.trim();
  return {
    calle: d.calle.trim(),
    numeroExterior: d.numeroExterior.trim(),
    ...(interior ? { numeroInterior: interior } : {}),
    colonia: d.colonia.trim(),
    codigoPostal: d.codigoPostal.trim(),
    municipio: d.municipio.trim(),
    estado: d.estado,
  };
}

// Detalle de un lugar (`GET /lugares/detalle`, Servia_BE#96): cadena vacía si
// Google no trae el dato.
export interface DetalleLugar {
  calle: string;
  numeroExterior: string;
  colonia: string;
  codigoPostal: string;
  municipio: string;
  estado: string;
  ubicacion?: Ubicacion | null;
}

const CAMPOS_DETALLE = ['calle', 'numeroExterior', 'colonia', 'codigoPostal', 'municipio', 'estado'] as const;

function tieneDato(detalle: DetalleLugar, campo: (typeof CAMPOS_DETALLE)[number]): boolean {
  const valor = detalle[campo].trim();
  if (valor === '') return false;
  // El estado es un selector: uno fuera de la lista no sirve.
  return campo !== 'estado' || (ESTADOS_MEXICO as readonly string[]).includes(valor);
}

// Campos del detalle que no se pueden aplicar (vacíos o, en el estado, fuera de la lista).
export function camposSinDato(detalle: DetalleLugar): string[] {
  return CAMPOS_DETALLE.filter((campo) => !tieneDato(detalle, campo));
}

// Sobrescribe cada campo con el dato del detalle si trae valor; lo que no trae
// conserva el valor actual. El número interior nunca se toca.
export function aplicarDetalleADireccion(actual: DireccionForm, detalle: DetalleLugar): DireccionForm {
  const siguiente = { ...actual };
  for (const campo of CAMPOS_DETALLE) {
    if (tieneDato(detalle, campo)) siguiente[campo] = detalle[campo].trim();
  }
  return siguiente;
}
