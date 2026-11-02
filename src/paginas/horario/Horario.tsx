import { useEffect, useState, type FormEvent } from 'react'
import { ShieldAlert } from 'lucide-react'
import { api } from '../../servicios/api'
import '../servicios/Servicios.css'
import './Horario.css'

const DIAS = [
  { clave: 'lunes', nombre: 'Lunes' },
  { clave: 'martes', nombre: 'Martes' },
  { clave: 'miercoles', nombre: 'Miércoles' },
  { clave: 'jueves', nombre: 'Jueves' },
  { clave: 'viernes', nombre: 'Viernes' },
  { clave: 'sabado', nombre: 'Sábado' },
  { clave: 'domingo', nombre: 'Domingo' },
] as const

type ClaveDia = (typeof DIAS)[number]['clave']

interface Intervalo {
  abre: string
  cierra: string
}

type DiasHorario = Record<ClaveDia, Intervalo | null>

interface RespuestaHorario {
  configurado: boolean
  dias: DiasHorario | null
}

interface ReservaEnConflicto {
  id: string
  folio: string
  inicio: string
  fin: string
  servicio: { nombre: string }
  estado: string
}

interface DiaFormulario {
  laborable: boolean
  abre: string
  cierra: string
}

type FormularioHorario = Record<ClaveDia, DiaFormulario>
type ErroresHorario = Partial<Record<ClaveDia, string>>

const HORA_APERTURA_INICIAL = '09:00'
const HORA_CIERRE_INICIAL = '18:00'

const MENSAJE_SIN_HORARIO =
  'Configura tu horario de atención para empezar a recibir reservas.'
const MENSAJE_SIN_DIAS =
  'Sin días laborables, los clientes no podrán reservar.'
const MENSAJE_ERROR_GUARDADO =
  'No pudimos guardar tu horario. Intenta de nuevo.'
const MENSAJE_CIERRE_INVALIDO =
  'La hora de cierre debe ser posterior a la de apertura.'
const MENSAJE_HORAS_FALTANTES =
  'Indica la hora de apertura y la de cierre.'

// Arma el formulario con los 7 días. Los días sin horario guardado empiezan
// como Descanso, con un horario sugerido que se usa al activarlos.
function crearFormulario(dias: DiasHorario | null): FormularioHorario {
  const formulario = {} as FormularioHorario

  for (const { clave } of DIAS) {
    const intervalo = dias?.[clave] ?? null
    formulario[clave] = {
      laborable: intervalo !== null,
      abre: intervalo?.abre ?? HORA_APERTURA_INICIAL,
      cierra: intervalo?.cierra ?? HORA_CIERRE_INICIAL,
    }
  }

  return formulario
}

function horaAMinutos(hora: string): number | null {
  const coincidencia = /^(\d{2}):(\d{2})$/.exec(hora)
  if (!coincidencia) return null

  const horas = Number(coincidencia[1])
  const minutos = Number(coincidencia[2])

  if (horas > 23 || minutos > 59) return null
  return horas * 60 + minutos
}

function aDiasHorario(formulario: FormularioHorario): DiasHorario {
  const dias = {} as DiasHorario

  for (const { clave } of DIAS) {
    const dia = formulario[clave]
    dias[clave] = dia.laborable
      ? { abre: dia.abre, cierra: dia.cierra }
      : null
  }

  return dias
}

function esConflicto(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'estado' in error &&
      (error as { estado: unknown }).estado === 409,
  )
}

function datosDelError(error: unknown): unknown {
  if (error && typeof error === 'object' && 'datos' in error) {
    return (error as { datos: unknown }).datos
  }

  return undefined
}

function reservasDelError(datos: unknown): ReservaEnConflicto[] {
  if (
    datos &&
    typeof datos === 'object' &&
    Array.isArray((datos as { reservas?: unknown }).reservas)
  ) {
    return (datos as { reservas: ReservaEnConflicto[] }).reservas
  }

  return []
}

