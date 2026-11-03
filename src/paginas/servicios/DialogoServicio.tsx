import { useEffect, useId, useRef } from 'react';

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
  return <div className="servicio-alerta-overlay" role="alertdialog" aria-modal="true"
    aria-labelledby={titulo} aria-describedby={descripcion} onKeyDown={event => {
      if (event.key === 'Escape' && !ocupado) alCancelar();
      if (event.key === 'Tab') {
        const botones = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const indice = botones.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault();
        botones[(indice + (event.shiftKey ? botones.length - 1 : 1)) % botones.length]?.focus();
      }
    }}>
    <div className="servicio-alerta-card">
      <h2 id={titulo}>{accion} servicio</h2>
      <p id={descripcion}>{texto}</p>
      <button className="btn-servia-primary" ref={aceptar} type="button" disabled={ocupado} onClick={alConfirmar}>{accion}</button>
      <button className="btn-servia-secondary" type="button" disabled={ocupado} onClick={alCancelar}>Cancelar</button>
    </div>
  </div>;
}
