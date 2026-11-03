import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendPasswordResetEmail } from 'firebase/auth'
import { Login } from './Login'

const authFalso = vi.hoisted(() => ({ nombre: 'auth-de-prueba' }))
vi.mock('../../servicios/firebase', () => ({ auth: authFalso }))
vi.mock('../../servicios/api', () => ({ api: vi.fn() }))
vi.mock('firebase/auth', async (original) => ({
  ...(await original<typeof import('firebase/auth')>()),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
}))

const enviarCorreo = vi.mocked(sendPasswordResetEmail)
const MENSAJE = 'Si el correo está registrado, te enviamos un enlace para crear una contraseña nueva.'

function abrirLogin() {
  render(<MemoryRouter initialEntries={['/login']}><Login /></MemoryRouter>)
}

async function abrirRecuperar() {
  const usuario = userEvent.setup()
  abrirLogin()
  await usuario.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }))
  return usuario
}

beforeEach(() => {
  enviarCorreo.mockReset()
})

describe('MVP-04 recuperar la contraseña desde el login del panel', () => {
  it('C1 «¿Olvidaste tu contraseña?» abre un formulario con el correo y un solo h1', async () => {
    await abrirRecuperar()
    const titulo = screen.getByRole('heading', { level: 1, name: 'Recupera tu contraseña' })
    expect(titulo).toHaveFocus()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar enlace' })).toBeInTheDocument()
  })

  it('C1 envía el enlace con sendPasswordResetEmail al correo escrito', async () => {
    enviarCorreo.mockResolvedValue(undefined)
    const usuario = await abrirRecuperar()
    await usuario.type(screen.getByLabelText('Correo electrónico'), 'barberia@ejemplo.com')
    await usuario.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    expect(enviarCorreo).toHaveBeenCalledTimes(1)
    expect(enviarCorreo).toHaveBeenCalledWith(authFalso, 'barberia@ejemplo.com')
    expect(await screen.findByRole('status')).toHaveTextContent(MENSAJE)
  })

  it('C1 usa el correo que ya estaba escrito en el login', async () => {
    enviarCorreo.mockResolvedValue(undefined)
    const usuario = userEvent.setup()
    abrirLogin()
    await usuario.type(screen.getByPlaceholderText('contacto@tunegocio.com'), 'spa@ejemplo.com')
    await usuario.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }))
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('spa@ejemplo.com')
  })

  it('C2 muestra el mismo mensaje si la cuenta no existe (auth/user-not-found)', async () => {
    enviarCorreo.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/user-not-found' }))
    const usuario = await abrirRecuperar()
    await usuario.type(screen.getByLabelText('Correo electrónico'), 'nadie@ejemplo.com')
    await usuario.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    expect(await screen.findByRole('status')).toHaveTextContent(MENSAJE)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(/user-not-found|no existe|no está registrado/i)
  })

  it('borde: un correo con formato inválido no llama a Firebase y avisa junto al campo', async () => {
    const usuario = await abrirRecuperar()
    const campo = screen.getByLabelText('Correo electrónico')
    await usuario.type(campo, 'sin-arroba')
    await usuario.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe un correo válido.')
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(campo).toHaveAccessibleDescription('Escribe un correo válido.')
    expect(campo).toHaveFocus()
    expect(enviarCorreo).not.toHaveBeenCalled()
  })

  it('borde: si Firebase responde auth/invalid-email avisa junto al campo, sin el mensaje de enviado', async () => {
    enviarCorreo.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/invalid-email' }))
    const usuario = await abrirRecuperar()
    const campo = screen.getByLabelText('Correo electrónico')
    await usuario.type(campo, 'barberia@ejemplo.com')
    await usuario.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Escribe un correo válido.')
    expect(campo).toHaveAccessibleDescription('Escribe un correo válido.')
    expect(campo).toHaveFocus()
    expect(screen.queryByText(MENSAJE)).not.toBeInTheDocument()
  })

  it.each(['auth/network-request-failed', 'auth/too-many-requests'])(
    'borde: con %s muestra un aviso genérico que no revela la cuenta', async (code) => {
      enviarCorreo.mockRejectedValue(Object.assign(new Error('x'), { code }))
      const usuario = await abrirRecuperar()
      await usuario.type(screen.getByLabelText('Correo electrónico'), 'barberia@ejemplo.com')
      await usuario.click(screen.getByRole('button', { name: 'Enviar enlace' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos enviar el correo. Inténtalo de nuevo.')
      expect(screen.queryByText(MENSAJE)).not.toBeInTheDocument()
      // El formulario sigue disponible para reintentar.
      expect(screen.getByRole('button', { name: 'Enviar enlace' })).toBeEnabled()
    })

  it('borde: «Volver a iniciar sesión» regresa al login y devuelve el foco al enlace', async () => {
    const usuario = await abrirRecuperar()
    await usuario.click(screen.getByRole('button', { name: 'Volver a iniciar sesión' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Servia para profesionales' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' })).toHaveFocus()
  })
})
