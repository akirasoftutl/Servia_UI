import { createBrowserRouter, type RouteObject } from 'react-router'
import { MiPerfil } from './paginas/MiPerfil'
import { RutaProtegida } from './componentes/RutaProtegida'
import { Login } from './paginas/login/Login'
import { Layout } from './componentes/layout/Layout.tsx'
import  Home  from './paginas/home/Home.tsx'
import { NoEncontrado } from './paginas/noEncontrado/NoEncontrado'

export const rutas: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'login', element: <Login /> },

      {
        element: <RutaProtegida />,
        children: [
          { path: 'mi-perfil', element: <MiPerfil /> },
        ],
      },

      { path: '*', element: <NoEncontrado /> },
    ],
  },
]
export const router = createBrowserRouter(rutas);
