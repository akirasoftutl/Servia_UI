import type { LucideIcon } from 'lucide-react';

/** Grupos de la cabecera: los mismos del menú propuesto (T16) y Configuración. */
const GRUPOS_EYEBROW = {
  operacion: 'Operación diaria',
  negocio: 'Mi negocio',
  configuracion: 'Configuración',
} as const;

type GrupoEyebrow = keyof typeof GRUPOS_EYEBROW;

interface Props {
  grupo: GrupoEyebrow;
  icono: LucideIcon;
}

/** Rótulo de la cabecera de cada pantalla: ícono + nombre del grupo, siempre con el mismo patrón. */
export function EyebrowPanel({ grupo, icono: Icono }: Props) {
  return (
    <span className="panel-eyebrow">
      <Icono aria-hidden="true" />
      {GRUPOS_EYEBROW[grupo]}
    </span>
  );
}
