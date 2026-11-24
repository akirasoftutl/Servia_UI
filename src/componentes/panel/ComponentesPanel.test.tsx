import { readFileSync } from 'node:fs';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { CalendarCheck, CheckCircle2, Clock } from 'lucide-react';
import { EncabezadoPanel } from './EncabezadoPanel';
import { TarjetaPanel } from './TarjetaPanel';
import { BotonPanel } from './BotonPanel';
import { EtiquetaEstado } from './EtiquetaEstado';
import { EstadoCargando, EstadoError } from './EstadosPanel';

describe('componentes compartidos del panel (unificación con app móvil)', () => {
  it('EncabezadoPanel renderiza miga, título, subtítulo y acciones', () => {
    render(
      <EncabezadoPanel
        grupo="operacion"
        icono={CalendarCheck}
        titulo="Reservas"
        subtitulo="Administra tus citas."
        acciones={<button type="button">Acción</button>}
      />,
    );
    expect(screen.getByText('Operación diaria')).toHaveClass('panel-eyebrow');
    expect(screen.getByRole('heading', { name: 'Reservas', level: 1 })).toHaveClass('panel-titulo');
    expect(screen.getByText('Administra tus citas.')).toHaveClass('panel-subtitulo');
    expect(screen.getByRole('button', { name: 'Acción' }).parentElement).toHaveClass('panel-encabezado-acciones');
  });

  it('TarjetaPanel renderiza sección con título, subtítulo y slot derecho', () => {
    render(
      <TarjetaPanel titulo="Catálogo" tituloId="cat-titulo" subtitulo="Servicios activos" derecha={<span>3</span>}>
        <p>Contenido</p>
      </TarjetaPanel>,
    );
    expect(screen.getByRole('region', { name: 'Catálogo' })).toHaveClass('panel-tarjeta');
    expect(screen.getByRole('heading', { name: 'Catálogo', level: 2 })).toHaveClass('panel-tarjeta-titulo');
    expect(screen.getByText('Servicios activos')).toHaveClass('panel-tarjeta-subtitulo');
    expect(screen.getByText('Contenido')).toBeInTheDocument();
  });

  it('BotonPanel aplica variantes, tamaño y soporta enlace con react-router', async () => {
    const alClick = vi.fn();
    render(
      <MemoryRouter>
        <BotonPanel variante="primario" onClick={alClick}>Guardar</BotonPanel>
        <BotonPanel variante="peligro" tamano="sm" bloque>Eliminar</BotonPanel>
        <BotonPanel variante="secundario" to="/reservas">Ver reservas</BotonPanel>
      </MemoryRouter>,
    );
    const primario = screen.getByRole('button', { name: 'Guardar' });
    expect(primario).toHaveClass('btn-servia-primary');
    await userEvent.click(primario);
    expect(alClick).toHaveBeenCalledTimes(1);

    const peligro = screen.getByRole('button', { name: 'Eliminar' });
    expect(peligro).toHaveClass('btn-servia-danger', 'btn-servia-sm', 'btn-servia-bloque');

    const enlace = screen.getByRole('link', { name: 'Ver reservas' });
    expect(enlace).toHaveClass('btn-servia-secondary');
    expect(enlace).toHaveAttribute('href', '/reservas');

    const referencia = createRef<HTMLButtonElement>();
    render(<BotonPanel ref={referencia} variante="secundario">Enfocar</BotonPanel>);
    expect(referencia.current).toBe(screen.getByRole('button', { name: 'Enfocar' }));
  });

  it('EtiquetaEstado aplica el tono semántico y su ícono decorativo', () => {
    const { container } = render(<EtiquetaEstado texto="Confirmada" tono="exito" icono={CheckCircle2} />);
    const etiqueta = screen.getByText('Confirmada');
    expect(etiqueta).toHaveClass('panel-etiqueta', 'panel-etiqueta--exito');
    expect(container.querySelector('.panel-etiqueta svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('EstadoCargando y EstadoError exponen roles accesibles y permiten reintentar', async () => {
    const reintentar = vi.fn();
    const { rerender } = render(<EstadoCargando mensaje="Cargando citas..." />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando citas...');

    rerender(<EstadoError titulo="Algo salió mal" mensaje="Sin conexión" onReintentar={reintentar} icono={Clock} />);
    expect(screen.getByRole('heading', { name: 'Algo salió mal', level: 3 })).toHaveClass('panel-estado-titulo');
    expect(screen.getByRole('alert')).toHaveTextContent('Sin conexión');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(reintentar).toHaveBeenCalledTimes(1);
  });

  it('panel.css y Sidebar.css definen la paleta morada con neutros fríos, tipografía Plus Jakarta Sans y barra lateral oscura', () => {
    const panelCss = readFileSync('src/estilos/panel.css', 'utf8');
    expect(panelCss.match(/--sv-marca:\s*#[0-9a-f]{6}/gi)).toEqual(['--sv-marca: #7c3aed']);
    expect(panelCss.match(/--sv-primario:\s*#[0-9a-f]{6}/gi)).toEqual(['--sv-primario: #7c3aed']);
    expect(panelCss.match(/--sv-primario-suave:\s*#[0-9a-f]{6}/gi)).toEqual(['--sv-primario-suave: #f3e8ff']);
    expect(panelCss.match(/--sv-en-primario-suave:\s*#[0-9a-f]{6}/gi)).toEqual(['--sv-en-primario-suave: #5b21b6']);
    expect(panelCss.match(/--sv-fondo:\s*#[0-9a-f]{6}/gi)).toEqual(['--sv-fondo: #f9fafb']);
    expect(panelCss.match(/--sv-superficie-hundida:\s*#[0-9a-f]{6}/gi)).toEqual(['--sv-superficie-hundida: #f3f4f6']);
    expect(panelCss.match(/--sv-borde:\s*#[0-9a-f]{6}/gi)).toEqual(['--sv-borde: #e5e7eb']);
    expect(panelCss.match(/--sv-borde-fuerte:\s*#[0-9a-f]{6}/gi)).toEqual(['--sv-borde-fuerte: #d1d5db']);
    expect(panelCss.match(/--sv-borde-campo:\s*#[0-9a-f]{6}/gi)).toEqual(['--sv-borde-campo: #848d9a']);
    expect(panelCss.match(/--sv-titulo:\s*#[0-9a-f]{6}/gi)).toEqual(['--sv-titulo: #111827']);
    expect(panelCss.match(/--sv-texto-suave:\s*#[0-9a-f]{6}/gi)).toEqual(['--sv-texto-suave: #6b7280']);
    expect(panelCss).toMatch(/--sv-fuente:\s*'Plus Jakarta Sans'/);

    const sidebarCss = readFileSync('src/componentes/sidebar/Sidebar.css', 'utf8');
    expect(sidebarCss).toMatch(/--bg-sidebar:\s*#0f0f12/i);
    expect(sidebarCss).toMatch(/--text-main:\s*#ffffff/i);
    expect(sidebarCss).toMatch(/--active-border:\s*#a855f7/i);
    expect(sidebarCss).toMatch(/--active-bg:\s*rgba\(168,\s*85,\s*247,\s*0\.15\)/);
    expect(sidebarCss).toMatch(/--active-text:\s*#e9d5ff/i);
    expect(sidebarCss).not.toMatch(/\.brand-title::before/);
  });

  it('--sv-foco usa color sólido (contraste ≥ 3:1) y los elementos interactivos aplican foco visible', () => {
    const panelCss = readFileSync('src/estilos/panel.css', 'utf8');
    expect(panelCss).toMatch(/--sv-foco:\s*0 0 0 2px #ffffff,\s*0 0 0 4px var\(--sv-primario\)/);

    const resumenCss = readFileSync('src/paginas/resumen/Resumen.css', 'utf8');
    expect(resumenCss).toMatch(/\.resumen-kpi-card--enlace:focus-visible\s*\{[^}]*box-shadow:\s*var\(--sv-foco\)/);
    expect(resumenCss).toMatch(/\.resumen-acceso:focus-visible\s*\{[^}]*box-shadow:\s*var\(--sv-foco\)/);

    const reservasCss = readFileSync('src/paginas/reservas/Reservas.css', 'utf8');
    expect(reservasCss).toMatch(/\.reserva-card:focus-visible\s*\{[^}]*box-shadow:\s*var\(--sv-foco\)/);

    const sidebarCss = readFileSync('src/componentes/sidebar/Sidebar.css', 'utf8');
    expect(sidebarCss).toMatch(/\.dropdown-item:focus-visible\s*\{[^}]*box-shadow:\s*var\(--sv-foco\)/);
  });
});