function formatearFecha(inicio: string): string {
  const fecha = new Date(inicio)
  if (Number.isNaN(fecha.getTime())) return inicio

  return fecha.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatearHora(inicio: string): string {
  const fecha = new Date(inicio)
  if (Number.isNaN(fecha.getTime())) return ''

  return fecha.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatearEstado(estado: string): string {
  if (!estado) return ''
  return estado.charAt(0).toUpperCase() + estado.slice(1)
}

export function Horario() {
  const [formulario, setFormulario] = useState<FormularioHorario>(() =>
    crearFormulario(null),
  )
  const [configurado, setConfigurado] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState<ErroresHorario>({})
  const [mostrarModalExito, setMostrarModalExito] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')
  const [reservasConflicto, setReservasConflicto] = useState<
    ReservaEnConflicto[]
  >([])
  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [intentoCarga, setIntentoCarga] = useState(0)

  useEffect(() => {
    let activo = true

    const cargarHorario = async () => {
      try {
        const respuesta = await api<RespuestaHorario>('/negocios/mio/horario')
        if (!activo) return

        setConfigurado(respuesta.configurado)
        setFormulario(crearFormulario(respuesta.dias))
      } catch {
        if (activo) {
          setErrorCarga('No pudimos cargar tu horario. Intenta de nuevo.')
        }
      } finally {
        if (activo) setCargando(false)
      }
    }

    void cargarHorario()

    return () => {
      activo = false
    }
  }, [intentoCarga])

  const reintentarCarga = () => {
    setCargando(true)
    setErrorCarga('')
    setIntentoCarga((intento) => intento + 1)
  }

  const actualizarDia = (clave: ClaveDia, cambios: Partial<DiaFormulario>) => {
    setFormulario((previo) => ({
      ...previo,
      [clave]: { ...previo[clave], ...cambios },
    }))
    setErrores((previos) => ({ ...previos, [clave]: undefined }))
    setErrorGuardado('')
  }

  const validar = (): boolean => {
    const nuevosErrores: ErroresHorario = {}

    for (const { clave } of DIAS) {
      const dia = formulario[clave]
      if (!dia.laborable) continue

      if (!dia.abre || !dia.cierra) {
        nuevosErrores[clave] = MENSAJE_HORAS_FALTANTES
        continue
      }

      const abre = horaAMinutos(dia.abre)
      const cierra = horaAMinutos(dia.cierra)

      if (abre === null || cierra === null) {
        nuevosErrores[clave] = MENSAJE_HORAS_FALTANTES
      } else if (cierra <= abre) {
        nuevosErrores[clave] = MENSAJE_CIERRE_INVALIDO
      }
    }

    setErrores(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  const guardar = async (confirmar = false) => {
    if (!confirmar && !validar()) return

    setGuardando(true)
    setErrorGuardado('')

    try {
      const respuesta = await api<RespuestaHorario>(
        `/negocios/mio/horario${confirmar ? '?confirmar=true' : ''}`,
        {
          method: 'PUT',
          body: JSON.stringify(aDiasHorario(formulario)),
        },
      )

      // Un guardado exitoso siempre deja el horario configurado, aunque el
      // servidor no repita el campo en la respuesta.
      setConfigurado(true)
      if (respuesta.dias) {
        setFormulario(crearFormulario(respuesta.dias))
      }
      setReservasConflicto([])
      setDialogoAbierto(false)
      setMostrarModalExito(true)
    } catch (error) {
      if (esConflicto(error)) {
        setReservasConflicto(reservasDelError(datosDelError(error)))
        setDialogoAbierto(true)
      } else {
        setDialogoAbierto(false)
        setErrorGuardado(MENSAJE_ERROR_GUARDADO)
      }
    } finally {
      setGuardando(false)
    }
  }

  const handleSubmit = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    void guardar()
  }

  const todasDescanso = DIAS.every(
    ({ clave }) => !formulario[clave].laborable,
  )
  const diasActivos = DIAS.filter(
    ({ clave }) => formulario[clave].laborable,
  ).length

  if (cargando) {
    return (
      <div className="horario-page d-flex align-items-center justify-content-center">
        <div className="text-center">
          <div className="spinner-border horario-spinner" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="text-secondary mt-3 mb-0">
            Cargando tu horario...
          </p>
        </div>
      </div>
    )
  }

  if (errorCarga) {
    return (
      <div className="horario-page">
        <div className="horario-container">
          <div className="horario-feedback" role="alert">
            <div className="horario-feedback-icono">!</div>
            <h1>Algo salió mal</h1>
            <p>{errorCarga}</p>
            <button
              type="button"
              className="btn-servia-primary"
              onClick={reintentarCarga}
            >
              Intentar de nuevo
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="horario-page">
      <div className="horario-container">
        <header className="horario-hero">
          <div className="horario-hero-contenido">
            <span className="horario-eyebrow">
              <span className="horario-eyebrow-punto" aria-hidden="true" />
              OPERACIONES
            </span>
            <h1>Horario de atención</h1>
            <p>
              Define qué días trabaja tu negocio y en qué horario puedes recibir
              reservas.
            </p>

            <div className="horario-hero-meta">
              <span
                className={`horario-estado ${
                  configurado
                    ? 'horario-estado--activo'
                    : 'horario-estado--pendiente'
                }`}
              >
                <span className="horario-estado-punto" aria-hidden="true" />
                {configurado ? 'Horario configurado' : 'Horario pendiente'}
              </span>
              <span className="horario-meta-separador" aria-hidden="true" />
              <span className="horario-meta-texto">
                {diasActivos} de 7 días laborables
              </span>
            </div>
          </div>

          <div className="horario-hero-ilustracion" aria-hidden="true">
            <span className="horario-hero-brillo horario-hero-brillo--uno" />
            <span className="horario-hero-brillo horario-hero-brillo--dos" />
            <div className="horario-hero-icono">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4.5" width="18" height="17" rx="3" />
                <path d="M8 2.5v4M16 2.5v4M3 9.5h18" />
                <path d="M8 14h2M14 14h2M8 18h2" />
              </svg>
            </div>
          </div>
        </header>

        {!configurado && (
          <div className="horario-aviso horario-aviso--pendiente" role="status">
            <div className="horario-aviso-icono" aria-hidden="true">
              <ShieldAlert />
            </div>
            <div className="horario-aviso-contenido">
              <strong>{MENSAJE_SIN_HORARIO}</strong>
              <p>Mientras no guardes tu horario, no podrás recibir reservas.</p>
            </div>
          </div>
        )}

        {errorGuardado && (
          <div className="horario-aviso horario-aviso--error" role="alert">
            <div className="horario-aviso-icono" aria-hidden="true">
              !
            </div>
            <div className="horario-aviso-contenido">
              <strong>{errorGuardado}</strong>
            </div>
          </div>
        )}

        <section className="horario-card" aria-labelledby="titulo-horario">
          <div className="horario-card-header">
            <div>
              <span className="horario-card-eyebrow">PLAN SEMANAL</span>
              <h2 id="titulo-horario">Tu semana</h2>
              <p>Activa los días que trabajas y ajusta tu horario de atención.</p>
            </div>

            <div
              className="horario-card-resumen"
              aria-label={`${diasActivos} días laborables`}
            >
              <strong>{diasActivos}</strong>
              <span>{diasActivos === 1 ? 'día activo' : 'días activos'}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="horario-lista">
              {DIAS.map(({ clave, nombre }) => {
                const dia = formulario[clave]
                const error = errores[clave]

                return (
                  <div
                    key={clave}
                    className={`horario-fila ${
                      dia.laborable ? '' : 'horario-fila--descanso'
                    }`}
                    data-testid={`dia-${clave}`}
                  >
                    <div className="horario-dia">
                      <span className="horario-dia-badge" aria-hidden="true">
                        {nombre.charAt(0)}
                      </span>
                      <div className="horario-dia-info">
                        <span className="horario-dia-nombre">{nombre}</span>
                        <span
                          className={`horario-dia-detalle ${
                            dia.laborable
                              ? 'horario-dia-detalle--activo'
                              : ''
                          }`}
                        >
                          {dia.laborable
                            ? `${dia.abre || '--:--'} a ${
                                dia.cierra || '--:--'
                              }`
                            : 'Día de descanso'}
                        </span>
                      </div>
                    </div>

                    <div className="horario-controles">
                      {dia.laborable && (
                        <div className="horario-horas">
                          <div className="horario-campo">
                            <label htmlFor={`${clave}-abre`}>Abre</label>
                            <input
                              id={`${clave}-abre`}
                              type="time"
                              value={dia.abre}
                              onChange={(evento) =>
                                actualizarDia(clave, {
                                  abre: evento.target.value,
                                })
                              }
                              aria-invalid={Boolean(error)}
                              aria-describedby={
                                error ? `${clave}-error` : undefined
                              }
                            />
                          </div>

                          <span
                            className="horario-horas-separador"
                            aria-hidden="true"
                          >
                            a
                          </span>

                          <div className="horario-campo">
                            <label htmlFor={`${clave}-cierra`}>Cierra</label>
                            <input
                              id={`${clave}-cierra`}
                              type="time"
                              value={dia.cierra}
                              onChange={(evento) =>
                                actualizarDia(clave, {
                                  cierra: evento.target.value,
                                })
                              }
                              aria-invalid={Boolean(error)}
                              aria-describedby={
                                error ? `${clave}-error` : undefined
                              }
                            />
                          </div>
                        </div>
                      )}

                      <label className="horario-switch">
                        <input
                          type="checkbox"
                          role="switch"
                          checked={dia.laborable}
                          onChange={(evento) =>
                            actualizarDia(clave, {
                              laborable: evento.target.checked,
                            })
                          }
                          aria-label={`${nombre} laborable`}
                        />
                        <span
                          className="horario-switch-slider"
                          aria-hidden="true"
                        />
                        <span className="horario-switch-texto">
                          {dia.laborable ? 'Laborable' : 'Descanso'}
                        </span>
                      </label>
                    </div>

                    {error && (
                      <p
                        id={`${clave}-error`}
                        className="horario-error"
                        role="alert"
                      >
                        {error}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {todasDescanso && (
              <div className="horario-aviso-sin-dias" role="status">
                <span aria-hidden="true">!</span>
                {MENSAJE_SIN_DIAS}
              </div>
            )}

            <div className="horario-footer">
              <div className="horario-footer-info">
                <span className="horario-footer-icono" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                </span>
                <div>
                  <strong>
                    {diasActivos === 0
                      ? 'Ningún día laborable'
                      : `${diasActivos} ${
                          diasActivos === 1 ? 'día activo' : 'días activos'
                        }`}
                  </strong>
                  <span>
                    {diasActivos === 0
                      ? 'Activa al menos un día para recibir reservas.'
                      : 'Los clientes solo podrán reservar dentro de estos días y horas.'}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="btn-servia-primary horario-btn-guardar"
                disabled={guardando}
              >
                {guardando ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    />
                    Guardando...
                  </>
                ) : (
                  'Guardar horario'
                )}
              </button>
            </div>
          </form>
        </section>
      </div>

      {dialogoAbierto && (
        <div className="horario-dialogo-overlay">
          <div
            className="horario-dialogo"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="horario-conflicto-titulo"
            aria-describedby="horario-conflicto-texto"
          >
            <div className="horario-dialogo-encabezado">
              <span className="horario-dialogo-icono" aria-hidden="true">
                !
              </span>
              <div>
                <h2 id="horario-conflicto-titulo">
                  Estas reservas quedan fuera del nuevo horario
                </h2>

                <p
                  id="horario-conflicto-texto"
                  className="horario-dialogo-texto"
                >
                  No se cancelarán solas. Si guardas, revisa cada una.
                </p>
              </div>
            </div>

            <div className="table-responsive horario-tabla-contenedor">
              <table className="table horario-tabla">
                <thead>
                  <tr>
                    <th scope="col">Folio</th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Hora</th>
                    <th scope="col">Servicio</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {reservasConflicto.map((reserva) => (
                    <tr key={reserva.id || reserva.folio}>
                      <td>{reserva.folio}</td>
                      <td>{formatearFecha(reserva.inicio)}</td>
                      <td>{formatearHora(reserva.inicio)}</td>
                      <td>{reserva.servicio?.nombre}</td>
                      <td>{formatearEstado(reserva.estado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="horario-dialogo-acciones">
              <button
                type="button"
                className="btn-servia-primary"
                onClick={() => void guardar(true)}
                disabled={guardando}
              >
                {guardando ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    />
                    Guardando...
                  </>
                ) : (
                  'Guardar de todos modos'
                )}
              </button>

              <button
                type="button"
                className="btn-servia-secondary"
                onClick={() => setDialogoAbierto(false)}
                disabled={guardando}
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarModalExito && (
        <div
          className="servicio-alerta-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="horario-exito-titulo"
          aria-describedby="horario-exito-texto"
        >
          <div className="servicio-alerta-card">
            <div className="servicio-alerta-icono" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>

            <h2
              id="horario-exito-titulo"
              className="servicio-alerta-titulo"
            >
              Horario guardado.
            </h2>

            <p id="horario-exito-texto" className="servicio-alerta-texto">
              {diasActivos > 0
                ? 'Tu horario de atención quedó actualizado. Los clientes podrán reservar dentro de los días y horas que configuraste.'
                : 'Tu horario se guardó, pero no hay días laborables. Los clientes no podrán reservar hasta que actives uno.'}
            </p>

            <div className="servicio-alerta-acciones">
              <button
                type="button"
                className="btn-servia-primary"
                onClick={() => setMostrarModalExito(false)}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
