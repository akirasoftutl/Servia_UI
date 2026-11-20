import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api, ErrorApi } from '../../servicios/api'
import { Bloqueos } from './Bloqueos'

vi.mock('../../servicios/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../servicios/api')>()
  return { ...actual, api: vi.fn() }
})
const llamada = vi.mocked(api)
const ruta = '/negocios/mio/bloqueos'
const bloqueo = { id: 'b1', inicio: '2026-12-10T06:00:00.000Z', fin: '2026-12-11T06:00:00.000Z', motivo: 'Vacaciones' }
const fecha = (id: string, valor: string) => fireEvent.change(document.getElementById(id)!, { target: { value: valor } })
const enviar = () => fireEvent.submit(screen.getByRole('button', { name: 'Bloquear' }).closest('form')!)
async function abrir() {
  render(<Bloqueos />)
  await waitFor(() => expect(screen.queryByText('Cargando...')).not.toBeInTheDocument())
}
function preparar(tipo = 'dia') {
  fecha('tipo', tipo)
  fecha('fechaInicio', '2026-12-10')
}
beforeEach(() => {
  llamada.mockReset().mockResolvedValue([])
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-03T18:00:00Z'))
})
afterEach(() => vi.useRealTimers())

it.each([
  ['dia', { fechaInicio: '2026-12-10' }],
  ['rango', { fechaInicio: '2026-12-10', fechaFin: '2026-12-12', motivo: 'Vacaciones' }],
  ['horas', { fechaInicio: '2026-12-10', horaInicio: '14:00', horaFin: '15:00' }],
])('B01 crea %s mediante API y actualiza la lista', async (tipo, esperado) => {
  await abrir()
  preparar(tipo)
  if (tipo === 'rango') { fecha('fechaFin', '2026-12-12'); fecha('motivo', ' Vacaciones ') }
  if (tipo === 'horas') { fecha('horaInicio', '14:00'); fecha('horaFin', '15:00') }
  llamada.mockResolvedValueOnce(bloqueo).mockResolvedValueOnce([bloqueo])
  enviar()
  expect(await screen.findByRole('status')).toHaveTextContent('Bloqueo creado.')
  expect(llamada.mock.calls[1][0]).toBe(ruta)
  expect(llamada.mock.calls[1][1]?.method).toBe('POST')
  expect(JSON.parse(String(llamada.mock.calls[1][1]?.body))).toEqual(esperado)
  expect(await screen.findByText(/Día\(s\) completo\(s\) · Vacaciones/)).toBeInTheDocument()
  expect(document.getElementById('fechaInicio')).toHaveValue('')
})

