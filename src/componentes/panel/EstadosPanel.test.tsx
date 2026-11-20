import { render, screen } from '@testing-library/react';
import { Tags } from 'lucide-react';
import { EstadoVacio } from './EstadosPanel';

describe('EstadoVacio', () => {
  it('muestra ilustración, título, texto y la acción que le pasan', () => {
    const { container } = render(
      <EstadoVacio icono={Tags} titulo="Sin nada" texto="Aún no hay nada." accion={<button className="btn-servia-primary">Crear</button>} />,
    );
    expect(container.querySelector('.panel-estado > .panel-ilustracion svg')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sin nada', level: 3 })).toHaveClass('panel-estado-titulo');
    expect(screen.getByText('Aún no hay nada.')).toHaveClass('panel-estado-texto');
    expect(screen.getByRole('button', { name: 'Crear' }).parentElement).toHaveClass('panel-estado-acciones');
  });

  it('sin acción no deja un contenedor de botones vacío ni usa el glifo viejo', () => {
    const { container } = render(<EstadoVacio icono={Tags} titulo="Sin nada" texto="Aún no hay nada." />);
    expect(container.querySelector('.panel-estado-acciones')).toBeNull();
    expect(container.querySelector('.panel-estado-icono')).toBeNull();
    expect(container.textContent).not.toContain('✦');
  });
});
