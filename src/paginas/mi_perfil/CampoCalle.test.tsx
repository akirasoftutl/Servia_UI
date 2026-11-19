import { useState } from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api, ErrorApi } from '../../servicios/api'
import { AVISO_SUGERENCIA, CampoCalle } from './CampoCalle'
import { NOTA_SIN_SUGERENCIAS } from './useAutocompletarDomicilio'
import { readFileSync } from 'node:fs'

vi.mock('../../servicios/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../servicios/api')>()
  return { ...actual, api: vi.fn() }
})

const apiMock = vi.mocked(api)
const TEXTOS = ['Blvd. López Mateos 1, León, Gto.', 'Blvd. López Mateos 2, León, Gto.', 'Blvd. López Mateos 3, León, Gto.']

function Campo({ inicial = '' }: { inicial?: string }) {
  const [calle, setCalle] = useState(inicial)
  return (
    <>
      <label htmlFor="calle">Calle *</label>
      <CampoCalle value={calle} onChange={(e) => setCalle(e.target.value)} onElegir={setCalle} />
      <button type="button">Otro</button>
    </>
  )
}

function preparar(inicial?: string) {
  const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(<Campo inicial={inicial} />)
  return { usuario, campo: screen.getByRole('combobox', { name: 'Calle *' }) }
}

const esperar = (ms = 300) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

async function abrirSugerencias(usuario: ReturnType<typeof userEvent.setup>, campo: HTMLElement) {
  await usuario.type(campo, 'Blvd')
  await esperar()
  return screen.getAllByRole('option')
}

