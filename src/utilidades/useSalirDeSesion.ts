import { useNavigate } from 'react-router'
import { useAuth } from '../contextos/AuthContext'

/**
 * Cierra la sesión y deja el historial como [..., '/', '/login'] para que la
 * flecha «atrás» desde el login lleve a la landing y no a una página del panel
 * (que `RutaProtegida` volvería a mandar al login, atrapando a la persona).
 */
export function useSalirDeSesion() {
  const { cerrarSesion } = useAuth()
  const navigate = useNavigate()

  return async () => {
    await cerrarSesion()
    // Reemplaza la página protegida por la landing y luego empuja el login.
    void navigate('/', { replace: true })
    void navigate('/login')
  }
}
