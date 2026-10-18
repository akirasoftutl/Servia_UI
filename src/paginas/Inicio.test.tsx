import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { rutas } from '../router'
import { AuthProvider } from '../contextos/AuthContext'

function mostrar(ruta: string) {
  // Envolvemos el RouterProvider en el AuthProvider para que useAuth funcione
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
    // Como el Layout ahora puede tardar un poco en verificar el auth, usamos findByRole
    expect(await screen.findByRole('heading', { name: 'Panel del negocio' })).toBeInTheDocument()
    expect(await screen.findByText(/API: conectada/)).toBeInTheDocument()
  })

  it('avisa si la API no responde', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    mostrar('/')
    expect(await screen.findByText(/API: sin conexión/)).toBeInTheDocument()
  })

  it('muestra la página de no encontrado en una ruta desconocida', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
    mostrar('/no-existe')
    expect(await screen.findByRole('heading', { name: 'No encontramos esta página' })).toBeInTheDocument()
  })
})