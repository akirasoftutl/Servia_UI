import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes } from 'react-router'
import { NotificacionesContext, type NotificacionesContextValue } from '../../contextos/notificacionesContexto'
import { readFileSync } from 'node:fs'
import { Sidebar } from './Sidebar'

const sesion = vi.hoisted(() => ({ usuario: { uid: 'ana', email: 'ana@ejemplo.com' } }))
vi.mock('../../contextos/AuthContext', () => ({ useAuth: () => ({ ...sesion, cerrarSesion: vi.fn() }) }))
vi.mock('../../servicios/api', () => ({ api: vi.fn() }))
import { api } from '../../servicios/api'
const apiMock = vi.mocked(api)
beforeEach(() => {
  sesion.usuario = { uid: 'ana', email: 'ana@ejemplo.com' }
  apiMock.mockReset().mockResolvedValue({ nombre: 'Estética Ana' })
})
const barra = () => <MemoryRouter><Sidebar /></MemoryRouter>

it('C1 muestra nombre, correo e inicial de la sesión', async () => {
  render(barra())
  expect(await screen.findByText('Estética Ana')).toBeInTheDocument()
  expect(screen.getByText('ana@ejemplo.com')).toBeInTheDocument()
  expect(document.querySelector('.avatar')).toHaveTextContent('E')
  expect(screen.queryByText('Urielees')).not.toBeInTheDocument()
  expect(apiMock).toHaveBeenCalledWith('/negocios/mio')
})
it('C2 respalda con el correo durante la carga y ante falla', async () => {
  let rechazar!: (error: Error) => void
  apiMock.mockImplementation(() => new Promise((_, reject) => { rechazar = reject }))
  render(barra())
  expect(document.querySelector('.user-name')).toHaveTextContent('ana@ejemplo.com')
  await act(async () => rechazar(new Error('Sin conexión')))
  expect(document.querySelector('.user-name')).toHaveTextContent('ana@ejemplo.com')
  expect(screen.queryByText('Sin conexión')).not.toBeInTheDocument()
})
it('C3 descarta el nombre previo y respuestas tardías al cambiar de cuenta', async () => {
  const vista = render(barra())
  await screen.findByText('Estética Ana')
  let resolver!: (valor: unknown) => void
  apiMock.mockImplementationOnce(() => new Promise(resolve => { resolver = resolve }))
  sesion.usuario = { uid: 'bea', email: 'bea@ejemplo.com' }
  vista.rerender(barra())
  expect(screen.queryByText('Estética Ana')).not.toBeInTheDocument()
  expect(document.querySelector('.user-name')).toHaveTextContent('bea@ejemplo.com')
  sesion.usuario = { uid: 'carla', email: 'carla@ejemplo.com' }
  apiMock.mockResolvedValue({ nombre: 'Salón Carla' })
  vista.rerender(barra())
  await screen.findByText('Salón Carla')
  await act(async () => resolver({ nombre: 'Salón Bea' }))
  expect(screen.queryByText('Salón Bea')).not.toBeInTheDocument()
  expect(screen.getByText('Salón Carla')).toBeInTheDocument()
})

it('B18 navega a Bloqueos desde Operaciones', async () => {
  render(<MemoryRouter initialEntries={['/']}><Sidebar /><Routes><Route path="/bloqueos" element={<p>Página de bloqueos</p>} /></Routes></MemoryRouter>)
  const enlace = screen.getByRole('button', { name: 'Bloqueos' })
  expect(enlace.closest('.nav-group')).toHaveTextContent('OPERACIONES')
  await userEvent.click(enlace)
  expect(await screen.findByText('Página de bloqueos')).toBeInTheDocument()
})

