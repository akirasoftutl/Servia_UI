import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { NoEncontrado } from './NoEncontrado';

function abrir(ruta = '/no-existe') {
  const router = createMemoryRouter([
    { path: '/', element: <h1>Inicio</h1> },
    { path: '*', element: <NoEncontrado /> },
  ], { initialEntries: [ruta] });
  const vista = render(<RouterProvider router={router} />);
  return { router, ...vista };
}

describe('NoEncontrado (404)', () => {
  it('usa el estilo del panel: página, ilustración y botón primario', () => {
    const { container } = abrir();
    expect(container.querySelector('.panel-pagina .panel-contenedor .panel-estado .panel-ilustracion')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No encontramos esta página' })).toHaveClass('panel-estado-titulo');
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveClass('btn-servia-primary');
  });

  it('el botón vuelve al inicio', () => {
    const { router } = abrir('/ruta/que/no/existe');
    screen.getByRole('link', { name: 'Volver al inicio' }).click();
    expect(router.state.location.pathname).toBe('/');
  });
});
