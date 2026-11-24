import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ErrorCampo } from './ErrorCampo'
import { atributosErrorCampo, idErrorCampo } from '../../utilidades/validacion'

describe('ErrorCampo', () => {
  it('no renderiza nada cuando no hay mensaje', () => {
    const { container } = render(<ErrorCampo id="nombre-error" mensaje="" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('muestra el error con role=alert, clase panel-error-campo y se enlaza con aria-describedby', () => {
    const error = 'El nombre es obligatorio.'
    render(
      <div>
        <label htmlFor="nombre">Nombre</label>
        <input id="nombre" {...atributosErrorCampo('nombre', error)} />
        <ErrorCampo id={idErrorCampo('nombre')} mensaje={error} />
      </div>,
    )

    const campo = screen.getByLabelText('Nombre')
    const alerta = screen.getByRole('alert')
    expect(alerta).toHaveTextContent(error)
    expect(alerta).toHaveAttribute('id', 'nombre-error')
    expect(alerta).toHaveClass('panel-error-campo')
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(campo).toHaveAttribute('aria-describedby', 'nombre-error')
  })
})
