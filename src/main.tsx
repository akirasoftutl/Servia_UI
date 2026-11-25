import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { registerSW } from 'virtual:pwa-register'
import 'bootstrap/dist/css/bootstrap.min.css';
import 'sweetalert2/dist/sweetalert2.min.css';
import './estilos/panel.css';
import './estilos/alertas.css';
import { AuthProvider } from './contextos/AuthContext';
import { BannerOffline } from './componentes/estadoOffline/BannerOffline';
import * as alertas from './servicios/alertas';
import { iniciarActualizacionPwa } from './servicios/actualizacionPwa';
import { iniciarSincronizacionOffline } from './servicios/sincronizacionOffline';
import { router } from './router'
import './index.css'

// Service worker de la PWA: permite instalar el panel y avisa cuando hay versión nueva.
iniciarActualizacionPwa({ registerSW, alertas })
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
