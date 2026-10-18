import { createBrowserRouter, type RouteObject } from 'react-router'
import { Layout } from './componentes/Layout'
import { Inicio } from './paginas/Inicio'
import { RegistroNegocio } from './paginas/RegistroNegocio'
import { NoEncontrado } from './paginas/NoEncontrado'
import { MiPerfil } from './paginas/MiPerfil'

// Rutas del panel. Aquí se agregan las páginas de cada historia (registro, sesión, perfil…).
export const rutas: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Inicio /> },
      { path: 'mi-perfil', element: <MiPerfil /> },
      { path: 'registro-negocio', element: <RegistroNegocio /> },
       { path: '*', element: <NoEncontrado /> },
    ],
  },
]

export const router = createBrowserRouter(rutas)
