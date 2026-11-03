import { useEffect, useId, useRef } from 'react';
import { Power, Trash2 } from 'lucide-react';

export function DialogoServicio({ texto, accion, ocupado, alConfirmar, alCancelar }: {
  texto: string; accion: string; ocupado: boolean; alConfirmar: () => void;
  alCancelar: () => void;
}) {
  const titulo = useId();
  const descripcion = useId();
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
      <div className={`panel-dialogo-icono ${accion === 'Eliminar' ? 'panel-dialogo-icono--peligro' : 'panel-dialogo-icono--aviso'}`} aria-hidden="true">
        {accion === 'Eliminar' ? <Trash2 aria-hidden="true" /> : <Power aria-hidden="true" />}
      </div>
      <h2 id={titulo} className="panel-dialogo-titulo">{accion} servicio</h2>
      <p id={descripcion} className="panel-dialogo-texto">{texto}</p>
      <div className="panel-dialogo-acciones">
        <button className={accion === 'Eliminar' ? 'btn-servia-danger' : 'btn-servia-primary'} ref={aceptar} type="button" disabled={ocupado} onClick={alConfirmar}>{accion}</button>
        <button className="btn-servia-secondary" type="button" disabled={ocupado} onClick={alCancelar}>Cancelar</button>
      </div>
    </div>
  </div>;
}
