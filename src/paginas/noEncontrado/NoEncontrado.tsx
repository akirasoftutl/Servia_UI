import { Link } from 'react-router'
import { Compass } from 'lucide-react'
import { EstadoVacio } from '../../componentes/panel/EstadosPanel'

export function NoEncontrado() {
  return (
    <div className="panel-pagina panel-pagina--centrada">
      <div className="panel-contenedor">
        <EstadoVacio
          icono={Compass}
          titulo="No encontramos esta página"
          texto="Puede que el enlace esté mal escrito o que la página ya no exista."
          encabezado="h1"
          accion={<Link to="/" className="btn-servia-primary">Volver al inicio</Link>}
        />
      </div>
    </div>
  )
}