beforeEach(() => {
  // shouldAdvanceTime: user-event espera con setTimeout reales entre acciones.
  vi.useFakeTimers({ shouldAdvanceTime: true })
  apiMock.mockReset()
  apiMock.mockResolvedValue(TEXTOS.map((texto, i) => ({ texto, lugarId: `lugar-${i + 1}` })))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('CampoCalle', () => {
  it('es un combobox accesible que abre la lista con las sugerencias', async () => {
    const { usuario, campo } = preparar()
    expect(campo).toHaveAttribute('autocomplete', 'off')
    expect(campo).toHaveAttribute('aria-autocomplete', 'list')
    expect(campo).toHaveAttribute('aria-controls', 'calle-sugerencias')
    expect(campo).toHaveAttribute('aria-expanded', 'false')
    const opciones = await abrirSugerencias(usuario, campo)
    expect(campo).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('listbox')).toHaveAttribute('id', 'calle-sugerencias')
    expect(opciones.map((o) => o.textContent)).toEqual(TEXTOS)
    expect(opciones.every((o) => o.id && o.getAttribute('aria-selected') === 'false')).toBe(true)
    // Política vigente de Places API (New): texto «Google Maps» sin traducir.
    const atribucion = screen.getByText('Google Maps', { exact: true })
    expect(atribucion).toBeVisible()
    expect(atribucion).toHaveAttribute('translate', 'no')
    expect(screen.queryByText(/Powered by Google/)).not.toBeInTheDocument()
  })

  it('las flechas mueven la opción activa y Enter la elige', async () => {
    const { usuario, campo } = preparar('Algo viejo')
    await usuario.clear(campo)
    const opciones = await abrirSugerencias(usuario, campo)
    expect(campo).not.toHaveAttribute('aria-activedescendant')
    await usuario.keyboard('{ArrowDown}{ArrowDown}')
    expect(campo).toHaveAttribute('aria-activedescendant', opciones[1].id)
    expect(opciones[1]).toHaveAttribute('aria-selected', 'true')
    await usuario.keyboard('{ArrowUp}{ArrowUp}')
    expect(campo).toHaveAttribute('aria-activedescendant', opciones[2].id)
    await usuario.keyboard('{Enter}')
    expect(campo).toHaveValue(TEXTOS[2])
    expect(campo).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('status')).toHaveTextContent(AVISO_SUGERENCIA)
  })

  it('el aviso de la sugerencia aparece al elegir y se apaga al editar la calle', async () => {
    const { usuario, campo } = preparar()
    const opciones = await abrirSugerencias(usuario, campo)
    expect(screen.queryByText(AVISO_SUGERENCIA)).not.toBeInTheDocument()
    await usuario.click(opciones[0])
    expect(screen.getByRole('status')).toHaveTextContent(AVISO_SUGERENCIA)
    await usuario.type(campo, ' 120')
    expect(campo).toHaveValue(`${TEXTOS[0]} 120`)
    expect(screen.queryByText(AVISO_SUGERENCIA)).not.toBeInTheDocument()
  })

  it('Enter sin opción activa no elige ni se cancela', async () => {
    const { usuario, campo } = preparar()
    await abrirSugerencias(usuario, campo)
    const evento = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    act(() => { campo.dispatchEvent(evento) })
    expect(evento.defaultPrevented).toBe(false)
    expect(campo).toHaveValue('Blvd')
  })

  it('el clic en una opción la elige sin que el campo pierda el foco', async () => {
    const { usuario, campo } = preparar()
    const opciones = await abrirSugerencias(usuario, campo)
    await usuario.click(opciones[0])
    expect(campo).toHaveValue(TEXTOS[0])
    expect(campo).toHaveFocus()
    expect(campo).toHaveAttribute('aria-expanded', 'false')
  })

  it('Escape cierra la lista sin borrar lo escrito', async () => {
    const { usuario, campo } = preparar()
    await abrirSugerencias(usuario, campo)
    await usuario.keyboard('{Escape}')
    expect(campo).toHaveAttribute('aria-expanded', 'false')
    expect(campo).toHaveValue('Blvd')
  })

  it('Tab cierra sin elegir', async () => {
    const { usuario, campo } = preparar()
    await abrirSugerencias(usuario, campo)
    await usuario.keyboard('{ArrowDown}')
    await usuario.tab()
    expect(campo).toHaveAttribute('aria-expanded', 'false')
    expect(campo).toHaveValue('Blvd')
  })

  it('el clic fuera cierra la lista sin borrar lo escrito', async () => {
    const { usuario, campo } = preparar()
    await abrirSugerencias(usuario, campo)
    await usuario.click(screen.getByRole('button', { name: 'Otro' }))
    expect(campo).toHaveAttribute('aria-expanded', 'false')
    expect(campo).toHaveValue('Blvd')
  })

  it('con [] muestra «Sin sugerencias» dentro de la lista, sin error', async () => {
    apiMock.mockResolvedValue([])
    const { usuario, campo } = preparar()
    await usuario.type(campo, 'Calle rara')
    await esperar()
    expect(screen.getByText('Sin sugerencias')).toHaveAttribute('aria-live', 'polite')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(campo).not.toHaveClass('is-invalid')
  })

  it.each([429, 503])('con %i deja la nota discreta y el campo usable', async (estado) => {
    apiMock.mockRejectedValue(new ErrorApi(estado, 'No se pudieron obtener sugerencias.'))
    const { usuario, campo } = preparar()
    await usuario.type(campo, 'Blvd')
    await esperar()
    const nota = screen.getByText(NOTA_SIN_SUGERENCIAS)
    expect(nota).toHaveAttribute('aria-live', 'polite')
    expect(campo).not.toHaveClass('is-invalid')
    expect(campo).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await usuario.type(campo, ' 123')
    expect(campo).toHaveValue('Blvd 123')
    expect(campo).toBeEnabled()
  })

  it('la atribución usa el estilo que pide Google: Roboto o sans-serif, 400, 12 px, #5E5E5E', () => {
    // jsdom no aplica el CSS importado; se revisa la regla en la hoja de estilos.
    const estilosPerfil = readFileSync('src/paginas/mi_perfil/MiPerfil.css', 'utf8')
    const regla = estilosPerfil.match(/\.perfil-calle-atribucion\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(regla).toMatch(/font-family:\s*Roboto,\s*sans-serif;/)
    expect(regla).toMatch(/font-weight:\s*400;/)
    expect(regla).toMatch(/font-size:\s*12px;/)
    expect(regla).toMatch(/color:\s*#5e5e5e;/i)
  })
})
