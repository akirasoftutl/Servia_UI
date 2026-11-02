import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { registerSW } from 'virtual:pwa-register'
import 'bootstrap/dist/css/bootstrap.min.css';
import { AuthProvider } from './contextos/AuthContext';
import { router } from './router'
import './index.css'

// Service worker de la PWA: permite instalar el panel y lo actualiza solo.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
)
