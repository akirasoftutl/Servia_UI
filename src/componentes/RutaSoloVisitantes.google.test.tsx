import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { RutaSoloVisitantes } from './RutaSoloVisitantes'

const sesion = vi.hoisted(() => ({
  bienvenida: null as null | { nuevaCuenta: boolean },
  limpiar: vi.fn(),
}))
vi.mock('../contextos/AuthContext', () => ({
  useAuth: () => ({
    usuario: { uid: 'g-1' },
    cargando: false,
    leerBienvenidaGoogle: () => sesion.bienvenida,
    limpiarBienvenidaGoogle: sesion.limpiar,
  }),
}))

function Destino({ nombre }: { nombre: string }) {
  const { state } = useLocation()
  return <p>{`${nombre}|${(state as { aviso?: string } | null)?.aviso ?? ''}`}</p>
}

function mostrar() {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route element={<RutaSoloVisitantes />}>
          <Route path="/login" element={<p>formulario</p>} />
        </Route>
        <Route path="/mi-perfil" element={<Destino nombre="perfil" />} />
        <Route path="/resumen" element={<Destino nombre="resumen" />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RutaSoloVisitantes tras volver de Google por redirección', () => {
  it('una cuenta nueva va a /mi-perfil con el aviso y se consume el destino', async () => {
    sesion.bienvenida = { nuevaCuenta: true }
    sesion.limpiar.mockReset()
    mostrar()

    expect(await screen.findByText('perfil|Completa tu perfil para poder publicar servicios')).toBeVisible()
    expect(sesion.limpiar).toHaveBeenCalled()
  })

  it('una cuenta existente (o sin destino pendiente) va a /resumen', async () => {
    sesion.bienvenida = null
    mostrar()

    expect(await screen.findByText('resumen|')).toBeVisible()
  })
})
