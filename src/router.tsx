import { createBrowserRouter, type RouteObject } from 'react-router'
import { Layout } from './componentes/layout/Layout.tsx'
import  Home  from './paginas/home/Home.tsx'
import { NoEncontrado } from './paginas/noEncontrado/NoEncontrado'

// Rutas del panel. Aquí se agregan las páginas de cada historia (registro, sesión, perfil…).
export const rutas: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: '*', element: <NoEncontrado /> },
    ],
  },
]

export const router = createBrowserRouter(rutas)
