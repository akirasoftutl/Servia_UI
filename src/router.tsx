import { createBrowserRouter, type RouteObject } from 'react-router'
import { MiPerfil } from './paginas/mi_perfil/MiPerfil.tsx'
import { RutaProtegida } from './componentes/RutaProtegida'
import { Login } from './paginas/login/Login'
import { RegistroNegocio } from './paginas/registro_negocio/RegistroNegocio'
import { Layout } from './componentes/layout/Layout.tsx'
import Home from './paginas/home/Home.tsx'
import { NoEncontrado } from './paginas/noEncontrado/NoEncontrado'
import { NuevoServicio } from './paginas/servicios/NuevoServicio.tsx'
import { MisServicios } from './paginas/servicios/MisServicios.tsx'

// Rutas del panel. Aquí se agregan las páginas de cada historia (registro, sesión, perfil…).
export const rutas: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'registro-negocio', element: <RegistroNegocio /> },
      { path: 'login', element: <Login /> },

      {
        element: <RutaProtegida />,
        children: [
          { path: 'mi-perfil', element: <MiPerfil /> },
          { path: 'servicios', element: <MisServicios /> },
          { path: 'servicios/nuevo', element: <NuevoServicio /> },
        ],
      },

      { path: '*', element: <NoEncontrado /> },
    ],
  },
]
export const router = createBrowserRouter(rutas);
