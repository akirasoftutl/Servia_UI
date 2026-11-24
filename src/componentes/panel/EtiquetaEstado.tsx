import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type TonoEstado = 'exito' | 'aviso' | 'peligro' | 'info' | 'neutro';

interface Props {
  texto?: string;
  children?: ReactNode;
  tono?: TonoEstado;
  icono?: LucideIcon;
  className?: string;
}

/** Etiqueta corta de estado con color semántico, equivalente a EtiquetaEstado de la app móvil. */
export function EtiquetaEstado({
  texto,
  children,
  tono = 'neutro',
  icono: Icono,
  className = '',
}: Props) {
  const clases = ['panel-etiqueta', `panel-etiqueta--${tono}`, className].filter(Boolean).join(' ');
  return (
    <span className={clases}>
      {Icono && <Icono aria-hidden="true" />}
      {texto ?? children}
    </span>
  );
}
