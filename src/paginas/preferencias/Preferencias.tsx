import { Bell } from 'lucide-react';
import { PreferenciasNotificaciones } from '../../componentes/panel/PreferenciasNotificaciones';
import '../../estilos/panel.css';
import { EyebrowPanel } from '../../componentes/panel/EyebrowPanel';

export function Preferencias() {
  return <div className="panel-pagina"><div className="panel-contenedor">
    <header className="panel-encabezado"><div>
      <EyebrowPanel grupo="configuracion" icono={Bell} />
      <h1 className="panel-titulo">Preferencias de notificaciones</h1>
      <p className="panel-subtitulo">Elige qué avisos quieres recibir como notificación push.</p>
    </div></header>
    <PreferenciasNotificaciones />
  </div></div>;
}
