import { Navigate } from 'react-router'
import { useAuth } from '../contextos/AuthContext'
import Home from './home/Home'

export function Inicio() {
  const { usuario, cargando } = useAuth()

  if (cargando) return <div className="text-center mt-5"><h3>Cargando...</h3></div>

  return usuario ? <Navigate to="/resumen" replace /> : <Home />
}
