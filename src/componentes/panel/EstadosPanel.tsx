import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

// Piezas visuales compartidas por los estados de los módulos del panel.
// Son decorativas: no tienen texto ni roles, así que quedan ocultas para
// lectores de pantalla; el mensaje accesible lo pone cada pantalla.

export function IlustracionEstado({ icono: Icono, error = false }: { icono: LucideIcon; error?: boolean }) {
  return (
    <div className={`panel-ilustracion ${error ? 'panel-ilustracion--error' : ''}`} aria-hidden="true">
      <span className="panel-ilustracion-fondo" />
      <span className="panel-ilustracion-frente"><Icono aria-hidden="true" /></span>
    </div>
  );
}

// Estado vacío único del panel: ilustración, título, texto y, si hay un siguiente
// paso útil, un botón de acción (el que llama pasa un <Link> o <button> ya con su clase).
export function EstadoVacio({ icono, titulo, texto, accion, encabezado = 'h3' }: {
  icono: LucideIcon; titulo: string; texto: string; accion?: ReactNode; encabezado?: 'h1' | 'h2' | 'h3';
}) {
  const Encabezado = encabezado;
  return (
    <div className="panel-estado">
      <IlustracionEstado icono={icono} />
      <div className="panel-estado-cuerpo">
        <Encabezado className="panel-estado-titulo">{titulo}</Encabezado>
        <p className="panel-estado-texto">{texto}</p>
        {accion && <div className="panel-estado-acciones">{accion}</div>}
      </div>
    </div>
  );
}

export function EsqueletoLista({ filas = 3 }: { filas?: number }) {
  return (
    <>
      {Array.from({ length: filas }, (_, indice) => (
        <div className="panel-esqueleto-fila" aria-hidden="true" key={indice}>
          <span className="panel-esqueleto-bloque" />
          <span className="panel-esqueleto-lineas">
            <span className="panel-esqueleto-linea panel-esqueleto-linea--titulo" />
            <span className="panel-esqueleto-linea panel-esqueleto-linea--media" />
          </span>
          <span className="panel-esqueleto-linea panel-esqueleto-linea--corta" />
        </div>
      ))}
    </>
  );
}

export function EsqueletoEncabezado() {
  return <div className="panel-esqueleto-encabezado" aria-hidden="true" />;
}
