import { Bell } from 'lucide-react';
import { EncabezadoPanel } from '../../componentes/panel/EncabezadoPanel';
import { PreferenciasNotificaciones } from '../../componentes/panel/PreferenciasNotificaciones';
import '../../estilos/panel.css';

export function Preferencias() {
  return (
    <div className="panel-pagina">
      <div className="panel-contenedor">
        <EncabezadoPanel
          grupo="configuracion"
          icono={Bell}
          titulo="Preferencias de notificaciones"
          subtitulo="Elige qué avisos quieres recibir como notificación push."
        />
        <PreferenciasNotificaciones />
      </div>
    </div>
  );
}
