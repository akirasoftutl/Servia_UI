import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { rutas } from '../router'

function mostrar(ruta: string) {
  render(<RouterProvider router={createMemoryRouter(rutas, { initialEntries: [ruta] })} />)
}

describe('Inicio', () => {
  it('muestra el panel y que la API está conectada', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ estado: 'ok' }), { status: 200 }))
    mostrar('/')
    expect(screen.getByRole('heading', { name: 'Panel del negocio' })).toBeInTheDocument()
    expect(await screen.findByText(/API: conectada/)).toBeInTheDocument()
  })

  it('avisa si la API no responde', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    mostrar('/')
    expect(await screen.findByText(/API: sin conexión/)).toBeInTheDocument()
  })

  it('muestra la página de no encontrado en una ruta desconocida', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
    mostrar('/no-existe')
    expect(screen.getByRole('heading', { name: 'No encontramos esta página' })).toBeInTheDocument()
  })
})
