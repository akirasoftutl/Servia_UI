import { useEffect, useRef, useState, type FormEvent } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { useAuth } from '../../contextos/AuthContext';
import { BotonPanel } from '../../componentes/panel/BotonPanel';
import { error as alertaError, exito as alertaExito } from '../../servicios/alertas';
import { ErrorCampo } from '../../componentes/panel/ErrorCampo';
import { atributosErrorCampo, idErrorCampo } from '../../utilidades/validacion';

type Campo = 'actual' | 'nueva' | 'confirmacion';
type Errores = Partial<Record<Campo, string>>;

const MINIMO = 8;
const ACTUAL_INCORRECTA = 'La contraseña actual no es correcta.';

const etiquetas: Record<Campo, string> = {
  actual: 'Contraseña actual',
  nueva: 'Contraseña nueva',
  confirmacion: 'Confirma la contraseña nueva',
};

// MVP-04: con la sesión iniciada, el negocio cambia su contraseña con Firebase Authentication (D9).
export function CambiarContrasena({ incrustada = false }: { incrustada?: boolean }) {
  const { usuario } = useAuth();
  const [valores, setValores] = useState<Record<Campo, string>>({ actual: '', nueva: '', confirmacion: '' });
  const [errores, setErrores] = useState<Errores>({});
  const [guardando, setGuardando] = useState(false);
  const campos = {
    actual: useRef<HTMLInputElement>(null),
    nueva: useRef<HTMLInputElement>(null),
    confirmacion: useRef<HTMLInputElement>(null),
  };
  const campoPorEnfocar = useRef<Campo | null>(null);

  // El foco va al primer campo con error, ya habilitado (mientras se guarda los campos están deshabilitados).
  useEffect(() => {
    if (!guardando && campoPorEnfocar.current) {
      campos[campoPorEnfocar.current].current?.focus();
      campoPorEnfocar.current = null;
    }
  });

  if (!usuario) return null;

  // Dentro de otra tarjeta (Configuración) no se anida una tarjeta: es una subsección con título de nivel 3.
  const Contenedor = incrustada ? 'div' : 'section';
  const Titulo = incrustada ? 'h3' : 'h2';

  const entraConContrasena = usuario.providerData.some((p) => p.providerId === 'password');

  const validar = (): Errores => {
    const nuevos: Errores = {};
    if (!valores.actual) nuevos.actual = 'Escribe tu contraseña actual.';
    if (valores.nueva.length < MINIMO) {
      nuevos.nueva = `La contraseña nueva debe tener al menos ${MINIMO} caracteres.`;
    } else if (valores.nueva === valores.actual) {
      nuevos.nueva = 'La contraseña nueva debe ser distinta de la actual.';
    }
    if (!nuevos.nueva && valores.confirmacion !== valores.nueva) {
      nuevos.confirmacion = 'Las contraseñas no coinciden.';
    }
    return nuevos;
  };

  const mostrarErrores = (nuevos: Errores) => {
    setErrores(nuevos);
    const primero = (['actual', 'nueva', 'confirmacion'] as Campo[]).find((c) => nuevos[c]);
    campoPorEnfocar.current = primero ?? null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nuevos = validar();
    if (Object.keys(nuevos).length > 0) {
      mostrarErrores(nuevos);
      return;
    }
    setErrores({});
    setGuardando(true);
    try {
      // Firebase pide volver a autenticarse antes de cambiar la contraseña.
      const credencial = EmailAuthProvider.credential(usuario.email ?? '', valores.actual);
      await reauthenticateWithCredential(usuario, credencial);
      await updatePassword(usuario, valores.nueva);
      setValores({ actual: '', nueva: '', confirmacion: '' });
      await alertaExito('Listo: cambiaste tu contraseña. Úsala la próxima vez que inicies sesión.');
    } catch (error: unknown) {
      const codigo = (error as { code?: string })?.code;
      if (codigo === 'auth/wrong-password' || codigo === 'auth/invalid-credential') {
        mostrarErrores({ actual: ACTUAL_INCORRECTA });
      } else if (codigo === 'auth/weak-password') {
        mostrarErrores({ nueva: 'La contraseña nueva es muy débil. Elige otra más segura.' });
      } else if (codigo === 'auth/too-many-requests') {
        await alertaError('Demasiados intentos. Inténtalo más tarde.');
      } else {
        await alertaError('No pudimos cambiar la contraseña. Inténtalo de nuevo.');
      }
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Contenedor className={incrustada ? 'panel-subseccion' : 'panel-tarjeta perfil-tarjeta-contrasena'} aria-labelledby="titulo-cambiar-contrasena">
      <div className="panel-tarjeta-encabezado">
        <div>
          <Titulo id="titulo-cambiar-contrasena" className={incrustada ? 'panel-item-titulo' : 'panel-tarjeta-titulo'}>
            Cambiar contraseña
          </Titulo>
          <p className="panel-tarjeta-subtitulo">
            {entraConContrasena
              ? `Escribe tu contraseña actual y la nueva. La nueva debe tener al menos ${MINIMO} caracteres.`
              : 'Tu cuenta entra con Google; la contraseña se administra en tu cuenta de Google.'}
          </p>
        </div>
      </div>

      {entraConContrasena && (
        <form onSubmit={handleSubmit} noValidate>
          <div className="row g-3">
            {(['actual', 'nueva', 'confirmacion'] as Campo[]).map((campo) => {
              const id = `contrasena-${campo}`;
              const error = errores[campo];
              return (
                <div className="col-12 col-md-4" key={campo}>
                  <label htmlFor={id} className="form-label">{etiquetas[campo]}</label>
                  <input
                    ref={campos[campo]}
                    id={id}
                    type="password"
                    autoComplete={campo === 'actual' ? 'current-password' : 'new-password'}
                    className={`form-control ${error ? 'is-invalid' : ''}`}
                    value={valores[campo]}
                    onChange={(e) => {
                      setValores({ ...valores, [campo]: e.target.value });
                      setErrores({ ...errores, [campo]: undefined });
                    }}
                    disabled={guardando}
                    {...atributosErrorCampo(id, error)}
                  />
                  <ErrorCampo id={idErrorCampo(id)} mensaje={error} />
                </div>
              );
            })}
          </div>

          <div className="panel-formulario-acciones perfil-contrasena-acciones">
            <BotonPanel type="submit" variante="primario" disabled={guardando}>
              {guardando ? 'Cambiando...' : 'Cambiar contraseña'}
            </BotonPanel>
          </div>
        </form>
      )}
    </Contenedor>
  );
}
