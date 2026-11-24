import { useEffect, useState } from 'react'
import { Tags, Eye } from 'lucide-react'
import { EstadoCargando, EstadoError, EstadoVacio } from '../../componentes/panel/EstadosPanel'
import { EncabezadoPanel } from '../../componentes/panel/EncabezadoPanel'
import { TarjetaPanel } from '../../componentes/panel/TarjetaPanel'
import { BotonPanel } from '../../componentes/panel/BotonPanel'
import { api, ErrorApi } from '../../servicios/api'
import { mensajeDeError } from '../../servicios/mensajeDeError'
import type { Direccion } from './direccion'
import './VistaPrevia.css'

interface Perfil {
  id: string
  nombre?: string
  categoriaId?: string
  descripcion?: string
  direccion?: Direccion | string | null
  direccionTexto?: string
  telefono?: string
  correoContacto?: string
}
interface EstadoNegocio extends Perfil {
  activo: boolean
  perfilCompleto: boolean
  camposFaltantes: string[]
  serviciosActivos: number
  aceptaReservas: boolean
  tieneHorario: boolean
}
interface Servicio {
  id: string
  nombre: string
  precio: number
  duracionMin: number
  // La consulta pública ya filtra activos y omite este campo.
  activo?: boolean
}
interface Datos {
  estado: EstadoNegocio
  perfil: Perfil
  servicios: Servicio[]
  categoria: string
  motivo: string
  vistaPropia: boolean
}

function motivoNoVisible(estado: EstadoNegocio) {
  // RN-08, RN-10, RN-11: el visible guardado puede estar desactualizado.
  if (!estado.activo) return 'tu cuenta está desactivada'
  if (!estado.perfilCompleto) {
    const campos = estado.camposFaltantes?.join(', ')
    return `falta completar el perfil${campos ? `: ${campos}` : ''}`
  }
  if (estado.serviciosActivos <= 0) return 'no tienes servicios activos'
  return ''
}

function direccionEnTexto(perfil: Perfil) {
  if (typeof perfil.direccion === 'string') return perfil.direccion || perfil.direccionTexto
  if (perfil.direccionTexto) return perfil.direccionTexto
  const d = perfil.direccion
  return d && [d.calle, d.numeroExterior, d.numeroInterior && `Int. ${d.numeroInterior}`,
    d.colonia, d.codigoPostal, d.municipio, d.estado].filter(Boolean).join(', ')
}

export function VistaPrevia() {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let vigente = true
    async function cargar() {
      try {
        const estado = await api<EstadoNegocio>('/negocios/mio')
        const motivo = motivoNoVisible(estado)
        async function cargarPerfil() {
          if (!motivo) {
            const ruta = `/negocios/${encodeURIComponent(estado.id)}`
            try {
              const [perfil, servicios] = await Promise.all([
                api<Perfil>(ruta), api<Servicio[]>(`${ruta}/servicios`),
              ])
              return { perfil, servicios, vistaPropia: false }
            } catch (error) {
              if (!(error instanceof ErrorApi) || error.estado !== 404) throw error
            }
          }
          return {
            perfil: estado,
            servicios: await api<Servicio[]>('/negocios/mio/servicios?estado=activos'),
            vistaPropia: true,
          }
        }
        const [{ perfil, servicios, vistaPropia }, categorias] = await Promise.all([
          cargarPerfil(),
          api<{ id: string; nombre: string }[]>('/categorias').catch(() => []),
        ])
        if (vigente) setDatos({ estado, perfil, motivo, vistaPropia,
          servicios: servicios.filter(servicio => servicio.activo !== false),
          categoria: categorias.find(c => c.id === perfil.categoriaId)?.nombre ?? 'Categoría no disponible',
        })
      } catch (causa: unknown) {
        if (vigente) setError(mensajeDeError(causa, 'No pudimos cargar la vista previa. Intenta nuevamente.'))
      }
    }
    void cargar()
    return () => { vigente = false }
  }, [revision])

  function reintentar() {
    setDatos(null)
    setError('')
    setRevision(valor => valor + 1)
  }

  return (
    <div className="panel-pagina vista-previa">
      <div className="panel-contenedor">
        <EncabezadoPanel
          grupo="negocio"
          icono={Eye}
          titulo="Vista previa: así te ven tus clientes"
          subtitulo="Consulta cómo se muestran tu perfil y tus servicios."
          acciones={<BotonPanel variante="secundario" to="/mi-perfil">Volver a Mi perfil</BotonPanel>}
        />
        {error ? <EstadoError mensaje={error} onReintentar={reintentar} /> : !datos ? <EstadoCargando mensaje="Cargando vista previa..." /> : <>
          <TarjetaPanel tituloId="estado-app">
            <div className={`panel-alerta ${datos.vistaPropia ? 'panel-alerta--aviso' : 'panel-alerta--info'} mb-0`}>
              <span className="panel-alerta-icono" aria-hidden="true">!</span>
              <div className="panel-alerta-contenido">
                <h2 id="estado-app" className="panel-tarjeta-titulo">Estado en la app</h2>
                {datos.vistaPropia ? <>
                  {datos.motivo && <p className="panel-item-texto">No aparece en las búsquedas porque {datos.motivo}.</p>}
                  <strong>Así te verán cuando aparezcas</strong>
                </> : <p className="panel-item-texto">Tu negocio aparece en las búsquedas.</p>}
                {(datos.estado.aceptaReservas === false || datos.estado.tieneHorario === false) &&
                  <p className="panel-item-texto">Los clientes verán: <strong>No acepta reservas por ahora</strong></p>}
              </div>
            </div>
          </TarjetaPanel>
          <TarjetaPanel titulo={datos.perfil.nombre || 'Nombre pendiente'} tituloId="nombre-negocio">
            <p className="panel-item-texto vista-previa-texto">{datos.categoria}</p>
            <p className="panel-item-texto vista-previa-texto">{datos.perfil.descripcion || 'Descripción pendiente'}</p>
            <dl className="vista-previa-datos">
              <div><dt className="vista-previa-etiqueta">Dirección</dt><dd className="vista-previa-valor">{direccionEnTexto(datos.perfil) || 'Dirección pendiente'}</dd></div>
              <div><dt className="vista-previa-etiqueta">Teléfono</dt><dd className="vista-previa-valor">{datos.perfil.telefono || 'Teléfono pendiente'}</dd></div>
              <div><dt className="vista-previa-etiqueta">Correo de contacto</dt><dd className="vista-previa-valor">{datos.perfil.correoContacto || 'Correo pendiente'}</dd></div>
            </dl>
          </TarjetaPanel>
          <TarjetaPanel titulo="Servicios activos" tituloId="servicios-activos">
            {datos.servicios.length === 0 ? <EstadoVacio
              icono={Tags}
              titulo="Sin servicios activos"
              texto="Activa al menos un servicio para que los clientes vean tu perfil completo."
              accion={<BotonPanel variante="primario" to="/servicios/nuevo">Crear servicio</BotonPanel>}
            /> :
              <ul className="panel-lista list-unstyled mb-0">{datos.servicios.map(servicio => <li className="panel-item" key={servicio.id}>
                <div>
                  <h3 className="panel-item-titulo">{servicio.nombre}</h3>
                  <p className="panel-item-texto">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(servicio.precio)} · {servicio.duracionMin} minutos</p>
                </div>
              </li>)}</ul>}
          </TarjetaPanel>
        </>}
      </div>
    </div>
  )
}
