import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { registerSW } from 'virtual:pwa-register'
import 'bootstrap/dist/css/bootstrap.min.css';
import './estilos/panel.css';
import { AuthProvider } from './contextos/AuthContext';
import { BannerOffline } from './componentes/estadoOffline/BannerOffline';
import { iniciarSincronizacionOffline } from './servicios/sincronizacionOffline';
import { router } from './router'
import './index.css'

// Service worker de la PWA: permite instalar el panel y lo actualiza solo.
registerSW({ immediate: true })
// Reenvía las acciones que se hicieron sin conexión.
iniciarSincronizacionOffline()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BannerOffline />
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
)