it.each(['dia', 'rango'])('B02 pide la fecha de %s junto al campo', async (tipo) => {
  await abrir(); fecha('tipo', tipo); enviar()
  expect(document.getElementById('fechaInicio')).toHaveAccessibleDescription('Elige la fecha.')
  expect(document.getElementById('fechaInicio')).toHaveAttribute('aria-invalid', 'true')
  if (tipo === 'rango') expect(document.getElementById('fechaFin')).toHaveAccessibleDescription('Elige la fecha.')
  expect(llamada).toHaveBeenCalledTimes(1)
})
it('B03 rechaza rango invertido junto a Hasta', async () => {
  await abrir(); preparar('rango'); fecha('fechaFin', '2026-12-09'); enviar()
  expect(document.getElementById('fechaFin')).toHaveAccessibleDescription('La fecha final no puede ser anterior a la inicial.')
  expect(llamada).toHaveBeenCalledTimes(1)
})
it.each(['13:00', '14:00'])('B04 rechaza hora final %s no posterior', async (fin) => {
  await abrir(); preparar('horas'); fecha('horaInicio', '14:00'); fecha('horaFin', fin); enviar()
  expect(document.getElementById('horaFin')).toHaveAccessibleDescription('La hora final debe ser posterior a la inicial.')
  expect(llamada).toHaveBeenCalledTimes(1)
})
it('B05 pide las dos horas junto a sus campos', async () => {
  await abrir(); preparar('horas'); enviar()
  expect(document.getElementById('horaInicio')).toHaveAccessibleDescription('Elige la hora de inicio.')
  expect(document.getElementById('horaFin')).toHaveAccessibleDescription('Elige la hora de fin.')
  expect(llamada).toHaveBeenCalledTimes(1)
})
it.each(['dia', 'rango', 'horas'])('B06 rechaza fecha pasada para %s', async (tipo) => {
  await abrir(); preparar(tipo); fecha('fechaInicio', '2000-01-01')
  if (tipo === 'rango') fecha('fechaFin', '2026-12-12')
  if (tipo === 'horas') { fecha('horaInicio', '14:00'); fecha('horaFin', '15:00') }
  enviar()
  expect(document.getElementById('fechaInicio')).toHaveAccessibleDescription('No puedes bloquear fechas que ya pasaron.')
  expect(llamada).toHaveBeenCalledTimes(1)
})
it('B07 rechaza horas ya pasadas del día actual en México', async () => {
  await abrir(); preparar('horas'); fecha('fechaInicio', '2026-11-03'); fecha('horaInicio', '10:00'); fecha('horaFin', '11:00'); enviar()
  expect(document.getElementById('fechaInicio')).toHaveAccessibleDescription('No puedes bloquear fechas que ya pasaron.')
  expect(llamada).toHaveBeenCalledTimes(1)
})
it('B08 limita motivo a 200 y valida cambios programáticos', async () => {
  await abrir(); preparar()
  expect(screen.getByLabelText('Motivo (opcional)')).toHaveAttribute('maxlength', '200')
  fecha('motivo', 'a'.repeat(201)); enviar()
  expect(screen.getByLabelText('Motivo (opcional)')).toHaveAccessibleDescription('El motivo no puede tener más de 200 caracteres.')
  expect(llamada).toHaveBeenCalledTimes(1)
})
it.each([400, 500])('B09 muestra error %s en el formulario sin alert', async (estado) => {
  const alerta = vi.spyOn(window, 'alert').mockImplementation(() => {})
  await abrir(); preparar(); llamada.mockRejectedValueOnce(new ErrorApi(estado, 'Fallo')); enviar()
  expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos guardar el bloqueo. Intenta de nuevo.')
  expect(alerta).not.toHaveBeenCalled()
  expect(screen.queryByText('Bloqueo creado.')).not.toBeInTheDocument()
})
it('B10 presenta reservas Pendientes y Confirmadas desde ErrorApi.datos', async () => {
  await abrir(); preparar()
  llamada.mockRejectedValueOnce(new ErrorApi(409, 'Conflicto', { reservas: ['pendiente', 'confirmada'].map((estado, i) => ({ folio: `SRV-${i}`, inicio: '2026-12-11T01:00:00Z', servicio: { nombre: `Corte ${i}` }, estado })) }))
  enviar()
  const dialogo = await screen.findByRole('alertdialog')
  expect(dialogo).toHaveAccessibleDescription('No se puede bloquear este periodo porque tiene reservas activas. Recházalas o cancélalas primero:')
  for (const [i, estado] of ['Pendiente', 'Confirmada'].entries()) {
    const fila = within(dialogo).getByText(`SRV-${i}`).closest('tr')!
    expect(fila).toHaveTextContent(`Corte ${i}`)
    expect(fila).toHaveTextContent(estado)
    expect(fila).toHaveTextContent('10 dic 2026')
    expect(fila).toHaveTextContent('19:00')
  }
  expect(llamada).toHaveBeenCalledTimes(2)
  expect(screen.queryByText('Bloqueo creado.')).not.toBeInTheDocument()
})
it('B11 asocia todas las etiquetas con sus controles', async () => {
  await abrir(); preparar('rango')
  for (const etiqueta of ['Tipo de bloqueo', 'Desde *', 'Hasta *', 'Motivo (opcional)']) expect(screen.getByLabelText(etiqueta)).toBeInTheDocument()
  preparar('horas')
  for (const etiqueta of ['Fecha *', 'De *', 'A *']) expect(screen.getByLabelText(etiqueta)).toBeInTheDocument()
})
it('B12 diálogo de conflicto gestiona foco, Tab, Escape y fondo inerte', async () => {
  await abrir(); preparar(); llamada.mockRejectedValueOnce(new ErrorApi(409, 'Conflicto', { reservas: [] }))
  const boton = screen.getByRole('button', { name: 'Bloquear' }); boton.focus(); enviar()
  const dialogo = await screen.findByRole('alertdialog')
  const cerrar = within(dialogo).getByRole('button', { name: 'Entendido' })
  expect(dialogo).toHaveAccessibleName('No se puede bloquear')
  expect(dialogo).toHaveAttribute('aria-modal', 'true')
  await waitFor(() => expect(cerrar).toHaveFocus())
  expect(boton.closest('.bloqueos-container')).toHaveAttribute('inert')
  await userEvent.tab(); expect(cerrar).toHaveFocus()
  await userEvent.tab({ shift: true }); expect(cerrar).toHaveFocus()
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  await waitFor(() => expect(boton).toHaveFocus())
})
it('B13 separa carga, error y vacío y permite reintentar', async () => {
  llamada.mockRejectedValueOnce(new Error('Red'))
  await abrir()
  expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar tus bloqueos.')
  expect(screen.queryByText('Cuando necesites cerrar una fecha u hora, crea un bloqueo en el formulario.')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText('Cuando necesites cerrar una fecha u hora, crea un bloqueo en el formulario.')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(llamada).toHaveBeenCalledTimes(2)
})
it('B14 muestra días inclusivos sin agregar el día siguiente', async () => {
  llamada.mockResolvedValueOnce([bloqueo, { ...bloqueo, id: 'b2', fin: '2026-12-13T06:00:00Z' }]); await abrir()
  expect(screen.getByRole('heading', { name: '10 dic 2026', level: 3 })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '10 dic 2026 - 12 dic 2026', level: 3 })).toBeInTheDocument()
})
it('B15 mantiene fechas y horas de México con navegador en Tokio', async () => {
  const fechaOriginal = Date.prototype.toLocaleDateString
  const horaOriginal = Date.prototype.toLocaleTimeString
  vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function (this: Date, idioma, opciones) { return fechaOriginal.call(this, idioma, { timeZone: 'Asia/Tokyo', ...opciones }) })
  vi.spyOn(Date.prototype, 'toLocaleTimeString').mockImplementation(function (this: Date, idioma, opciones) { return horaOriginal.call(this, idioma, { timeZone: 'Asia/Tokyo', ...opciones }) })
  llamada.mockResolvedValueOnce([{ ...bloqueo, inicio: '2026-12-11T01:00:00Z', fin: '2026-12-11T02:00:00Z' }]); await abrir()
  expect(screen.getByRole('heading', { name: '10 dic 2026', level: 3 })).toBeInTheDocument()
  expect(screen.getByText('19:00 a 20:00 · Vacaciones')).toBeInTheDocument()
})
it('B16 confirma Quitar, cancela sin DELETE y luego elimina y actualiza', async () => {
  llamada.mockResolvedValueOnce([bloqueo]); await abrir()
  const quitar = screen.getByRole('button', { name: 'Quitar' }); await userEvent.click(quitar)
  let dialogo = screen.getByRole('alertdialog')
  expect(dialogo).toHaveAccessibleDescription('¿Quitar este bloqueo? Los clientes podrán volver a reservar en ese periodo.')
  const cancelar = within(dialogo).getByRole('button', { name: 'Cancelar' })
  await waitFor(() => expect(cancelar).toHaveFocus())
  await userEvent.tab({ shift: true }); expect(within(dialogo).getByRole('button', { name: 'Quitar' })).toHaveFocus()
  await userEvent.tab(); expect(cancelar).toHaveFocus()
  await userEvent.click(cancelar); await waitFor(() => expect(quitar).toHaveFocus()); expect(llamada).toHaveBeenCalledTimes(1)
  await userEvent.click(quitar); dialogo = screen.getByRole('alertdialog')
  await userEvent.click(within(dialogo).getByRole('button', { name: 'Quitar' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Bloqueo quitado.')
  expect(llamada).toHaveBeenNthCalledWith(2, `${ruta}/b1`, { method: 'DELETE' })
  expect(await screen.findByText('Cuando necesites cerrar una fecha u hora, crea un bloqueo en el formulario.')).toBeInTheDocument()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})
it('B17 comunica fallo al quitar y conserva el bloqueo', async () => {
  llamada.mockResolvedValueOnce([bloqueo]); await abrir()
  llamada.mockRejectedValueOnce(new Error('Red'))
  await userEvent.click(screen.getByRole('button', { name: 'Quitar' }))
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Quitar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos quitar el bloqueo. Intenta de nuevo.')
  expect(screen.getByRole('button', { name: 'Quitar' })).toBeInTheDocument()
})