it('abre Reservas desde el menú lateral', async () => {
  const router = createMemoryRouter([
    { path: '/', element: <Sidebar /> },
    { path: '/reservas', element: <h1>Panel de reservas</h1> },
  ])
  render(<RouterProvider router={router} />)
  fireEvent.click(screen.getByRole('button', { name: 'Reservas' }))
  expect(await screen.findByRole('heading', { name: 'Panel de reservas' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/reservas')
})

it('C1 «Resumen» es el primer elemento de Principal y abre /resumen', async () => {
  const router = createMemoryRouter([
    { path: '/', element: <Sidebar /> },
    { path: '/resumen', element: <h1>Resumen del negocio</h1> },
  ])
  render(<RouterProvider router={router} />)
  const principal = screen.getByText('PRINCIPAL').closest('.nav-group') as HTMLElement
  expect(within(principal).getAllByRole('button')[0]).toHaveTextContent('Resumen')
  fireEvent.click(within(principal).getByRole('button', { name: 'Resumen' }))
  expect(await screen.findByRole('heading', { name: 'Resumen del negocio' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/resumen')
})
it('UI88 abre Estadísticas desde Operaciones', async () => {
  render(<MemoryRouter initialEntries={['/']}><Sidebar /><Routes><Route path="/estadisticas" element={<h1>Estadísticas del negocio</h1>} /></Routes></MemoryRouter>)
  const enlace = screen.getByRole('button', { name: 'Estadísticas' })
  expect(enlace.closest('.nav-group')).toHaveTextContent('OPERACIONES')
  await userEvent.click(enlace)
  expect(await screen.findByRole('heading', { name: 'Estadísticas del negocio' })).toBeVisible()
})

it('abre Clientes desde Principal después de Servicios y Resumen al inicio', async () => {
  const router = createMemoryRouter([
    { path: '/', element: <Sidebar /> },
    { path: '/clientes', element: <h1>Clientes del negocio</h1> },
  ])
  render(<RouterProvider router={router} />)
  const clientes = screen.getByRole('button', { name: 'Clientes' })
  const grupo = clientes.closest('.nav-group')!
  expect(grupo).toHaveTextContent('PRINCIPAL')
  expect([...grupo.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Resumen', 'Reservas', 'Servicios', 'Clientes', 'Avisos'])
  fireEvent.click(clientes)
  expect(await screen.findByRole('heading', { name: 'Clientes del negocio' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/clientes')
})

function pantalla(angosta: boolean) {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: angosta, addEventListener: vi.fn(), removeEventListener: vi.fn() })) })
}
it('C4 colapsa, abre y cierra por botón, Escape, fuera y navegación; gestiona foco', async () => {
  pantalla(true)
  render(barra())
  const menu = screen.getByRole('button', { name: 'Abrir menú' })
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  await userEvent.click(menu)
  const cerrar = screen.getAllByRole('button', { name: 'Cerrar menú' }).at(-1)!
  expect(cerrar).toHaveFocus()
  await userEvent.tab({ shift: true })
  expect(screen.getByRole('button', { name: 'Menú de la cuenta' })).toHaveFocus()
  await userEvent.tab()
  expect(cerrar).toHaveFocus()
  await userEvent.click(cerrar)
  expect(menu).toHaveFocus()
  await userEvent.click(menu)
  await userEvent.keyboard('{Escape}')
  expect(menu).toHaveAttribute('aria-expanded', 'false')
  expect(menu).toHaveFocus()
  await userEvent.click(menu)
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar menú al tocar fuera' }))
  expect(menu).toHaveAttribute('aria-expanded', 'false')
  await userEvent.click(menu)
  await userEvent.click(screen.getByRole('button', { name: 'Reservas' }))
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
})
it('C5 conserva las cuatro entradas visibles en escritorio', async () => {
  pantalla(false)
  render(barra())
  expect(screen.getByRole('complementary')).not.toHaveAttribute('hidden')
  for (const name of ['Reservas', 'Servicios', 'Bloqueos', 'Horario']) expect(screen.getByRole('button', { name })).toBeInTheDocument()
  await screen.findByText('Estética Ana')
})
it('C6 anuncia en español estado y destino del botón', async () => {
  pantalla(true)
  render(barra())
  const boton = screen.getByRole('button', { name: 'Abrir menú' })
  expect(boton).toHaveAttribute('aria-expanded', 'false')
  expect(boton).toHaveAttribute('aria-controls', screen.getByLabelText('Navegación del panel').id)
  await userEvent.click(boton)
  expect(boton).toHaveAccessibleName('Cerrar menú')
  expect(boton).toHaveAttribute('aria-expanded', 'true')
})

it('UI102 abre Notificaciones desde el menú móvil y lo cierra al navegar', async () => {
  pantalla(true)
  render(<MemoryRouter><Sidebar /><Routes><Route path="/preferencias-notificaciones" element={<h1>Preferencias push</h1>} /></Routes></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))
  await userEvent.click(screen.getByRole('button', { name: 'Notificaciones' }))
  expect(await screen.findByRole('heading', { name: 'Preferencias push' })).toBeVisible()
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute('aria-expanded', 'false')
})

it('UI69 muestra Avisos en PRINCIPAL con globo cuando hay no leídas y sin globo en 0', async () => {
  pantalla(false)
  const contextoBase: NotificacionesContextValue = {
    noLeidas: 3,
    versionLista: 0,
    actualizarNoLeidas: vi.fn(),
    decrementarNoLeidas: vi.fn(),
    refrescarNoLeidas: vi.fn(),
    abrirAviso: vi.fn(),
  }
  const { rerender } = render(
    <MemoryRouter initialEntries={['/resumen']}>
      <NotificacionesContext.Provider value={contextoBase}>
        <Sidebar />
        <Routes>
          <Route path="/avisos" element={<h1>Bandeja de avisos</h1>} />
        </Routes>
      </NotificacionesContext.Provider>
    </MemoryRouter>,
  )
  const botonAvisos = screen.getByRole('button', { name: /Avisos/ })
  expect(botonAvisos.closest('.nav-group')).toHaveTextContent('PRINCIPAL')
  expect(within(botonAvisos).getByText('3')).toHaveClass('panel-sidebar-globo')

  rerender(
    <MemoryRouter initialEntries={['/resumen']}>
      <NotificacionesContext.Provider value={{ ...contextoBase, noLeidas: 0 }}>
        <Sidebar />
        <Routes>
          <Route path="/avisos" element={<h1>Bandeja de avisos</h1>} />
        </Routes>
      </NotificacionesContext.Provider>
    </MemoryRouter>,
  )
  const botonSinGlobo = screen.getByRole('button', { name: 'Avisos' })
  expect(botonSinGlobo.querySelector('.panel-sidebar-globo')).toBeNull()

  await userEvent.click(botonSinGlobo)
  expect(await screen.findByRole('heading', { name: 'Bandeja de avisos' })).toBeVisible()
})

describe('UI108 ítem activo según la ruta', () => {
  beforeEach(() => pantalla(false))
  const enRuta = (ruta: string) => render(<MemoryRouter initialEntries={[ruta]}><Sidebar /></MemoryRouter>)
  const activos = () => screen.queryAllByRole('button').filter((b) => b.classList.contains('active')).map((b) => b.querySelector('span:not([aria-hidden])')?.textContent)

  it('resalta el ítem de la ruta al cargar directo, sin haber hecho clic', () => {
    enRuta('/clientes')
    expect(activos()).toEqual(['Clientes'])
    expect(screen.getByRole('button', { name: 'Clientes' })).toHaveAttribute('aria-current', 'page')
  })
  it.each([
    ['/resumen', 'Resumen'], ['/reservas', 'Reservas'], ['/servicios', 'Servicios'], ['/clientes', 'Clientes'],
    ['/soporte', 'Reportar un problema'], ['/preferencias-notificaciones', 'Notificaciones'], ['/ayuda', 'Ayuda'],
    ['/estadisticas', 'Estadísticas'], ['/bloqueos', 'Bloqueos'], ['/horario', 'Horario'],
  ])('en %s solo está activo «%s»', (ruta, nombre) => {
    enRuta(ruta)
    expect(activos()).toEqual([nombre])
  })
  it('conserva el ítem en rutas anidadas', () => {
    enRuta('/reservas/r0')
    expect(activos()).toEqual(['Reservas'])
    cleanup()
    enRuta('/servicios/nuevo')
    expect(activos()).toEqual(['Servicios'])
    cleanup()
    enRuta('/clientes/c1')
    expect(activos()).toEqual(['Clientes'])
  })
  it('no confunde rutas que solo comparten prefijo ni resalta nada fuera del menú', () => {
    enRuta('/reservas-antiguas')
    expect(activos()).toEqual([])
    cleanup()
    enRuta('/mi-perfil')
    expect(activos()).toEqual([])
    expect(document.querySelector('[aria-current]')).toBeNull()
  })
  it('sigue la ruta con el botón atrás, sin depender de un clic previo', async () => {
    const router = createMemoryRouter([{ path: '*', element: <Sidebar /> }], { initialEntries: ['/resumen'] })
    render(<RouterProvider router={router} />)
    await userEvent.click(screen.getByRole('button', { name: 'Horario' }))
    expect(activos()).toEqual(['Horario'])
    await act(async () => { await router.navigate(-1) })
    expect(activos()).toEqual(['Resumen'])
    await act(async () => { await router.navigate('/bloqueos') })
    expect(activos()).toEqual(['Bloqueos'])
  })
})

describe('UI108 íconos del menú', () => {
  beforeEach(() => pantalla(false))
  const items = () => [...document.querySelectorAll<HTMLElement>('.nav-link')]
  const etiqueta = (b: HTMLElement) => b.querySelector('span:not([aria-hidden])')?.textContent

  it('cada ítem lleva un único svg de lucide, decorativo y sin glifos de texto', () => {
    render(barra())
    expect(items()).toHaveLength(11)
    for (const b of items()) {
      expect(b.querySelectorAll('svg')).toHaveLength(1)
      expect(b.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
      expect(b.querySelector('svg')).toHaveClass('lucide')
      expect(b.textContent).toBe(etiqueta(b))
    }
  })
  it('ningún ícono se repite entre ítems', () => {
    render(barra())
    const icono = (b: HTMLElement) => [...b.querySelector('svg')!.classList].find((c) => c.startsWith('lucide-') && c !== 'lucide')
    const nombres = items().map(icono)
    expect(nombres.every(Boolean)).toBe(true)
    expect(new Set(nombres).size).toBe(items().length)
  })
  it('el tamaño de los íconos lo fija una sola regla CSS con variable, no el marcado', () => {
    const css = readFileSync('src/componentes/sidebar/Sidebar.css', 'utf8')
    const regla = css.match(/\.nav-link svg\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(regla).toMatch(/width:\s*var\(--sv-icono-nav\)/)
    expect(regla).toMatch(/height:\s*var\(--sv-icono-nav\)/)
    expect(readFileSync('src/estilos/panel.css', 'utf8')).toMatch(/--sv-icono-nav:\s*20px/)
  })
})

it('UI108 la barra no muestra buscador, ni en escritorio ni en el cajón', async () => {
  pantalla(false)
  const vista = render(barra())
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.queryByPlaceholderText('Buscar...')).not.toBeInTheDocument()
  expect(document.querySelector('.search-container, .search-input, input')).toBeNull()
  vista.unmount()
  pantalla(true)
  render(barra())
  await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(document.querySelector('input')).toBeNull()
})

describe('UI108 la barra mide el alto de la ventana y desplaza el menú por dentro', () => {
  const css = readFileSync('src/componentes/sidebar/Sidebar.css', 'utf8')
  const regla = (selector: string) => css.match(new RegExp(`(?:^|\\n)${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
  it('.sidebar fija el alto a 100dvh y no crece con el contenido', () => {
    const barraCss = regla('.sidebar')
    expect(barraCss).toMatch(/height:\s*100dvh/)
    expect(barraCss).toMatch(/min-height:\s*0/)
    expect(barraCss).not.toMatch(/min-height:\s*100vh/)
  })
  it('el menú es la zona que se desplaza y el encabezado y la cuenta no se encogen', () => {
    const nav = regla('.sidebar-nav')
    expect(nav).toMatch(/overflow-y:\s*auto/)
    expect(nav).toMatch(/min-height:\s*0/)
    expect(css).toMatch(/\.sidebar-header,\s*\.user-profile\s*\{[^}]*flex:\s*none/)
  })
  it('la tarjeta de cuenta sigue dentro de la barra, después del menú', () => {
    pantalla(false)
    render(barra())
    const aside = screen.getByRole('complementary')
    const hijos = [...aside.children].map((el) => el.className)
    expect(hijos.at(-1)).toContain('user-profile')
    expect(hijos[hijos.indexOf('sidebar-nav') ]).toBe('sidebar-nav')
    expect(within(aside).getByRole('button', { name: 'Menú de la cuenta' })).toBeVisible()
  })
})

it('UI108 los ítems ocupan todo el ancho y comparten letra y alto mínimo del sistema', () => {
  const css = readFileSync('src/componentes/sidebar/Sidebar.css', 'utf8')
  expect(css.match(/\.nav-item\s*\{([^}]*)\}/)?.[1]).toMatch(/width:\s*100%/)
  const enlace = css.match(/\n\.nav-link\s*\{([^}]*)\}/)?.[1] ?? ''
  expect(enlace).toMatch(/font-size:\s*var\(--sv-texto-md\)/)
  expect(enlace).toMatch(/min-height:\s*var\(--sv-objetivo-tactil\)/)
  expect(readFileSync('src/estilos/panel.css', 'utf8')).toMatch(/--sv-objetivo-tactil:\s*44px/)
})

describe('UI108 barra móvil y cajón', () => {
  const panelCss = readFileSync('src/estilos/panel.css', 'utf8')
  const bloqueCajon = panelCss.match(/@media \(max-width: (\d+)px\) \{\s*\.layout\.layout--with-sidebar \{ flex-direction: column; \}([\s\S]*?)\n\}\n/)

  it('el cajón se activa a 900 px en JS y en CSS con el mismo valor (cubre tablet)', () => {
    pantalla(true)
    render(barra())
    const consultas = vi.mocked(window.matchMedia).mock.calls.map(([consulta]) => consulta)
    expect(consultas.length).toBeGreaterThan(0)
    expect(new Set(consultas)).toEqual(new Set(['(max-width: 900px)']))
    expect(bloqueCajon?.[1]).toBe('900')
  })
  it('la barra superior usa la superficie oscura del cajón y no la blanca del panel', () => {
    const barraMovil = bloqueCajon?.[2].match(/\.panel-barra-movil\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(barraMovil).toMatch(/background:\s*var\(--bg-sidebar\)/)
    expect(barraMovil).toMatch(/color:\s*var\(--text-main\)/)
    expect(barraMovil).not.toMatch(/--sv-superficie/)
  })
  it('abrir y cerrar usan íconos de lucide en botones propios del fondo oscuro, sin glifos ni botón secundario', async () => {
    pantalla(true)
    render(barra())
    const abrir = screen.getByRole('button', { name: 'Abrir menú' })
    expect(abrir.querySelector('svg')).toHaveClass('lucide-menu')
    expect(abrir.textContent).toBe('')
    await userEvent.click(abrir)
    const cerrar = within(screen.getByRole('complementary')).getByRole('button', { name: 'Cerrar menú' })
    expect(cerrar.querySelector('svg')).toHaveClass('lucide-x')
    expect(cerrar.textContent).toBe('')
    for (const boton of [abrir, cerrar]) {
      expect(boton).toHaveClass('panel-boton-icono')
      expect(boton).not.toHaveClass('btn-servia-secondary')
    }
  })
})

describe('UI108 el reinicio de márgenes ya no es global', () => {
  const css = readFileSync('src/componentes/sidebar/Sidebar.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const selectores = [...css.matchAll(/(?<=^|\})\s*([^{}@][^{}]*)\{([^}]*)\}/g)].map(([, selector, cuerpo]) => ({ selector: selector.trim(), cuerpo }))
  it('ninguna regla con selector universal solo reinicia margin o padding', () => {
    const globales = selectores.filter(({ selector, cuerpo }) => /^\*(\s*,\s*\*)*$/.test(selector) && /margin:\s*0|padding:\s*0/.test(cuerpo))
    expect(globales).toEqual([])
  })
  it('el reinicio queda acotado a la barra y a la barra móvil', () => {
    const acotado = selectores.find(({ selector, cuerpo }) => selector.startsWith(':where(') && /margin:\s*0/.test(cuerpo) && /padding:\s*0/.test(cuerpo))
    expect(acotado?.selector).toContain('.sidebar')
    expect(acotado?.selector).toContain('.panel-barra-movil')
  })
})
