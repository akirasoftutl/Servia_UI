import { useEffect, useState } from 'react'
import { api } from '../servicios/api'
import { firebaseConfigurado } from '../servicios/firebase'

type EstadoApi = 'revisando' | 'conectada' | 'sin-conexion'

// Página de ejemplo del proyecto base: muestra si el panel ve a la API y a Firebase.
// Se reemplaza cuando lleguen las historias del Sprint 1.
export function Inicio() {
  const [estadoApi, setEstadoApi] = useState<EstadoApi>('revisando')

  useEffect(() => {
    let activo = true
    api<{ estado: string }>('/salud')
      .then(() => activo && setEstadoApi('conectada'))
      .catch(() => activo && setEstadoApi('sin-conexion'))
    return () => {
      activo = false
    }
  }, [])

  return (
    <section>
      <h1>Panel del negocio</h1>
      <p>Aquí vas a administrar el perfil, los servicios, el horario y las reservas de tu negocio.</p>
      <ul className="estado">
        <li>
          API:{' '}
          {estadoApi === 'revisando' ? 'revisando…' : estadoApi === 'conectada' ? 'conectada' : 'sin conexión'}
        </li>
        <li>Firebase: {firebaseConfigurado ? 'configurado' : 'sin configurar'}</li>
      </ul>
    </section>
  )
}
