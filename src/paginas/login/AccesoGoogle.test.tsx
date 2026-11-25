import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { Login } from './Login'
import { RegistroNegocio } from '../registro_negocio/RegistroNegocio'

const iniciarSesionConGoogle = vi.hoisted(() => vi.fn())
vi.mock('../../contextos/AuthContext', () => ({
  useAuth: () => ({
    usuario: null,
    cargando: false,
    iniciarSesionConGoogle,
    leerBienvenidaGoogle: () => null,
    limpiarBienvenidaGoogle: () => {},
  }),
}))
vi.mock('../../servicios/firebase', () => ({ auth: {} }))
vi.mock('../../servicios/api', () => ({ api: vi.fn() }))

function Destino({ nombre }: { nombre: string }) {
  const { state } = useLocation()
  return <p>{`${nombre}|${(state as { aviso?: string } | null)?.aviso ?? ''}`}</p>
}

const pantallas = [
  { nombre: 'Login', ruta: '/login', pantalla: <Login /> },
  { nombre: 'Registro', ruta: '/registro-negocio', pantalla: <RegistroNegocio /> },
]

describe.each(pantallas)('Continuar con Google en $nombre', ({ ruta, pantalla }) => {
  function mostrar() {
    render(
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path={ruta} element={pantalla} />
          <Route path="/mi-perfil" element={<Destino nombre="perfil" />} />
          <Route path="/resumen" element={<Destino nombre="resumen" />} />
        </Routes>
      </MemoryRouter>,
    )
    return screen.getByRole('button', { name: 'Continuar con Google' })
  }

  beforeEach(() => iniciarSesionConGoogle.mockReset())

  it('cuenta nueva: va a /mi-perfil con el aviso para completar el perfil', async () => {
    iniciarSesionConGoogle.mockResolvedValue({ nuevaCuenta: true })
    await userEvent.click(mostrar())

    expect(await screen.findByText('perfil|Completa tu perfil para poder publicar servicios')).toBeVisible()
  })

  it('cuenta existente: va a /resumen', async () => {
    iniciarSesionConGoogle.mockResolvedValue({ nuevaCuenta: false })
    await userEvent.click(mostrar())

    expect(await screen.findByText('resumen|')).toBeVisible()
  })

  it('si no hay resultado (popup cerrado o error ya mostrado) se queda en la pantalla y rehabilita el botón', async () => {
    iniciarSesionConGoogle.mockResolvedValue(null)
    const boton = mostrar()
    await userEvent.click(boton)

    await waitFor(() => expect(boton).toBeEnabled())
    expect(iniciarSesionConGoogle).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/^(perfil|resumen)\|/)).not.toBeInTheDocument()
  })

  it('mientras corre, el botón queda deshabilitado y no admite un segundo clic', async () => {
    let terminar!: (valor: null) => void
    iniciarSesionConGoogle.mockReturnValue(new Promise((resolver) => { terminar = resolver }))
    const boton = mostrar()
    await userEvent.click(boton)

    expect(boton).toBeDisabled()
    expect(boton).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(boton)
    expect(iniciarSesionConGoogle).toHaveBeenCalledTimes(1)

    terminar(null)
    await waitFor(() => expect(boton).toBeEnabled())
  })
})
