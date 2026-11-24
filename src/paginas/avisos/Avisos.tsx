import { useEffect, useRef, useState } from 'react'
import { Bell, BellOff, CircleAlert, Inbox } from 'lucide-react'
import { EncabezadoPanel } from '../../componentes/panel/EncabezadoPanel'
import { TarjetaPanel } from '../../componentes/panel/TarjetaPanel'
import { EtiquetaEstado } from '../../componentes/panel/EtiquetaEstado'
import { BotonPanel } from '../../componentes/panel/BotonPanel'
import { EsqueletoLista, EstadoError, EstadoVacio } from '../../componentes/panel/EstadosPanel'
import { useNotificaciones } from '../../contextos/notificacionesContexto'
import {
  activarNotificacionesPush,
  consultarEstadoPermisoPush,
  listarAvisos,
  type Aviso,
  type EstadoPermisoPush,
} from '../../servicios/notificaciones'
import { mensajeDeError } from '../../servicios/mensajeDeError'
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
      .catch((causa: unknown) => {
        if (vigente && mostrarEsqueleto) {
          setError(mensajeDeError(causa, 'No se pudieron cargar tus avisos.'))
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
    } catch (causa: unknown) {
      setErrorMas(mensajeDeError(causa, 'No se pudieron cargar más avisos. Inténtalo de nuevo.'))
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
    } catch (causa: unknown) {
      setErrorPush(mensajeDeError(causa, 'No se pudieron activar las notificaciones. Inténtalo de nuevo.'))
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
        <EncabezadoPanel
          grupo="operacion"
          icono={Inbox}
          titulo="Avisos"
          subtitulo="Consulta tus solicitudes nuevas y cancelaciones de clientes."
          acciones={!cargando && !error && noLeidas > 0 ? (
            <EtiquetaEstado texto={`${noLeidas} sin leer`} tono="info" />
          ) : undefined}
        />

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
            <BotonPanel
              variante="primario"
              tamano="sm"
              className="panel-alerta-accion"
              disabled={activandoPush}
              onClick={() => void activarPush()}
            >
              {activandoPush ? 'Activando...' : 'Activar notificaciones'}
            </BotonPanel>
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

        <TarjetaPanel
          titulo="Bandeja de avisos"
          tituloId="avisos-lista-titulo"
          subtitulo="Toca un aviso para abrir el detalle de la reserva."
          ariaBusy={cargando}
        >

          {cargando && (
            <div className="panel-cargando" role="status" aria-label="Cargando avisos">
              <span className="panel-cargando-texto">Cargando tus avisos...</span>
              <EsqueletoLista filas={3} />
            </div>
          )}

          {!cargando && error && (
            <EstadoError icono={CircleAlert} mensaje={error} onReintentar={reintentar} />
          )}

          {!cargando && !error && items.length === 0 && (
            <EstadoVacio
              icono={Bell}
              titulo="Todavía no tienes avisos."
              texto="Cuando recibas una solicitud nueva o una cancelación, aparecerá aquí."
            />
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
                        {!aviso.leida && <EtiquetaEstado texto="Sin leer" tono="info" />}
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
                  <BotonPanel
                    variante="secundario"
                    tamano="sm"
                    disabled={cargandoMas}
                    onClick={() => void cargarMas()}
                  >
                    {cargandoMas ? 'Cargando más...' : 'Cargar más'}
                  </BotonPanel>
                </div>
              )}
            </>
          )}
        </TarjetaPanel>
      </div>
    </div>
  )
}
