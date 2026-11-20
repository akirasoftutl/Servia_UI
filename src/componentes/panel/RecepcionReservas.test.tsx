import { readFileSync } from 'node:fs';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { signOut } from 'firebase/auth';
import { auth } from '../../servicios/firebase';
import { api, ErrorApi } from '../../servicios/api';
import { MiPerfil } from '../../paginas/mi_perfil/MiPerfil';
import { Reservas } from '../../paginas/reservas/Reservas';

vi.mock('../../servicios/api', async (original) => ({
  ...await original<typeof import('../../servicios/api')>(), api: vi.fn(),
}));
vi.mock('../../servicios/firebase', () => ({ auth: { currentUser: null } }));
vi.mock('firebase/auth', async (original) => ({ ...await original<typeof import('firebase/auth')>(), signOut: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../contextos/AuthContext', () => ({ useAuth: () => ({ usuario: null }) }));

const llamada = vi.mocked(api);
let recibe = true;
let fallo: Error | null = null;
let carga: Error | null = null;
let enviar: (() => Promise<unknown>) | null = null;
const cambios = () => llamada.mock.calls.filter(([, opciones]) => opciones?.method === 'PATCH');

beforeEach(() => {
  vi.mocked(signOut).mockClear();
  recibe = true; fallo = null; carga = null; enviar = null;
  llamada.mockReset();
  llamada.mockImplementation(async (ruta, opciones) => {
    if (opciones?.method === 'PATCH') {
      if (fallo) throw fallo;
      if (enviar) await enviar();
      recibe = JSON.parse(String(opciones.body)).aceptaReservas;
      return {};
    }
    if (ruta === '/negocios/mio') {
      if (carga) throw carga;
      return { nombre: 'Barbería Norte', aceptaReservas: recibe, camposFaltantes: [] };
    }
    if (ruta === '/categorias') return [];
    return { items: [], siguiente: null };
  });
});

function mostrar(Pagina: typeof MiPerfil) {
  return render(<MemoryRouter initialEntries={['/panel']}><Routes>
    <Route path="/panel" element={<Pagina />} />
    <Route path="/login" element={<h1>Inicia sesión</h1>} />
  </Routes></MemoryRouter>);
}

describe.each([['Mi perfil', MiPerfil], ['Reservas', Reservas]] as const)('%s: recepción compartida #101', (_nombre, Pagina) => {
  it.each([true, false])('C1-C3/C5 pausa o reanuda (%s) solo tras confirmar, sin alterar otros campos', async (inicial) => {
    recibe = inicial;
    mostrar(Pagina);
    const control = await screen.findByRole('switch');
    await waitFor(() => expect(control).toBeEnabled());
    expect(control).toHaveAttribute('aria-checked', String(inicial));
    await userEvent.click(control);
    const modal = screen.getByRole('dialog');
    expect(modal).toHaveAccessibleName(inicial ? '¿Pausar las reservas?' : '¿Reanudar las reservas?');
    expect(modal).toHaveAccessibleDescription(/Tu perfil seguirá visible.*Las reservas que ya tienes no cambiarán/);
    expect(cambios()).toHaveLength(0);
    await userEvent.click(within(modal).getByRole('button', { name: 'Cancelar' }));
    expect(cambios()).toHaveLength(0);
    expect(control).toHaveAttribute('aria-checked', String(inicial));
    await userEvent.click(control);
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: inicial ? 'Pausar' : 'Reanudar' }));
    await waitFor(() => expect(control).toHaveAttribute('aria-checked', String(!inicial)));
    expect(cambios()).toEqual([['/negocios/mio/recepcion-reservas', { method: 'PATCH', body: JSON.stringify({ aceptaReservas: !inicial }) }]]);
    expect(screen.getByRole('status')).toHaveTextContent(inicial ? 'Reservas pausadas.' : 'Reservas reanudadas.');
  });

  it.each([new ErrorApi(409, 'Conflict'), new TypeError('Failed to fetch')])('C4 error %s en español, sin alert y conserva estado', async (error) => {
    fallo = error;
    const alerta = vi.spyOn(window, 'alert').mockImplementation(() => {});
    mostrar(Pagina);
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
    await userEvent.click(screen.getByRole('switch'));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Pausar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cambiar la recepción de reservas. Intenta de nuevo.');
    expect(screen.getByRole('switch', { hidden: true })).toHaveAttribute('aria-checked', 'true');
    expect(alerta).not.toHaveBeenCalled();
    alerta.mockRestore();
  });

  it.each(['GET', 'PATCH'])('C4 un 401 en %s vuelve a iniciar sesión', async (metodo) => {
    if (metodo === 'GET') carga = new ErrorApi(401, 'Unauthorized');
    else fallo = new ErrorApi(401, 'Unauthorized');
    mostrar(Pagina);
    if (metodo === 'PATCH') {
      await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
      await userEvent.click(screen.getByRole('switch'));
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Pausar' }));
    }
    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeVisible();
    expect(signOut).toHaveBeenCalledExactlyOnceWith(auth);
  });

  it('C3 bloquea el envío duplicado al reanudar', async () => {
    recibe = false;
    let resolver!: () => void;
    enviar = () => new Promise<void>((resolve) => { resolver = resolve; });
    mostrar(Pagina);
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
    await userEvent.click(screen.getByRole('switch'));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reanudar' }));
    expect(screen.getByRole('button', { name: 'Reanudando...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(cambios()).toHaveLength(1);
    await act(async () => resolver());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

it('C1-C2 conserva el estado al pasar de Mi perfil a Reservas', async () => {
  const vista = mostrar(MiPerfil);
  await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
  await userEvent.click(screen.getByRole('switch'));
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Pausar' }));
  await screen.findByText('Reservas pausadas.');
  vista.unmount();
  mostrar(Reservas);
  await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
});

it('C2/C5/C6/C7 mantiene una sola implementación y solo estilos compartidos', () => {
  const fuente = (ruta: string) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
  for (const pagina of ['../../paginas/mi_perfil/MiPerfil.tsx', '../../paginas/reservas/Reservas.tsx']) {
    const codigo = fuente(pagina);
    expect(codigo).toContain('<RecepcionReservas />');
    expect(codigo).not.toContain('/recepcion-reservas\'');
  }
  const componente = fuente('./RecepcionReservas.tsx');
  expect(componente).not.toMatch(/\b(?:visible|activo)\s*:|alert\(|style=|\d+(?:px|rem)\b|\.css['"](?!;)/);
  const clases = [...componente.matchAll(/className="([^"]+)"/g)].flatMap((m) => m[1].split(' '));
  expect(clases.every((clase) => /^(panel-|btn-servia-)/.test(clase))).toBe(true);
  expect(fuente('../sidebar/Sidebar.tsx')).toContain("ruta: '/mi-perfil#recepcion-reservas'");
});
