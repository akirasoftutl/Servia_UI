import type { ReactNode } from 'react';

interface Props {
  id?: string;
  titulo?: string;
  tituloId?: string;
  subtitulo?: string;
  derecha?: ReactNode;
  ariaLabel?: string;
  ariaBusy?: boolean;
  className?: string;
  children: ReactNode;
}

/** Tarjeta compartida del panel, con cabecera opcional y superficie cálida de la app móvil. */
export function TarjetaPanel({
  id,
  titulo,
  tituloId,
  subtitulo,
  derecha,
  ariaLabel,
  ariaBusy,
  className = '',
  children,
}: Props) {
  return (
    <section
      id={id}
      className={className ? `panel-tarjeta ${className}` : 'panel-tarjeta'}
      aria-label={!tituloId ? ariaLabel : undefined}
      aria-labelledby={tituloId}
      aria-busy={ariaBusy}
    >
      {(titulo || subtitulo || derecha) && (
        <div className="panel-tarjeta-encabezado">
          <div>
            {titulo && (
              <h2 id={tituloId} className="panel-tarjeta-titulo">
                {titulo}
              </h2>
            )}
            {subtitulo && <p className="panel-tarjeta-subtitulo">{subtitulo}</p>}
          </div>
          {derecha}
        </div>
      )}
      {children}
    </section>
  );
}
