// La API exige exactamente 10 dígitos (`ActualizarPerfilDto.telefono`): se
// reutiliza la validación única del panel.
export {
  MENSAJE_TELEFONO_INVALIDO,
  MENSAJE_TELEFONO_OBLIGATORIO,
  normalizarTelefono,
  validarTelefono,
} from '../../utilidades/validacion';
