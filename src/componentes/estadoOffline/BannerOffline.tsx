import { useEffect, useState } from 'react'
import { CircleAlert, RefreshCw, WifiOff, X } from 'lucide-react'
import {
  cantidadAccionesPendientes,
  EVENTO_AVISO_OFFLINE,
  EVENTO_COLA_OFFLINE,
} from '../../servicios/colaOffline'
import './BannerOffline.css'

// Aviso global: dice cuándo estamos viendo datos guardados y cuántas acciones
// siguen en cola. Se monta fuera del router para que aparezca en cualquier ruta.
export function BannerOffline() {
  const [enLinea, setEnLinea] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  const [pendientes, setPendientes] = useState(0)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    void cantidadAccionesPendientes().then(setPendientes)

    const alConectar = () => setEnLinea(true)
    const alDesconectar = () => setEnLinea(false)
    const alCambiarCola = (evento: Event) => {
      const detalle = (evento as CustomEvent<{ cantidad?: number }>).detail
      setPendientes(detalle?.cantidad ?? 0)
    }
    const alAviso = (evento: Event) => {
      setAviso((evento as CustomEvent<{ mensaje?: string }>).detail?.mensaje ?? '')
    }

    window.addEventListener('online', alConectar)
    window.addEventListener('offline', alDesconectar)
    window.addEventListener(EVENTO_COLA_OFFLINE, alCambiarCola)
    window.addEventListener(EVENTO_AVISO_OFFLINE, alAviso)
    return () => {
      window.removeEventListener('online', alConectar)
      window.removeEventListener('offline', alDesconectar)
      window.removeEventListener(EVENTO_COLA_OFFLINE, alCambiarCola)
      window.removeEventListener(EVENTO_AVISO_OFFLINE, alAviso)
    }
  }, [])

  useEffect(() => {
    if (!aviso) return
    const temporizador = window.setTimeout(() => setAviso(''), 8000)
    return () => window.clearTimeout(temporizador)
  }, [aviso])

  if (enLinea && pendientes === 0 && !aviso) return null

  return (
    <div className="banner-offline" role="status" aria-live="polite">
      {!enLinea && (
        <div className="banner-offline-fila banner-offline-fila--aviso">
          <WifiOff aria-hidden="true" />
          <span>
            <strong>Sin conexión.</strong> Puedes seguir consultando los datos guardados en este dispositivo.
          </span>
        </div>
      )}

      {pendientes > 0 && (
        <div className="banner-offline-fila">
          <RefreshCw aria-hidden="true" />
          <span>
            <strong>{pendientes} {pendientes === 1 ? 'cambio pendiente' : 'cambios pendientes'}.</strong>{' '}
            {enLinea
              ? 'Los estamos enviando…'
              : 'Se enviarán automáticamente cuando vuelva la conexión.'}
          </span>
        </div>
      )}

      {aviso && (
        <div className="banner-offline-fila banner-offline-fila--error">
          <CircleAlert aria-hidden="true" />
          <span>{aviso}</span>
          <button type="button" onClick={() => setAviso('')} aria-label="Cerrar aviso">
            <X aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
