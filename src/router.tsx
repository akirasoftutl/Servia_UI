import { ReportarProblema } from './paginas/soporte/ReportarProblema'
import { Preferencias } from './paginas/preferencias/Preferencias'
import { Avisos } from './paginas/avisos/Avisos'
import { Ayuda } from './paginas/ayuda/Ayuda'
import { createBrowserRouter, type RouteObject } from 'react-router'
import { Inicio } from './paginas/Inicio'
import { VistaPrevia } from './paginas/mi_perfil/VistaPrevia'
import { MiPerfil } from './paginas/mi_perfil/MiPerfil.tsx'
import { RutaProtegida } from './componentes/RutaProtegida'
import { RutaSoloVisitantes } from './componentes/RutaSoloVisitantes'
import { Login } from './paginas/login/Login'
import { RegistroNegocio } from './paginas/registro_negocio/RegistroNegocio'
import { Layout } from './componentes/layout/Layout.tsx'
import { NoEncontrado } from './paginas/noEncontrado/NoEncontrado'
import { NuevoServicio } from './paginas/servicios/NuevoServicio.tsx'
import { MisServicios } from './paginas/servicios/MisServicios.tsx'
import { Horario } from './paginas/horario/Horario.tsx'
import { DetalleReserva } from './paginas/reservas/DetalleReserva'
import { Bloqueos } from './paginas/bloqueos/Bloqueos.tsx'
import { Estadisticas } from './paginas/estadisticas/Estadisticas.tsx'
import { Reservas } from './paginas/reservas/Reservas.tsx'
import { Resumen } from './paginas/resumen/Resumen.tsx'

import { Clientes } from './paginas/clientes/Clientes'
import { DetalleCliente } from './paginas/clientes/DetalleCliente'

// Rutas del panel. Aquí se agregan las páginas de cada historia (registro, sesión, perfil…).
export const rutas: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Inicio /> },

      // Con sesión abierta no tiene sentido ver el login ni el registro: va al panel
      {
        element: <RutaSoloVisitantes />,
        children: [
          { path: 'registro-negocio', element: <RegistroNegocio /> },
          { path: 'login', element: <Login /> },
        ],
      },

      // RUTAS PROTEGIDAS: si no hay sesión, no entran aquí
      {
        element: <RutaProtegida />,
        children: [
          { path: 'soporte', element: <ReportarProblema /> },
          { path: 'ayuda', element: <Ayuda /> },
          { path: 'resumen', element: <Resumen /> },
          { path: 'avisos', element: <Avisos /> },
          { path: 'preferencias-notificaciones', element: <Preferencias /> },
          { path: 'mi-perfil', element: <MiPerfil /> },
          { path: 'mi-perfil/vista-previa', element: <VistaPrevia /> },
          { path: 'servicios', element: <MisServicios /> },
          { path: 'servicios/nuevo', element: <NuevoServicio /> },
          { path: 'servicios/:id', element: <NuevoServicio /> },
          { path: 'clientes', element: <Clientes /> },
          { path: 'clientes/:clienteUid', element: <DetalleCliente /> },
          { path: 'horario', element: <Horario /> },
          { path: 'bloqueos', element: <Bloqueos /> },
          { path: 'estadisticas', element: <Estadisticas /> },
          { path: 'reservas', element: <Reservas /> },
          { path: 'reservas/:id', element: <DetalleReserva /> }, 
        ],
      },

      { path: '*', element: <NoEncontrado /> },
    ],
  },
]

export const router = createBrowserRouter(rutas)
