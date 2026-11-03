import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { Login } from './Login'

vi.mock('../../servicios/firebase', () => ({ auth: {} }))
vi.mock('../../servicios/api', () => ({ api: vi.fn() }))

describe('Login: pie del formulario', () => {
  it('invita a registrarse con un enlace a /registro-negocio y sin la leyenda de acceso exclusivo', () => {
    render(<MemoryRouter initialEntries={['/login']}><Login /></MemoryRouter>)

    expect(screen.getByText(/¿No tienes cuenta\?/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Regístrate aquí' })).toHaveAttribute('href', '/registro-negocio')
    expect(screen.queryByText(/Acceso exclusivo/)).not.toBeInTheDocument()
  })
})
