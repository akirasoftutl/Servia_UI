import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api, ErrorApi } from '../../servicios/api'
import { Horario } from './Horario'

vi.mock('../../servicios/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../servicios/api')>()
  return { ...actual, api: vi.fn() }
})

const apiMock = vi.mocked(api)

const MENSAJE_SIN_HORARIO =
  'Configura tu horario de atención para empezar a recibir reservas.'

const diasConfigurados = {
  lunes: { abre: '09:00', cierra: '18:00' },
  martes: { abre: '09:00', cierra: '18:00' },
  miercoles: { abre: '09:00', cierra: '18:00' },
  jueves: { abre: '09:00', cierra: '18:00' },
  viernes: { abre: '09:00', cierra: '18:00' },
  sabado: null,
  domingo: null,
}

function renderizarHorario() {
  render(<Horario />)
}

describe('Horario', () => {
  beforeEach(() => {
    apiMock.mockReset()
  })

  it('muestra el aviso y los siete días cuando el negocio no tiene horario', async () => {
    apiMock.mockResolvedValueOnce({ configurado: false, dias: null })

    renderizarHorario()

    expect(await screen.findByText(MENSAJE_SIN_HORARIO)).toBeInTheDocument()
    expect(screen.getAllByRole('switch')).toHaveLength(7)

    for (const nombre of [
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
      'Domingo',
    ]) {
      expect(screen.getByText(nombre)).toBeInTheDocument()
    }
  })

  it('oculta las horas de un día de descanso', async () => {
    const user = userEvent.setup()
    apiMock.mockResolvedValueOnce({
      configurado: true,
      dias: diasConfigurados,
    })

    renderizarHorario()

    const filaLunes = await screen.findByTestId('dia-lunes')
    expect(within(filaLunes).getByLabelText('Abre')).toHaveValue('09:00')

    await user.click(
      within(filaLunes).getByRole('switch', { name: 'Lunes laborable' }),
    )

    expect(within(filaLunes).queryByLabelText('Abre')).not.toBeInTheDocument()
    expect(within(filaLunes).getByText('Descanso')).toBeInTheDocument()
  })

  it('valida que la hora de cierre sea posterior a la de apertura', async () => {
    const user = userEvent.setup()
    apiMock.mockResolvedValueOnce({
      configurado: true,
      dias: diasConfigurados,
    })

    renderizarHorario()

    const filaLunes = await screen.findByTestId('dia-lunes')
    fireEvent.change(within(filaLunes).getByLabelText('Cierra'), {
      target: { value: '08:00' },
    })

    await user.click(screen.getByRole('button', { name: 'Guardar horario' }))

    expect(
      within(filaLunes).getByText(
        'La hora de cierre debe ser posterior a la de apertura.',
      ),
    ).toBeInTheDocument()
    expect(apiMock).toHaveBeenCalledTimes(1)
  })

  it('pide las horas de apertura y cierre cuando faltan', async () => {
    const user = userEvent.setup()
    apiMock.mockResolvedValueOnce({
      configurado: true,
      dias: diasConfigurados,
    })

    renderizarHorario()

    const filaLunes = await screen.findByTestId('dia-lunes')
    fireEvent.change(within(filaLunes).getByLabelText('Abre'), {
      target: { value: '' },
    })

    await user.click(screen.getByRole('button', { name: 'Guardar horario' }))

    expect(
      within(filaLunes).getByText(
        'Indica la hora de apertura y la de cierre.',
      ),
    ).toBeInTheDocument()
    expect(apiMock).toHaveBeenCalledTimes(1)
  })

  it('avisa cuando los siete días quedan de descanso', async () => {
    const user = userEvent.setup()
    apiMock.mockResolvedValueOnce({
      configurado: true,
      dias: diasConfigurados,
    })

    renderizarHorario()

    await screen.findByTestId('dia-lunes')
    expect(
      screen.queryByText('Sin días laborables, los clientes no podrán reservar.'),
    ).not.toBeInTheDocument()

    for (const clave of [
      'lunes',
      'martes',
      'miercoles',
      'jueves',
      'viernes',
    ]) {
      const fila = screen.getByTestId(`dia-${clave}`)
      await user.click(within(fila).getByRole('switch'))
    }

    expect(
      screen.getByText('Sin días laborables, los clientes no podrán reservar.'),
    ).toBeInTheDocument()
  })

  it('guarda los siete días y oculta el aviso de horario sin configurar', async () => {
    const user = userEvent.setup()
    apiMock.mockResolvedValueOnce({ configurado: false, dias: null })
    apiMock.mockResolvedValueOnce({ configurado: true, dias: null })

    renderizarHorario()

    const filaLunes = await screen.findByTestId('dia-lunes')
    await user.click(
      within(filaLunes).getByRole('switch', { name: 'Lunes laborable' }),
    )
    await user.click(screen.getByRole('button', { name: 'Guardar horario' }))

    expect(await screen.findByText('Horario guardado.')).toBeInTheDocument()
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.queryByText(MENSAJE_SIN_HORARIO)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Aceptar' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    expect(apiMock).toHaveBeenCalledTimes(2)
    const [ruta, opciones] = apiMock.mock.calls[1]
    expect(ruta).toBe('/negocios/mio/horario')
    expect(opciones?.method).toBe('PUT')

    const cuerpo = JSON.parse(String(opciones?.body))
    expect(cuerpo.lunes).toEqual({ abre: '09:00', cierra: '18:00' })
    expect(cuerpo.martes).toBeNull()
    expect(cuerpo.domingo).toBeNull()
  })

  it('muestra las reservas afectadas y confirma el guardado con ?confirmar=true', async () => {
    const user = userEvent.setup()
    const reservas = [
      {
        id: 'res-1',
        folio: 'SRV-7KQ2MX',
        inicio: '2026-11-02T16:00:00.000Z',
        fin: '2026-11-02T16:45:00.000Z',
        servicio: { nombre: 'Corte de cabello' },
        estado: 'pendiente',
      },
    ]

    apiMock.mockResolvedValueOnce({ configurado: false, dias: null })
    apiMock.mockRejectedValueOnce(
      new ErrorApi(409, 'Reservas fuera del horario', { reservas }),
    )
    apiMock.mockResolvedValueOnce({ configurado: true, dias: null })

    renderizarHorario()

    const filaLunes = await screen.findByTestId('dia-lunes')
    await user.click(
      within(filaLunes).getByRole('switch', { name: 'Lunes laborable' }),
    )
    await user.click(screen.getByRole('button', { name: 'Guardar horario' }))

    const dialogo = await screen.findByRole('alertdialog')
    expect(
      within(dialogo).getByText(
        'Estas reservas quedan fuera del nuevo horario',
      ),
    ).toBeInTheDocument()
    expect(
      within(dialogo).getByText(
        'No se cancelarán solas. Si guardas, revisa cada una.',
      ),
    ).toBeInTheDocument()
    expect(within(dialogo).getByText('SRV-7KQ2MX')).toBeInTheDocument()
    expect(within(dialogo).getByText('Corte de cabello')).toBeInTheDocument()
    expect(within(dialogo).getByText('Pendiente')).toBeInTheDocument()

    await user.click(
      within(dialogo).getByRole('button', { name: 'Guardar de todos modos' }),
    )

    expect(await screen.findByText('Horario guardado.')).toBeInTheDocument()
    expect(
      screen.queryByText('Estas reservas quedan fuera del nuevo horario'),
    ).not.toBeInTheDocument()

    expect(apiMock).toHaveBeenCalledTimes(3)
    expect(apiMock.mock.calls[2][0]).toBe(
      '/negocios/mio/horario?confirmar=true',
    )
    expect(apiMock.mock.calls[2][1]?.method).toBe('PUT')
  })

  it('cierra el diálogo sin guardar al pulsar Volver', async () => {
    const user = userEvent.setup()
    apiMock.mockResolvedValueOnce({ configurado: false, dias: null })
    apiMock.mockRejectedValueOnce(
      new ErrorApi(409, 'Reservas fuera del horario', {
        reservas: [
          {
            id: 'res-2',
            folio: 'SRV-ABC123',
            inicio: '2026-11-03T18:00:00.000Z',
            fin: '2026-11-03T18:30:00.000Z',
            servicio: { nombre: 'Manicura' },
            estado: 'confirmada',
          },
        ],
      }),
    )

    renderizarHorario()

    const filaLunes = await screen.findByTestId('dia-lunes')
    await user.click(
      within(filaLunes).getByRole('switch', { name: 'Lunes laborable' }),
    )
    await user.click(screen.getByRole('button', { name: 'Guardar horario' }))

    const dialogo = await screen.findByRole('alertdialog')
    await user.click(within(dialogo).getByRole('button', { name: 'Volver' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(apiMock).toHaveBeenCalledTimes(2)
  })

  it('muestra el error general cuando falla el guardado', async () => {
    const user = userEvent.setup()
    apiMock.mockResolvedValueOnce({ configurado: false, dias: null })
    apiMock.mockRejectedValueOnce(new ErrorApi(500, 'Error del servidor'))

    renderizarHorario()

    const filaLunes = await screen.findByTestId('dia-lunes')
    await user.click(
      within(filaLunes).getByRole('switch', { name: 'Lunes laborable' }),
    )
    await user.click(screen.getByRole('button', { name: 'Guardar horario' }))

    expect(
      await screen.findByText(
        'No pudimos guardar tu horario. Intenta de nuevo.',
      ),
    ).toBeInTheDocument()
  })
})
