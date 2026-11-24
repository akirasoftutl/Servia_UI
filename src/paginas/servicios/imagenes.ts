import { ErrorApi } from '../../servicios/api';
import { mensajeDeError } from '../../servicios/mensajeDeError';

// Tope de imágenes por servicio (HU-N27, RN-15; propuesta confirmada por el PO). Vive aquí, en un solo
// lugar: la API es la autoridad y la pantalla solo adelanta el mensaje. El formato y el tamaño
// (JPEG, PNG o WebP, hasta 5 MB) se reutilizan de `mi_perfil/fotos.ts`.
export const MAX_IMAGENES_SERVICIO = 3;

export const MENSAJE_TOPE_IMAGENES =
  `Ya tienes ${MAX_IMAGENES_SERVICIO} imágenes, el máximo por servicio. Quita una para agregar otra.`;
export const MENSAJE_FALLO_SUBIDA = 'No pudimos subir la imagen. Revisa tu conexión e intenta de nuevo.';
export const MENSAJE_FALLO_QUITAR = 'No pudimos quitar la imagen. Revisa tu conexión e intenta de nuevo.';
export const AVISO_IMAGENES_FALLIDAS =
  'El servicio se creó, pero no se pudieron subir algunas imágenes. Agrégalas aquí.';

// Archivo elegido que todavía no está en la API: se ve como vista previa local.
export interface ArchivoPendiente {
  clave: string;
  archivo: File;
  url: string;
}

let secuencia = 0;

export function crearPendiente(archivo: File): ArchivoPendiente {
  secuencia += 1;
  const url = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(archivo) : '';
  return { clave: `${archivo.name}-${secuencia}`, archivo, url };
}

export function liberarPendiente(pendiente: ArchivoPendiente) {
  if (pendiente.url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(pendiente.url);
}

export function mensajeCupo(libres: number): string {
  return `Solo caben ${libres} ${libres === 1 ? 'imagen más' : 'imágenes más'}: el máximo es ${MAX_IMAGENES_SERVICIO} por servicio.`;
}

// La API responde 401/403 con el texto en inglés de Nest: aquí se dicen en español.
export function mensajeErrorImagen(error: unknown, respaldoRed: string): string {
  if (error instanceof ErrorApi) {
    if (error.estado === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión para continuar.';
    if (error.estado === 403) return 'Tu cuenta no tiene permiso para cambiar las imágenes de este servicio.';
  }
  return mensajeDeError(error, respaldoRed);
}
