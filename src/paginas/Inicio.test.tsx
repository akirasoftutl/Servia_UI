import { render, screen, waitFor } from '@testing-library/react' // <-- Agregamos waitFor
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
}));

function mostrar(ruta: string) {
  render(
    <AuthProvider>
      <RouterProvider router={createMemoryRouter(rutas, { initialEntries: [ruta] })} />
    </AuthProvider>
  )
}

describe('Inicio', () => {
  it('muestra el panel y que la API está conectada', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ estado: 'ok' }), { status: 200 }))
    mostrar('/')
    expect(await screen.findByRole('heading', { name: 'Panel del negocio' })).toBeInTheDocument()
    expect(await screen.findByText(/API: conectada/)).toBeInTheDocument()
  })

  it('avisa si la API no responde', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    mostrar('/')
    
    // Usamos waitFor para darle tiempo al componente de procesar el error
    await waitFor(() => {
      expect(screen.getByText(/API: sin conexión/)).toBeInTheDocument()
    }, { timeout: 3000 }) // Le damos 3 segundos de margen
  })

  it('muestra la página de no encontrado en una ruta desconocida', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
    mostrar('/no-existe')
    expect(await screen.findByRole('heading', { name: 'No encontramos esta página' })).toBeInTheDocument()
  })
})