import { createBrowserRouter, type RouteObject } from 'react-router'
import { Layout } from './componentes/Layout'
import { RegistroNegocio } from './paginas/RegistroNegocio';
import { MiPerfil } from './paginas/MiPerfil';
import { Inicio } from './paginas/Inicio'
import { NoEncontrado } from './paginas/NoEncontrado'
import { RutaProtegida } from './componentes/RutaProtegida';
import { Login } from './paginas/Login';

// Rutas del panel. Aquí se agregan las páginas de cada historia (registro, sesión, perfil…).
export const rutas: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Inicio /> },
      { path: 'registro-negocio', element: <RegistroNegocio /> },
      { path: 'login', element: <Login /> }, 
      
      // RUTAS PROTEGIDAS: Si no hay sesión, no entran aquí
      {
        element: <RutaProtegida />,
        children: [
          { path: 'mi-perfil', element: <MiPerfil /> },
          // Aquí irán las demás (servicios, reservas, etc.)
        ]
      },

      { path: '*', element: <NoEncontrado /> },
    ],
  },
]
export const router = createBrowserRouter(rutas);