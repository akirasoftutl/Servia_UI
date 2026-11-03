import { useLocation, useNavigate } from 'react-router'

export function useVolver() {
  const navigate = useNavigate()
  const { key } = useLocation()

  return () => {
    // BrowserRouter conserva el índice incluso tras recargar. Los routers de
    // memoria no escriben history.state; su entrada inicial usa la key default.
    const indice = window.history.state?.idx
    const hayAnterior = typeof indice === 'number' ? indice > 0 : key !== 'default'

    if (hayAnterior) {
      void navigate(-1)
    } else {
      void navigate('/', { replace: true })
    }
  }
}
