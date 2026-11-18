import { render, screen, waitFor } from '@testing-library/react';
import { Reservas } from './Reservas';
import { MemoryRouter } from 'react-router'; 

vi.mock('../../servicios/firebase', () => ({
  auth: { currentUser: { getIdToken: async () => 'token-negocio-prueba' } },
}));

it('consulta las reservas del negocio mediante api con su token y sin identificadores ajenos (RN-46/T3)', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
    new Response(JSON.stringify(String(url).includes('/negocios/mio')
      ? { aceptaReservas: true }
      : { items: [], siguiente: null }))
  );
  render(
  <MemoryRouter>
    <Reservas />
  </MemoryRouter>
);
  await screen.findByText('No tienes reservas pendientes.');
  const llamadaReservas = await waitFor(() => {
    const llamada = fetchMock.mock.calls.find(([url]) => String(url).includes('/reservas/negocio'));
    expect(llamada).toBeDefined();
    return llamada!;
  });
  const [url, opciones] = llamadaReservas;
  expect(new URL(String(url)).pathname).toBe('/reservas/negocio');
  expect(new URL(String(url)).search).toBe('');
  expect((opciones!.headers as Headers).get('Authorization')).toBe('Bearer token-negocio-prueba');
});
