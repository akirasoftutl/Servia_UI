import type { FotoNegocio, FotosNegocio } from '../../servicios/api';

export const MAX_FOTOS_GALERIA = 5;
export const MAX_FOTO_MB = 5;
export const MAX_FOTO_BYTES = MAX_FOTO_MB * 1024 * 1024;
export const TIPOS_FOTO_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ACCEPT_FOTOS = TIPOS_FOTO_PERMITIDOS.join(',');

export const MENSAJE_TIPO_INVALIDO = 'Solo se permiten imágenes JPEG, PNG o WebP.';
export const MENSAJE_TAMANO_EXCEDIDO = `La foto supera el tamaño máximo de ${MAX_FOTO_MB} MB.`;
export const MENSAJE_ARCHIVO_VACIO = 'El archivo está vacío. Elige una imagen JPEG, PNG o WebP.';

export const FOTOS_VACIAS: FotosNegocio = { portada: null, galeria: [] };

export function validarArchivoFoto(archivo: File): string | null {
  const tipo = archivo.type.toLowerCase();
  if (!TIPOS_FOTO_PERMITIDOS.includes(tipo as (typeof TIPOS_FOTO_PERMITIDOS)[number])) {
    return MENSAJE_TIPO_INVALIDO;
  }
  if (archivo.size <= 0) {
    return MENSAJE_ARCHIVO_VACIO;
  }
  if (archivo.size > MAX_FOTO_BYTES) {
    return MENSAJE_TAMANO_EXCEDIDO;
  }
  return null;
}

function esFotoValida(valor: unknown): valor is FotoNegocio {
  if (!valor || typeof valor !== 'object') return false;
  const { id, url } = valor as { id?: unknown; url?: unknown };
  return typeof id === 'string' && id.trim().length > 0 && typeof url === 'string' && url.trim().length > 0;
}

export function normalizarFotosNegocio(valor?: Partial<FotosNegocio> | null): FotosNegocio {
  if (!valor || typeof valor !== 'object') {
    return { portada: null, galeria: [] };
  }
  return {
    portada: esFotoValida(valor.portada) ? { id: valor.portada.id, url: valor.portada.url } : null,
    galeria: Array.isArray(valor.galeria)
      ? valor.galeria.filter(esFotoValida).map((foto) => ({ id: foto.id, url: foto.url }))
      : [],
  };
}

export function formatearTamanoArchivo(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
