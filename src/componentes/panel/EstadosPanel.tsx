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
