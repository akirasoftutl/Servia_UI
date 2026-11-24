import { useEffect, useState } from 'react'
import { descargarMapaNegocio } from '../../servicios/api'
import type { Ubicacion } from './direccion'

interface MapaNegocioProps {
  // Ubicación guardada del negocio (`GET /negocios/mio`). Cada objeto nuevo
  // vuelve a pedir el mapa, por ejemplo tras guardar el perfil.
  ubicacion: Ubicacion | null
}

// `para` es la ubicación a la que pertenece el resultado: si ya no es la actual, se está pidiendo otro mapa.
type Resultado = { para: Ubicacion; error: true } | { para: Ubicacion; error: false; url: string }

// Mapa estático del negocio (HU-N103). La imagen la genera la API
// (`GET /negocios/mio/mapa`, Servia_BE#119): el panel no lleva SDK ni llave de
// mapas. Sin ubicación no se muestra nada.
export function MapaNegocio({ ubicacion }: MapaNegocioProps) {
  const [resultado, setResultado] = useState<Resultado | null>(null)

  useEffect(() => {
    if (!ubicacion) return
    let vigente = true
    let urlTemporal: string | null = null
    descargarMapaNegocio()
      .then((url) => {
        if (!vigente) {
          URL.revokeObjectURL(url)
          return
        }
        urlTemporal = url
        setResultado({ para: ubicacion, error: false, url })
      })
      .catch(() => {
        if (vigente) setResultado({ para: ubicacion, error: true })
      })
    // Al salir de la pantalla o cambiar el mapa se libera la URL temporal.
    return () => {
      vigente = false
      if (urlTemporal) URL.revokeObjectURL(urlTemporal)
    }
  }, [ubicacion])

  if (!ubicacion) return null
  const actual = resultado?.para === ubicacion ? resultado : null

  return (
    <section className="perfil-mapa" aria-labelledby="titulo-mapa">
      <h3 id="titulo-mapa" className="perfil-mapa-titulo">
        Así te ve el cliente en el mapa
      </h3>
      <div className="perfil-mapa-marco">
        {actual === null && (
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Cargando el mapa...</span>
          </div>
        )}
        {actual?.error === true && <p className="panel-ayuda mb-0" role="status">No se pudo cargar el mapa.</p>}
        {actual?.error === false && (
          <img className="perfil-mapa-imagen" src={actual.url} alt="Mapa con la ubicación de tu negocio" />
        )}
      </div>
    </section>
  )
}
