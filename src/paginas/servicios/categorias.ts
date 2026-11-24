import { useCallback, useEffect, useState } from 'react';
import { api } from '../../servicios/api';

// Categorías por servicio (HU-N28, HU-N31 a HU-N34). El catálogo sale siempre de la API.
export const MAX_CATEGORIA_PERSONALIZADA = 40;
export const VALOR_OTRA = '__otra';

export interface CategoriaCatalogo {
  id: string;
  nombre: string;
  categoriaId: string;
  orden: number;
}

// Lo que la API devuelve en cada servicio; un servicio viejo trae null en ambos.
export interface CategoriaDeServicio {
  categoriaServicio?: { id: string; nombre: string } | null;
  categoriaPersonalizada?: string | null;
}

export type ModoCategoria = 'ninguna' | 'catalogo' | 'otra';
export interface CategoriaElegida {
  modo: ModoCategoria;
  id: string;
  texto: string;
}

export const SIN_CATEGORIA: CategoriaElegida = { modo: 'ninguna', id: '', texto: '' };

export function categoriaDelServicio(servicio: CategoriaDeServicio): CategoriaElegida {
  if (servicio.categoriaServicio) return { modo: 'catalogo', id: servicio.categoriaServicio.id, texto: '' };
  if (servicio.categoriaPersonalizada) return { modo: 'otra', id: '', texto: servicio.categoriaPersonalizada };
  return SIN_CATEGORIA;
}

// Nombre para mostrar en la lista, o null si el servicio no tiene categoría.
export function nombreDeCategoria(servicio: CategoriaDeServicio): string | null {
  return servicio.categoriaServicio?.nombre ?? servicio.categoriaPersonalizada ?? null;
}

function igual(a: CategoriaElegida, b: CategoriaElegida) {
  if (a.modo !== b.modo) return false;
  if (a.modo === 'catalogo') return a.id === b.id;
  if (a.modo === 'otra') return a.texto.trim() === b.texto.trim();
  return true;
}

// Campos de categoría para el cuerpo de POST/PUT. Al crear solo se manda lo elegido; al
// editar, nada si no cambió (campo ausente = no cambia) y, si cambió, el campo del otro modo
// va en null explícito porque la API no admite los dos a la vez.
export function camposDeCategoria(actual: CategoriaElegida, inicial: CategoriaElegida, esEdicion: boolean) {
  if (esEdicion && igual(actual, inicial)) return {};
  if (actual.modo === 'catalogo') {
    return esEdicion ? { categoriaServicioId: actual.id, categoriaPersonalizada: null } : { categoriaServicioId: actual.id };
  }
  if (actual.modo === 'otra') {
    const categoriaPersonalizada = actual.texto.trim();
    return esEdicion ? { categoriaPersonalizada, categoriaServicioId: null } : { categoriaPersonalizada };
  }
  return esEdicion ? { categoriaServicioId: null, categoriaPersonalizada: null } : {};
}

export function errorDeCategoria(actual: CategoriaElegida): string {
  if (actual.modo !== 'otra') return '';
  const texto = actual.texto.trim();
  if (!texto) return 'Escribe tu categoría o elige otra opción.';
  if (texto.length > MAX_CATEGORIA_PERSONALIZADA) return `La categoría puede tener hasta ${MAX_CATEGORIA_PERSONALIZADA} caracteres.`;
  return '';
}

export interface CatalogoCategorias {
  estado: 'cargando' | 'listo' | 'error';
  categorias: CategoriaCatalogo[];
  // El negocio aún no tiene categoría: no hay catálogo que pedir.
  sinCategoriaNegocio: boolean;
  reintentar: () => void;
}

// Carga las categorías de servicio de la categoría del negocio. Al crear, esa categoría ya
// vino en el perfil que consulta el formulario; al editar se consulta aquí el perfil.
export function useCatalogoCategorias(
  activo: boolean,
  categoriaNegocioId: string | null | undefined,
  consultarPerfil: boolean,
): CatalogoCategorias {
  const [resultado, setResultado] = useState<Omit<CatalogoCategorias, 'reintentar'>>(
    { estado: 'cargando', categorias: [], sinCategoriaNegocio: false });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!activo) return;
    let vigente = true;
    const cargar = async () => {
      try {
        let categoriaId = categoriaNegocioId;
        if (consultarPerfil) {
          categoriaId = (await api<{ categoriaId?: string | null }>('/negocios/mio')).categoriaId;
        }
        if (!categoriaId) {
          if (vigente) setResultado({ estado: 'listo', categorias: [], sinCategoriaNegocio: true });
          return;
        }
        const lista = await api<CategoriaCatalogo[]>(`/categorias-servicio?categoriaId=${encodeURIComponent(categoriaId)}`);
        if (!Array.isArray(lista)) throw new Error('Respuesta inesperada del catálogo.');
        if (vigente) setResultado({ estado: 'listo', categorias: lista, sinCategoriaNegocio: false });
      } catch {
        if (vigente) setResultado({ estado: 'error', categorias: [], sinCategoriaNegocio: false });
      }
    };
    void cargar();
    return () => { vigente = false; };
  }, [activo, categoriaNegocioId, consultarPerfil, intento]);

  const reintentar = useCallback(() => {
    setResultado({ estado: 'cargando', categorias: [], sinCategoriaNegocio: false });
    setIntento(n => n + 1);
  }, []);
  return { ...resultado, reintentar };
}
