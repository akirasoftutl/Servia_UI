import { createBrowserRouter, type RouteObject } from 'react-router'
import { Layout } from './componentes/Layout'
import { Inicio } from './paginas/Inicio'
import { RegistroNegocio } from './paginas/registro_negocio/RegistroNegocio'
import { NoEncontrado } from './paginas/NoEncontrado'
import { MiPerfil } from './paginas/MiPerfil'

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
