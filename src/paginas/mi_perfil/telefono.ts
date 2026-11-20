// La API exige exactamente 10 dígitos (`ActualizarPerfilDto.telefono`): se
// quitan los espacios, guiones y paréntesis que el usuario suele escribir.
export const MENSAJE_TELEFONO_OBLIGATORIO = 'El teléfono es obligatorio';
export const MENSAJE_TELEFONO_INVALIDO = 'El teléfono debe tener exactamente 10 dígitos, por ejemplo 477 123 4567';

export function normalizarTelefono(valor: string): string {
  return valor.replace(/[\s\-()]/g, '');
}

export function validarTelefono(valor: string): string {
  const limpio = normalizarTelefono(valor);
  if (!limpio) return MENSAJE_TELEFONO_OBLIGATORIO;
  return /^\d{10}$/.test(limpio) ? '' : MENSAJE_TELEFONO_INVALIDO;
}
