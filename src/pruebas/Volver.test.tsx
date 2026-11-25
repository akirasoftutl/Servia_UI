import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  createBrowserRouter, createMemoryRouter, Link, MemoryRouter,
  RouterProvider, useLocation, useNavigationType,
} from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Login } from '../paginas/login/Login'
import { RegistroNegocio } from '../paginas/registro_negocio/RegistroNegocio'

vi.mock('../contextos/AuthContext', () => ({
  useAuth: () => ({
    usuario: null,
    cargando: false,
    iniciarSesionConGoogle: vi.fn(),
    leerBienvenidaGoogle: () => null,
    limpiarBienvenidaGoogle: () => {},
  }),
}))
vi.mock('../servicios/firebase', () => ({ auth: {} }))
vi.mock('../servicios/api', () => ({ api: vi.fn() }))

const historialOriginal = { estado: window.history.state, ruta: window.location.href }
afterEach(() => window.history.replaceState(historialOriginal.estado, '', historialOriginal.ruta))

const pantallas = [
  { nombre: 'Inicia sesión', ruta: '/login' },
  { nombre: 'Regístrate', ruta: '/registro-negocio' },
]
const modos = ['MemoryRouter', 'createMemoryRouter', 'createBrowserRouter'] as const

describe.each(pantallas)('Volver en $nombre', ({ ruta }) => {
  function Recorrido() {
    const { pathname } = useLocation()
    const accion = useNavigationType()
    return <>
      <output aria-label="Acción de navegación">{accion}</output>
      <Link to="/anterior">Ir a la anterior</Link>
      <Link to={ruta}>Abrir formulario</Link>
      {pathname === '/' && <h1>Landing</h1>}
      {pathname === '/anterior' && <h1>Pantalla anterior</h1>}
      {pathname === '/login' && <Login />}
      {pathname === '/registro-negocio' && <RegistroNegocio />}
    </>
  }

  it.each(modos)('%s: entrada directa reemplaza por / y con historial regresa a la anterior', async (modo) => {
    const usuario = userEvent.setup()
    // Una recarga puede conservar una key distinta de default con idx=0.
    // En memoria no hay idx: debe funcionar también sin history.state.
    window.history.replaceState(
      modo === 'createBrowserRouter' ? { idx: 0, key: 'entrada-recargada' } : null,
      '', ruta,
    )
    const rutas = [{ path: '*', element: <Recorrido /> }]
    const crearRouter = () => modo === 'createBrowserRouter'
      ? createBrowserRouter(rutas)
      : createMemoryRouter(rutas, { initialEntries: [ruta] })
    const router = modo === 'MemoryRouter' ? null : crearRouter()
    let vista = render(router
      ? <RouterProvider router={router} />
      : <MemoryRouter initialEntries={[ruta]}><Recorrido /></MemoryRouter>)

    try {
      await usuario.click(screen.getByRole('button', { name: 'Volver' }))
      expect(await screen.findByRole('heading', { name: 'Landing' })).toBeVisible()
      expect(screen.getByLabelText('Acción de navegación')).toHaveTextContent('REPLACE')
      if (modo === 'createBrowserRouter') {
        expect(window.location.pathname).toBe('/')
        expect(window.history.state.idx).toBe(0)
      }

      await usuario.click(screen.getByRole('link', { name: 'Ir a la anterior' }))
      await usuario.click(screen.getByRole('link', { name: 'Abrir formulario' }))

      if (modo === 'createBrowserRouter') {
        // Recrear el router reproduce una recarga conservando el historial real.
        expect(window.history.state.idx).toBe(2)
        vista.unmount()
        router!.dispose()
        const recargado = crearRouter()
        vista = render(<RouterProvider router={recargado} />)
        try {
          await usuario.click(screen.getByRole('button', { name: 'Volver' }))
          await waitFor(() => expect(window.location.pathname).toBe('/anterior'))
          expect(await screen.findByRole('heading', { name: 'Pantalla anterior' })).toBeVisible()
          expect(screen.getByLabelText('Acción de navegación')).toHaveTextContent('POP')
        } finally {
          recargado.dispose()
        }
      } else {
        await usuario.click(screen.getByRole('button', { name: 'Volver' }))
        expect(await screen.findByRole('heading', { name: 'Pantalla anterior' })).toBeVisible()
        expect(screen.getByLabelText('Acción de navegación')).toHaveTextContent('POP')
      }
    } finally {
      vista.unmount()
      router?.dispose()
    }
  })
})
