import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { EyebrowPanel } from './EyebrowPanel';

type GrupoEncabezado = 'operacion' | 'negocio' | 'configuracion';

interface Props {
  grupo: GrupoEncabezado;
  icono: LucideIcon;
  titulo: string;
  subtitulo?: string;
  acciones?: ReactNode;
  children?: ReactNode;
}

/** Encabezado estándar de cualquier pantalla del panel: miga, título, subtítulo, extras y acciones. */
export function EncabezadoPanel({ grupo, icono, titulo, subtitulo, acciones, children }: Props) {
  return (
    <header className="panel-encabezado">
      <div className="panel-encabezado-textos">
        <EyebrowPanel grupo={grupo} icono={icono} />
        <h1 className="panel-titulo">{titulo}</h1>
        {subtitulo && <p className="panel-subtitulo">{subtitulo}</p>}
        {children}
      </div>
      {acciones && <div className="panel-encabezado-acciones">{acciones}</div>}
    </header>
  );
}
