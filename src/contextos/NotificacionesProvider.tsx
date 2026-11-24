import { Bell } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import {
  listarAvisos,
  marcarAvisoLeido,
  sincronizarTokenPushSiPermitido,
  suscribirMensajesPrimerPlano,
  type AvisoEnPantalla,
} from '../servicios/notificaciones'
import { useAuth } from './AuthContext'
import { NotificacionesContext, type AvisoSeleccionado } from './notificacionesContexto'
import { BotonPanel } from '../componentes/panel/BotonPanel'

export function NotificacionesProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const uid = usuario?.uid ?? null

  const [noLeidas, setNoLeidas] = useState(0)
  const [versionLista, setVersionLista] = useState(0)
  const [avisoEnPantalla, setAvisoEnPantalla] = useState<AvisoEnPantalla | null>(null)
  const notificacionesUrlProcesadas = useRef(new Set<string>())
  const uidActual = useRef(uid)

  useEffect(() => {
    uidActual.current = uid
  }, [uid])

  const actualizarNoLeidas = useCallback((valor: number) => {
    setNoLeidas(Math.max(0, valor))
  }, [])

  const decrementarNoLeidas = useCallback(() => {
    setNoLeidas((actual) => Math.max(0, actual - 1))
  }, [])

  const refrescarNoLeidas = useCallback(async () => {
    const uidInicial = uidActual.current
    if (!uidInicial) return
    try {
      const datos = await listarAvisos()
      if (uidActual.current === uidInicial && typeof datos?.noLeidas === 'number') {
        setNoLeidas(Math.max(0, datos.noLeidas))
      }
    } catch {
      // Si falla la actualización del contador, conservamos el último valor conocido.
    }
  }, [])

  const abrirAviso = useCallback(
    async (aviso: AvisoSeleccionado) => {
      if (aviso.id && !aviso.leida) {
        try {
          await marcarAvisoLeido(aviso.id)
          decrementarNoLeidas()
          setVersionLista((v) => v + 1)
        } catch {
          // Navegamos igual al detalle aunque falle marcar como leída.
        }
      }
      if (aviso.reservaId) {
        navigate(`/reservas/${encodeURIComponent(aviso.reservaId)}`)
      } else {
        navigate('/avisos')
      }
    },
    [decrementarNoLeidas, navigate],
  )

  useEffect(() => {
    if (!uid) return
    let vigente = true
    let desuscribir: (() => void) | undefined

    void listarAvisos()
      .then((datos) => {
        if (vigente && typeof datos?.noLeidas === 'number') {
          setNoLeidas(Math.max(0, datos.noLeidas))
        }
      })
      .catch(() => {})

    void sincronizarTokenPushSiPermitido()

    void suscribirMensajesPrimerPlano((aviso) => {
      if (!vigente) return
      setAvisoEnPantalla(aviso)
      setNoLeidas((actual) => actual + 1)
      setVersionLista((v) => v + 1)
      void refrescarNoLeidas()
    })
      .then((cancelar) => {
        if (vigente) {
          desuscribir = cancelar
        } else {
          cancelar()
        }
      })
      .catch(() => {})

    return () => {
      vigente = false
      desuscribir?.()
    }
  }, [uid, refrescarNoLeidas])

  // Cuando el service worker abre una ruta con ?notificacion=<id>, marcamos el aviso como leído.
  useEffect(() => {
    if (!uid || !location.search) return
    const parametros = new URLSearchParams(location.search)
    const notificacionId = parametros.get('notificacion')
    if (!notificacionId || notificacionesUrlProcesadas.current.has(notificacionId)) return
    notificacionesUrlProcesadas.current.add(notificacionId)

    let vigente = true
    void marcarAvisoLeido(notificacionId)
      .then(() => {
        if (!vigente) return
        setVersionLista((v) => v + 1)
        void refrescarNoLeidas()
      })
      .catch(() => {})

    parametros.delete('notificacion')
    const siguienteBusqueda = parametros.toString()
    navigate(`${location.pathname}${siguienteBusqueda ? `?${siguienteBusqueda}` : ''}`, { replace: true })

    return () => {
      vigente = false
    }
  }, [uid, location.pathname, location.search, navigate, refrescarNoLeidas])

  // Si el service worker envía postMessage a una pestaña ya abierta, abrimos el aviso.
  useEffect(() => {
    if (!uid || typeof navigator === 'undefined' || !navigator.serviceWorker?.addEventListener) return
    const alRecibirMensajeSw = (evento: MessageEvent) => {
      const datos = evento.data as {
        tipo?: string
        reservaId?: string | null
        notificacionId?: string | null
      } | null
      if (datos?.tipo !== 'SERVIA_ABRIR_AVISO') return
      void abrirAviso({
        id: datos.notificacionId ?? null,
        reservaId: datos.reservaId ?? null,
        leida: false,
      })
    }
    navigator.serviceWorker.addEventListener('message', alRecibirMensajeSw)
    return () => navigator.serviceWorker.removeEventListener('message', alRecibirMensajeSw)
  }, [uid, abrirAviso])

  const valor = useMemo(
    () => ({
      noLeidas,
      versionLista,
      actualizarNoLeidas,
      decrementarNoLeidas,
      refrescarNoLeidas,
      abrirAviso,
    }),
    [noLeidas, versionLista, actualizarNoLeidas, decrementarNoLeidas, refrescarNoLeidas, abrirAviso],
  )

  return (
    <NotificacionesContext.Provider value={valor}>
      {avisoEnPantalla && (
        <div className="panel-aviso-flotante" role="status" aria-live="polite">
          <div className="panel-alerta panel-alerta--info panel-aviso-flotante-tarjeta">
            <span className="panel-alerta-icono" aria-hidden="true">
              <Bell aria-hidden="true" />
            </span>
            <div className="panel-alerta-contenido">
              <strong>{avisoEnPantalla.titulo}</strong>
              {avisoEnPantalla.cuerpo && <p>{avisoEnPantalla.cuerpo}</p>}
            </div>
            <div className="panel-aviso-acciones panel-alerta-accion">
              <BotonPanel
                variante="primario"
                tamano="sm"
                onClick={() => {
                  const actual = avisoEnPantalla
                  setAvisoEnPantalla(null)
                  void abrirAviso({
                    id: actual.notificacionId,
                    reservaId: actual.reservaId,
                    leida: false,
                  })
                }}
              >
                Ver
              </BotonPanel>
              <BotonPanel
                variante="secundario"
                tamano="sm"
                aria-label="Cerrar aviso"
                onClick={() => setAvisoEnPantalla(null)}
              >
                Cerrar
              </BotonPanel>
            </div>
          </div>
        </div>
      )}
      {children}
    </NotificacionesContext.Provider>
  )
}
