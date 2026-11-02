import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { rutas } from '../router'
import { AuthProvider } from '../contextos/AuthContext'
import { vi } from 'vitest'

// Simulamos Firebase para que no falle en el CI
vi.mock('../servicios/firebase', () => ({
  auth: {
    onAuthStateChanged: vi.fn((callback) => {
      callback(null);
      return () => {};
    }),
    signOut: vi.fn(),
  },
  firebaseConfigurado: true,
}));

function mostrar(ruta: string) {
  render(
    <AuthProvider>
      <RouterProvider router={createMemoryRouter(rutas, { initialEntries: [ruta] })} />
    </AuthProvider>
  )
}

describe('Inicio', () => {
  it('muestra la página de inicio', async () => {
    mostrar('/')
    expect(
      await screen.findByRole('heading', { name: /Una plataforma, infinitas posibilidades/i })
    ).toBeInTheDocument()
  })

  it('muestra la página de no encontrado en una ruta desconocida', async () => {
    mostrar('/no-existe')
    expect(await screen.findByRole('heading', { name: 'No encontramos esta página' })).toBeInTheDocument()
  })
})
