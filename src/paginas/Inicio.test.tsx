import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { rutas } from '../router'
import { AuthProvider } from '../contextos/AuthContext'
import { vi } from 'vitest'

// 1. Simulamos Firebase para que no falle
vi.mock('../servicios/firebase', () => ({
  auth: {
    onAuthStateChanged: vi.fn((callback) => {
      callback(null);
      return () => {};
    }),
    signOut: vi.fn().mockResolvedValue(undefined), 
  },
  firebaseConfigurado: true,
}));

// 2. Simulamos la API para que no haga peticiones reales
vi.mock('../servicios/api', () => ({
  api: vi.fn().mockResolvedValue({ estado: 'ok' }),
  ErrorApi: class extends Error {},
}));

function mostrar(ruta: string) {
  render(
    <AuthProvider>
      <RouterProvider router={createMemoryRouter(rutas, { initialEntries: [ruta] })} />
    </AuthProvider>
  )
}

describe('Inicio', () => {
  it('renderiza la pagina principal sin errores', async () => {
    mostrar('/')
    // En lugar de buscar un texto exacto, buscamos que el logo de "Servia" exista.
    // Usamos findAllByText porque puede aparecer en el navbar, en el footer, etc.
    const logos = await screen.findAllByText(/Servia/i);
    expect(logos.length).toBeGreaterThan(0);
  })

  it('muestra la página de no encontrado en una ruta desconocida', async () => {
    mostrar('/no-existe')
    expect(await screen.findByRole('heading', { name: 'No encontramos esta página' })).toBeInTheDocument()
  })
})