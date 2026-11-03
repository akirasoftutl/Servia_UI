import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Sidebar } from './Sidebar';

vi.mock('../../contextos/AuthContext', () => ({ useAuth: () => ({ cerrarSesion: vi.fn() }) }));
it('abre Reservas desde el menú lateral', async () => {
  const router = createMemoryRouter([
    { path: '/', element: <Sidebar /> },
    { path: '/reservas', element: <h1>Panel de reservas</h1> },
  ]);
  render(<RouterProvider router={router} />);
  fireEvent.click(screen.getByRole('button', { name: 'Reservas' }));
  expect(await screen.findByRole('heading', { name: 'Panel de reservas' })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/reservas');
});
