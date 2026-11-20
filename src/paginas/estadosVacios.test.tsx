import { readFileSync } from 'node:fs';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { api } from '../servicios/api';
import { Reservas } from './reservas/Reservas';
import { Clientes } from './clientes/Clientes';
import { Bloqueos } from './bloqueos/Bloqueos';

// Bloque 4 de «Diseño del panel»: los estados vacíos comparten ilustración y estructura,
// y los glifos Unicode sueltos se cambiaron por íconos de lucide-react.
vi.mock('../servicios/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../servicios/api')>();
  return { ...actual, api: vi.fn() };
});
const apiMock = vi.mocked(api);

function esVacioCompartido(parrafo: HTMLElement, titulo: string) {
  const estado = parrafo.closest('.panel-estado')!;
  expect(estado.querySelector('.panel-ilustracion svg')).toBeInTheDocument();
  expect(estado.querySelector('.panel-estado-titulo')).toHaveTextContent(titulo);
  expect(estado.querySelector('.panel-estado-icono')).toBeNull();
  return estado;
}

describe('estados vacíos compartidos', () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockImplementation(async (ruta) => {
      if (String(ruta).startsWith('/reservas/negocio')) return { items: [], siguiente: null };
      if (String(ruta).startsWith('/negocios/mio/clientes')) return { items: [], siguiente: null };
      if (ruta === '/negocios/mio/bloqueos') return [];
      if (ruta === '/negocios/mio') return { aceptaReservas: true, visible: true };
      return {};
    });
  });

  it('Reservas: ilustración, título y botón al siguiente paso', async () => {
    render(<MemoryRouter><Reservas /></MemoryRouter>);
    const estado = esVacioCompartido(await screen.findByText('No tienes reservas pendientes.'), 'Sin solicitudes por ahora');
    expect(estado.querySelector('a.btn-servia-secondary')).toHaveAttribute('href', '/mi-perfil/vista-previa');
  });

  it('Clientes: ilustración y título, sin botón (los clientes llegan por reservas)', async () => {
    render(<MemoryRouter><Clientes /></MemoryRouter>);
    const estado = esVacioCompartido(await screen.findByText('Todavía no tienes clientes.'), 'Aún no hay clientes');
    expect(estado.querySelector('.panel-estado-acciones')).toBeNull();
  });

  it('Bloqueos: ilustración y título', async () => {
    render(<Bloqueos />);
    await waitFor(() => expect(screen.queryByText('Cargando...')).not.toBeInTheDocument());
    esVacioCompartido(screen.getByText('No tienes bloqueos.'), 'Tu agenda no tiene bloqueos');
  });

  it('Reservas con una pendiente muestra el contador con ícono svg, no con ⏱', async () => {
    apiMock.mockImplementation(async (ruta) => {
      if (String(ruta).startsWith('/reservas/negocio')) {
        return { items: [{ id: 'a', folio: 'SRV-1', cliente: { nombre: 'Ana', telefono: null },
          servicio: { id: 's', nombre: 'Corte', precio: 100, duracionMin: 60 },
          inicio: '2030-11-04T02:00:00Z', fin: '2030-11-04T03:00:00Z', estado: 'pendiente',
          venceEn: new Date(Date.now() + 61000).toISOString(), segundosRestantes: 61 }], siguiente: null };
      }
      return ruta === '/negocios/mio' ? { aceptaReservas: true, visible: true } : {};
    });
    const { container } = render(<MemoryRouter><Reservas /></MemoryRouter>);
    await act(async () => { await Promise.resolve(); });
    await waitFor(() => expect(container.querySelector('.reserva-tiempo svg')).toBeInTheDocument());
    expect(container.querySelector('.reserva-tiempo')!.textContent).not.toContain('⏱');
  });
});

describe('sin glifos Unicode como ícono en los archivos tocados', () => {
  const archivos = [
    'componentes/panel/RecepcionReservas.tsx', 'paginas/resumen/Resumen.tsx', 'paginas/reservas/Reservas.tsx',
    'paginas/clientes/EstadoClientes.tsx', 'paginas/bloqueos/Bloqueos.tsx', 'paginas/estadisticas/Estadisticas.tsx',
    'paginas/mi_perfil/VistaPrevia.tsx', 'paginas/mi_perfil/MiPerfil.tsx', 'paginas/mi_perfil/CambiarContrasena.tsx',
    'paginas/ayuda/Ayuda.tsx', 'paginas/noEncontrado/NoEncontrado.tsx',
  ];
  it.each(archivos)('%s', (archivo) => {
    const fuente = readFileSync(`src/${archivo}`, 'utf8');
    expect(fuente).not.toMatch(/[⏸⏱✓✔✦]|'[+−]'/);
  });

  it('Estadisticas.tsx no menciona claves internas MVP-xx', () => {
    expect(readFileSync('src/paginas/estadisticas/Estadisticas.tsx', 'utf8')).not.toMatch(/MVP-\d+/);
  });
});
