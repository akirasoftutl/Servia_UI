import { createBrowserRouter, type RouteObject } from 'react-router'
import { NuevoServicio } from './paginas/NuevoServicio.tsx'
import { MiPerfil } from './paginas/mi_perfil/MiPerfil.tsx'
import { RutaProtegida } from './componentes/RutaProtegida'
import { MisServicios } from './paginas/MisServicios'
// Páginas (Rutas exactas según tus carpetas actuales)
import { Login } from './paginas/login/Login'
import { RegistroNegocio } from './paginas/registro_negocio/RegistroNegocio'
import { Layout } from './componentes/layout/Layout.tsx'
import Home from './paginas/home/Home.tsx'
import { NoEncontrado } from './paginas/noEncontrado/NoEncontrado'

// Rutas del panel. Aquí se agregan las páginas de cada historia (registro, sesión, perfil…).
export const rutas: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      // --- RUTAS PÚBLICAS ---
      { index: true, element: <Home /> }, // <-- Usamos <Home />
      { path: 'login', element: <Login /> },
      { path: 'registro-negocio', element: <RegistroNegocio /> },
      
      // --- RUTAS PROTEGIDAS ---
      {
        element: <RutaProtegida />,
        children: [
          { path: 'mi-perfil', element: <MiPerfil /> },
          { path: 'servicios', element: <MisServicios /> },
          { path: 'servicios/nuevo', element: <NuevoServicio /> },
          { path: 'servicios/:id', element: <NuevoServicio /> }, 
        ]
      },

      // --- 404 ---
      { path: '*', element: <NoEncontrado /> },
    ],
  },
]

export const router = createBrowserRouter(rutas)