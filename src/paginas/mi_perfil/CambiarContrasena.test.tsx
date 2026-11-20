import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import { CambiarContrasena } from './CambiarContrasena'
import { Configuracion } from '../configuracion/Configuracion'

const sesion = vi.hoisted(() => ({ usuario: null as unknown }))
vi.mock('../../contextos/AuthContext', () => ({ useAuth: () => ({ usuario: sesion.usuario }) }))
vi.mock('../../servicios/api', () => ({
  api: vi.fn((ruta: string) => Promise.resolve(ruta === '/categorias' ? [] : { perfilCompleto: true })),
}))
vi.mock('firebase/auth', async (original) => ({
  ...(await original<typeof import('firebase/auth')>()),
  EmailAuthProvider: { credential: vi.fn((correo: string, clave: string) => ({ correo, clave })) },
  reauthenticateWithCredential: vi.fn(),
  updatePassword: vi.fn(),
}))

const crearCredencial = vi.mocked(EmailAuthProvider.credential)
const reautenticar = vi.mocked(reauthenticateWithCredential)
const actualizar = vi.mocked(updatePassword)

const usuarioConContrasena = { email: 'barberia@ejemplo.com', providerData: [{ providerId: 'password' }] }
const usuarioDeGoogle = { email: 'spa@ejemplo.com', providerData: [{ providerId: 'google.com' }] }

beforeEach(() => {
  sesion.usuario = usuarioConContrasena
  crearCredencial.mockClear()
  reautenticar.mockReset()
  actualizar.mockReset()
})

async function llenar(actual: string, nueva: string, confirmacion = nueva) {
  const usuario = userEvent.setup()
  render(<CambiarContrasena />)
  if (actual) await usuario.type(screen.getByLabelText('Contraseña actual'), actual)
  if (nueva) await usuario.type(screen.getByLabelText('Contraseña nueva'), nueva)
  if (confirmacion) await usuario.type(screen.getByLabelText('Confirma la contraseña nueva'), confirmacion)
  await usuario.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))
}

describe('MVP-04 cambiar la contraseña con la sesión iniciada', () => {
  it('C3 aparece como subsección «Cambiar contraseña» dentro de la tarjeta Cuenta de Configuración', async () => {
    render(<MemoryRouter><Configuracion /></MemoryRouter>)
    const cuenta = await screen.findByRole('region', { name: 'Cuenta' })
    expect(within(cuenta).getByRole('heading', { name: 'Cambiar contraseña' })).toBeInTheDocument()
    expect(within(cuenta).getByLabelText('Contraseña actual')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('C3 reautentica con la actual y cambia a la nueva', async () => {
    reautenticar.mockResolvedValue({} as never)
    actualizar.mockResolvedValue(undefined)
    await llenar('vieja-1234', 'nueva-5678')
    expect(crearCredencial).toHaveBeenCalledWith('barberia@ejemplo.com', 'vieja-1234')
    expect(reautenticar).toHaveBeenCalledWith(usuarioConContrasena, { correo: 'barberia@ejemplo.com', clave: 'vieja-1234' })
    expect(actualizar).toHaveBeenCalledWith(usuarioConContrasena, 'nueva-5678')
    expect(reautenticar.mock.invocationCallOrder[0]).toBeLessThan(actualizar.mock.invocationCallOrder[0])
    expect(await screen.findByRole('status')).toHaveTextContent('cambiaste tu contraseña')
    expect(screen.getByLabelText('Contraseña actual')).toHaveValue('')
  })

  it.each(['auth/wrong-password', 'auth/invalid-credential'])(
    'C3 con la actual incorrecta (%s) avisa y no cambia nada', async (code) => {
      reautenticar.mockRejectedValue(Object.assign(new Error('x'), { code }))
      await llenar('equivocada', 'nueva-5678')
      const campo = screen.getByLabelText('Contraseña actual')
      expect(await screen.findByRole('alert')).toHaveTextContent('La contraseña actual no es correcta.')
      expect(campo).toHaveAccessibleDescription('La contraseña actual no es correcta.')
      expect(campo).toHaveFocus()
      expect(actualizar).not.toHaveBeenCalled()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

  it('borde: demasiados intentos da su propio aviso y no cambia nada', async () => {
    reautenticar.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/too-many-requests' }))
    await llenar('vieja-1234', 'nueva-5678')
    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos. Inténtalo más tarde.')
    expect(actualizar).not.toHaveBeenCalled()
  })

  it('borde: si falla updatePassword muestra un aviso genérico', async () => {
    reautenticar.mockResolvedValue({} as never)
    actualizar.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/network-request-failed' }))
    await llenar('vieja-1234', 'nueva-5678')
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cambiar la contraseña. Inténtalo de nuevo.')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it.each([
    ['la nueva tiene menos de 8 caracteres', 'vieja-1234', 'corta12', 'corta12', 'Contraseña nueva', 'La contraseña nueva debe tener al menos 8 caracteres.'],
    ['la confirmación no coincide', 'vieja-1234', 'nueva-5678', 'nueva-0000', 'Confirma la contraseña nueva', 'Las contraseñas no coinciden.'],
    ['la nueva es igual a la actual', 'misma-1234', 'misma-1234', 'misma-1234', 'Contraseña nueva', 'La contraseña nueva debe ser distinta de la actual.'],
    ['falta la actual', '', 'nueva-5678', 'nueva-5678', 'Contraseña actual', 'Escribe tu contraseña actual.'],
  ])('borde: si %s avisa junto al campo y no llama a Firebase', async (_caso, actual, nueva, confirmacion, etiqueta, mensaje) => {
    await llenar(actual, nueva, confirmacion)
    const campo = screen.getByLabelText(etiqueta)
    expect(screen.getByRole('alert')).toHaveTextContent(mensaje)
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(campo).toHaveAccessibleDescription(mensaje)
    expect(campo).toHaveFocus()
    expect(reautenticar).not.toHaveBeenCalled()
    expect(actualizar).not.toHaveBeenCalled()
  })

  it('borde: si Firebase rechaza la nueva por débil (auth/weak-password) avisa junto a la nueva', async () => {
    reautenticar.mockResolvedValue({} as never)
    actualizar.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/weak-password' }))
    await llenar('vieja-1234', 'nueva-5678')
    const campo = screen.getByLabelText('Contraseña nueva')
    expect(await screen.findByRole('alert')).toHaveTextContent('La contraseña nueva es muy débil. Elige otra más segura.')
    expect(campo).toHaveAccessibleDescription('La contraseña nueva es muy débil. Elige otra más segura.')
    expect(campo).toHaveFocus()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('borde: 8 caracteres exactos sí son válidos', async () => {
    reautenticar.mockResolvedValue({} as never)
    actualizar.mockResolvedValue(undefined)
    await llenar('vieja-1234', 'ocho-888')
    expect(actualizar).toHaveBeenCalledWith(usuarioConContrasena, 'ocho-888')
  })

  it('borde: una cuenta que entra solo con Google ve el aviso y no se le pide nada', () => {
    sesion.usuario = usuarioDeGoogle
    render(<CambiarContrasena />)
    expect(screen.getByText('Tu cuenta entra con Google; la contraseña se administra en tu cuenta de Google.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Contraseña actual')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cambiar contraseña' })).not.toBeInTheDocument()
  })
})
