import { createContext, useContext } from 'react'

export interface AvisoSeleccionado {
  id?: string | null
  reservaId?: string | null
  leida?: boolean
}

export interface NotificacionesContextValue {
  noLeidas: number
  versionLista: number
  actualizarNoLeidas: (valor: number) => void
  decrementarNoLeidas: () => void
  refrescarNoLeidas: () => Promise<void>
  abrirAviso: (aviso: AvisoSeleccionado) => Promise<void>
}

const valorPorDefecto: NotificacionesContextValue = {
  noLeidas: 0,
  versionLista: 0,
  actualizarNoLeidas: () => {},
  decrementarNoLeidas: () => {},
  refrescarNoLeidas: async () => {},
  abrirAviso: async () => {},
}

export const NotificacionesContext = createContext<NotificacionesContextValue>(valorPorDefecto)

export function useNotificaciones(): NotificacionesContextValue {
  return useContext(NotificacionesContext)
}
