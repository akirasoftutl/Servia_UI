import { useEffect, useRef, useState } from 'react'
import { Bell, BellOff, CircleAlert, Inbox } from 'lucide-react'
import { EyebrowPanel } from '../../componentes/panel/EyebrowPanel'
import { EsqueletoLista, IlustracionEstado } from '../../componentes/panel/EstadosPanel'
import { useNotificaciones } from '../../contextos/notificacionesContexto'
import {
  activarNotificacionesPush,
  consultarEstadoPermisoPush,
  listarAvisos,
  type Aviso,
  type EstadoPermisoPush,
} from '../../servicios/notificaciones'
import '../../estilos/panel.css'

const formatoFecha = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City',
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatearFecha(iso: string): string {
  const instante = Date.parse(iso)
  if (!Number.isFinite(instante)) return ''
  return formatoFecha.format(new Date(instante))
}

export function Avisos() {
  const { noLeidas, versionLista, actualizarNoLeidas, abrirAviso } = useNotificaciones()
  const [items, setItems] = useState<Aviso[]>([])
  const [siguiente, setSiguiente] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [error, setError] = useState('')
  const [errorMas, setErrorMas] = useState('')
  const [revision, setRevision] = useState(0)
  const [estadoPermiso, setEstadoPermiso] = useState<EstadoPermisoPush>('cargando')
  const [activandoPush, setActivandoPush] = useState(false)
  const [pushActivadoAhora, setPushActivadoAhora] = useState(false)
  const [errorPush, setErrorPush] = useState('')
  const abriendoRef = useRef<string | null>(null)
  const cargaInicialCompleta = useRef(false)

  useEffect(() => {
    let vigente = true
    void consultarEstadoPermisoPush().then((estado) => {
      if (vigente) setEstadoPermiso(estado)
    })
    return () => {
      vigente = false
    }
  }, [])

  useEffect(() => {
    let vigente = true
    const mostrarEsqueleto = !cargaInicialCompleta.current
    if (mostrarEsqueleto) {
      setCargando(true)
      setError('')
    }

    void listarAvisos()
      .then((datos) => {
        if (!vigente) return
        setItems(datos.items)
        setSiguiente(datos.siguiente)
        setError('')
        actualizarNoLeidas(datos.noLeidas)
        cargaInicialCompleta.current = true
      })
      .catch(() => {
        if (vigente && mostrarEsqueleto) {
          setError('No se pudieron cargar tus avisos.')
        }
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })

    return () => {
      vigente = false
    }
  }, [revision, versionLista, actualizarNoLeidas])

  function reintentar() {
    cargaInicialCompleta.current = false
    setError('')
    setCargando(true)
    setRevision((r) => r + 1)
  }

  async function cargarMas() {
    if (!siguiente || cargandoMas) return
    setCargandoMas(true)
    setErrorMas('')
    try {
      const datos = await listarAvisos(siguiente)
      setItems((actuales) => {
        const vistos = new Set(actuales.map((a) => a.id))
        return [...actuales, ...datos.items.filter((a) => !vistos.has(a.id))]
      })
      setSiguiente(datos.siguiente)
      actualizarNoLeidas(datos.noLeidas)
    } catch {
      setErrorMas('No se pudieron cargar más avisos. Inténtalo de nuevo.')
    } finally {
      setCargandoMas(false)
    }
  }

  async function activarPush() {
    if (activandoPush) return
    setActivandoPush(true)
    setErrorPush('')
    setPushActivadoAhora(false)
    try {
      const resultado = await activarNotificacionesPush()
      setEstadoPermiso(resultado)
      if (resultado === 'granted') {
        setPushActivadoAhora(true)
      }
    } catch {
      setErrorPush('No se pudieron activar las notificaciones. Inténtalo de nuevo.')
    } finally {
      setActivandoPush(false)
    }
  }

  async function seleccionarAviso(aviso: Aviso) {
    if (abriendoRef.current === aviso.id) return
    abriendoRef.current = aviso.id
    try {
      await abrirAviso(aviso)
      if (!aviso.leida) {
        setItems((actuales) => actuales.map((a) => (a.id === aviso.id ? { ...a, leida: true } : a)))
      }
    } finally {
      abriendoRef.current = null
    }
  }

  return (
    <div className="panel-pagina">
      <div className="panel-contenedor">
        <header className="panel-encabezado">
          <div className="panel-encabezado-textos">
            <EyebrowPanel grupo="operacion" icono={Inbox} />
            <h1 className="panel-titulo">Avisos</h1>
            <p className="panel-subtitulo">
              Consulta tus solicitudes nuevas y cancelaciones de clientes.
            </p>
          </div>
          {!cargando && !error && noLeidas > 0 && (
            <div className="panel-encabezado-acciones">
              <span className="panel-insignia">{noLeidas} sin leer</span>
            </div>
          )}
        </header>

        {estadoPermiso === 'ios-sin-instalar' && (
          <div className="panel-alerta panel-alerta--info" role="status">
            <span className="panel-alerta-icono" aria-hidden="true">
              <Bell aria-hidden="true" />
            </span>
            <div className="panel-alerta-contenido">
              En iPhone, instala el panel en tu pantalla de inicio para recibir notificaciones (iOS 16.4 o posterior).
            </div>
          </div>
        )}

        {estadoPermiso === 'default' && (
          <div className="panel-alerta panel-alerta--info panel-alerta--apilable">
            <span className="panel-alerta-icono" aria-hidden="true">
              <Bell aria-hidden="true" />
            </span>
            <div className="panel-alerta-contenido">
              Activa las notificaciones para enterarte de nuevas solicitudes aunque no tengas el panel abierto.
            </div>
            <button
              type="button"
              className="btn-servia-primary btn-servia-sm panel-alerta-accion"
              disabled={activandoPush}
              onClick={() => void activarPush()}
            >
              {activandoPush ? 'Activando...' : 'Activar notificaciones'}
            </button>
          </div>
        )}

        {estadoPermiso === 'denied' && (
          <div className="panel-alerta panel-alerta--aviso" role="status">
            <span className="panel-alerta-icono" aria-hidden="true">
              <BellOff aria-hidden="true" />
            </span>
            <div className="panel-alerta-contenido">
              Bloqueaste las notificaciones. Puedes permitirlas desde la configuración del navegador.
            </div>
          </div>
        )}

        {pushActivadoAhora && (
          <div className="panel-alerta panel-alerta--exito" role="status">
            <span className="panel-alerta-icono" aria-hidden="true">
              <Bell aria-hidden="true" />
            </span>
            <div className="panel-alerta-contenido">Notificaciones activadas.</div>
          </div>
        )}

        {errorPush && (
          <div className="panel-alerta panel-alerta--error" role="alert">
            <span className="panel-alerta-icono" aria-hidden="true">
              <CircleAlert aria-hidden="true" />
            </span>
            <div className="panel-alerta-contenido">{errorPush}</div>
          </div>
        )}

        <section className="panel-tarjeta" aria-labelledby="avisos-lista-titulo" aria-busy={cargando}>
          <div className="panel-tarjeta-encabezado">
            <div>
              <h2 id="avisos-lista-titulo" className="panel-tarjeta-titulo">
                Bandeja de avisos
              </h2>
              <p className="panel-tarjeta-subtitulo">
                Toca un aviso para abrir el detalle de la reserva.
              </p>
            </div>
          </div>

          {cargando && (
            <div className="panel-cargando" role="status" aria-label="Cargando avisos">
              <span className="panel-cargando-texto">Cargando tus avisos...</span>
              <EsqueletoLista filas={3} />
            </div>
          )}

          {!cargando && error && (
            <div className="panel-estado panel-estado--error">
              <IlustracionEstado icono={CircleAlert} error />
              <div className="panel-estado-cuerpo">
                <p className="panel-estado-texto" role="alert">
                  {error}
                </p>
                <div className="panel-estado-acciones">
                  <button type="button" className="btn-servia-primary" onClick={reintentar}>
                    Reintentar
                  </button>
                </div>
              </div>
            </div>
          )}

          {!cargando && !error && items.length === 0 && (
            <div className="panel-estado">
              <IlustracionEstado icono={Bell} />
              <div className="panel-estado-cuerpo">
                <h3 className="panel-estado-titulo">Todavía no tienes avisos.</h3>
                <p className="panel-estado-texto">
                  Cuando recibas una solicitud nueva o una cancelación, aparecerá aquí.
                </p>
              </div>
            </div>
          )}

          {!cargando && !error && items.length > 0 && (
            <>
              <ul className="panel-lista panel-avisos-lista">
                {items.map((aviso) => (
                  <li key={aviso.id}>
                    <button
                      type="button"
                      className={`panel-item panel-aviso-item ${aviso.leida ? '' : 'panel-item--no-leido'}`}
                      onClick={() => void seleccionarAviso(aviso)}
                    >
                      <span className="panel-aviso-cuerpo">
                        <span className="panel-item-titulo panel-aviso-titulo">{aviso.titulo}</span>
                        <span className="panel-item-texto panel-aviso-texto">{aviso.cuerpo}</span>
                      </span>
                      <span className="panel-aviso-meta">
                        {!aviso.leida && <span className="panel-insignia">Sin leer</span>}
                        <time className="panel-aviso-fecha" dateTime={aviso.creadaEn}>
                          {formatearFecha(aviso.creadaEn)}
                        </time>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              {errorMas && (
                <div className="panel-alerta panel-alerta--error" role="alert">
                  <span className="panel-alerta-icono" aria-hidden="true">
                    <CircleAlert aria-hidden="true" />
                  </span>
                  <div className="panel-alerta-contenido">{errorMas}</div>
                </div>
              )}

              {siguiente && (
                <div className="panel-paginacion">
                  <span className="panel-ayuda">Mostrando {items.length} avisos</span>
                  <button
                    type="button"
                    className="btn-servia-secondary btn-servia-sm"
                    disabled={cargandoMas}
                    onClick={() => void cargarMas()}
                  >
                    {cargandoMas ? 'Cargando más...' : 'Cargar más'}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
