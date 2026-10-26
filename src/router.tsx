import { createBrowserRouter, type RouteObject } from 'react-router'
import { Layout } from './componentes/layout/Layout'
import { RutaProtegida } from './componentes/RutaProtegida'

// Páginas (Rutas exactas según tus carpetas actuales)
import Home from './paginas/home/Home' // <-- Es Home, no Inicio
import { NoEncontrado } from './paginas/noEncontrado/NoEncontrado'
import { Login } from './paginas/login/Login'
import { RegistroNegocio } from './paginas/registro_negocio/RegistroNegocio'
import { MiPerfil } from './paginas/MiPerfil'
import { NuevoServicio } from './paginas/NuevoServicio'
import { MisServicios } from './paginas/MisServicios'

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