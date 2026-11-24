import { useEffect, useId, useRef } from 'react';
import { Power, Trash2 } from 'lucide-react';
import { BotonPanel } from '../../componentes/panel/BotonPanel';

export function DialogoServicio({ texto, accion, titulo: tituloVisible, ocupado, alConfirmar, alCancelar }: {
  texto: string; accion: string; titulo?: string; ocupado: boolean; alConfirmar: () => void;
  alCancelar: () => void;
}) {
  const titulo = useId();
  const descripcion = useId();
  const peligro = accion === 'Eliminar' || accion === 'Quitar';
  const aceptar = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    aceptar.current?.focus();
    return () => anterior?.focus();
  }, []);
  return <div className="panel-dialogo-fondo" role="alertdialog" aria-modal="true"
    aria-labelledby={titulo} aria-describedby={descripcion} onKeyDown={event => {
      if (event.key === 'Escape' && !ocupado) alCancelar();
      if (event.key === 'Tab') {
        const botones = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const indice = botones.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault();
        botones[(indice + (event.shiftKey ? botones.length - 1 : 1)) % botones.length]?.focus();
      }
    }}>
    <div className="panel-dialogo">
      <div className={`panel-dialogo-icono ${peligro ? 'panel-dialogo-icono--peligro' : 'panel-dialogo-icono--aviso'}`} aria-hidden="true">
        {peligro ? <Trash2 aria-hidden="true" /> : <Power aria-hidden="true" />}
      </div>
      <h2 id={titulo} className="panel-dialogo-titulo">{tituloVisible ?? `${accion} servicio`}</h2>
      <p id={descripcion} className="panel-dialogo-texto">{texto}</p>
      <div className="panel-dialogo-acciones">
        <BotonPanel variante={peligro ? 'peligro' : 'primario'} ref={aceptar} disabled={ocupado} onClick={alConfirmar}>{accion}</BotonPanel>
        <BotonPanel variante="secundario" disabled={ocupado} onClick={alCancelar}>Cancelar</BotonPanel>
      </div>
    </div>
  </div>;
}
