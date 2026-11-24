import type { ReactNode } from 'react';
import { CircleAlert, type LucideIcon } from 'lucide-react';
import { BotonPanel } from './BotonPanel';

// Piezas visuales compartidas por los estados de los módulos del panel,
// alineadas con lib/core/widgets/estados.dart de la app móvil.

export function IlustracionEstado({ icono: Icono, error = false }: { icono: LucideIcon; error?: boolean }) {
  return (
    <div className={`panel-ilustracion ${error ? 'panel-ilustracion--error' : ''}`} aria-hidden="true">
      <span className="panel-ilustracion-fondo" />
      <span className="panel-ilustracion-frente"><Icono aria-hidden="true" /></span>
    </div>
  );
}

// Estado vacío único del panel: ícono, título, texto y acción opcional.
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

// Estado de carga estándar con indicador circular y texto accesible.
export function EstadoCargando({ mensaje = 'Cargando...' }: { mensaje?: string }) {
  return (
    <div className="panel-estado">
      <div className="spinner-border" aria-hidden="true" />
      <p className="panel-estado-texto" role="status">{mensaje}</p>
    </div>
  );
}

// Estado de error estándar con ícono semántico, mensaje en role="alert" y botón Reintentar opcional.
export function EstadoError({
  titulo,
  mensaje,
  onReintentar,
  textoReintentar = 'Reintentar',
  accionSecundaria,
  icono = CircleAlert,
  encabezado = 'h3',
}: {
  titulo?: string;
  mensaje: string;
  onReintentar?: () => void;
  textoReintentar?: string;
  accionSecundaria?: ReactNode;
  icono?: LucideIcon;
  encabezado?: 'h1' | 'h2' | 'h3';
}) {
  const Encabezado = encabezado;
  return (
    <div className="panel-estado panel-estado--error">
      <IlustracionEstado icono={icono} error />
      <div className="panel-estado-cuerpo">
        {titulo && <Encabezado className="panel-estado-titulo">{titulo}</Encabezado>}
        <p className="panel-estado-texto" role="alert">{mensaje}</p>
        {(onReintentar || accionSecundaria) && (
          <div className="panel-estado-acciones">
            {onReintentar && (
              <BotonPanel variante="primario" onClick={onReintentar}>
                {textoReintentar}
              </BotonPanel>
            )}
            {accionSecundaria}
          </div>
        )}
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
