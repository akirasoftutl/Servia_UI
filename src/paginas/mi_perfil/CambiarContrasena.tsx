import { useEffect, useRef, useState, type FormEvent } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { useAuth } from '../../contextos/AuthContext';

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
export function CambiarContrasena() {
  const { usuario } = useAuth();
  const [valores, setValores] = useState<Record<Campo, string>>({ actual: '', nueva: '', confirmacion: '' });
  const [errores, setErrores] = useState<Errores>({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [exito, setExito] = useState('');
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
    setErrorGeneral('');
    setExito('');
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
      setExito('Listo: cambiaste tu contraseña. Úsala la próxima vez que inicies sesión.');
    } catch (error: unknown) {
      const codigo = (error as { code?: string })?.code;
      if (codigo === 'auth/wrong-password' || codigo === 'auth/invalid-credential') {
        mostrarErrores({ actual: ACTUAL_INCORRECTA });
      } else if (codigo === 'auth/weak-password') {
        mostrarErrores({ nueva: 'La contraseña nueva es muy débil. Elige otra más segura.' });
      } else if (codigo === 'auth/too-many-requests') {
        setErrorGeneral('Demasiados intentos. Inténtalo más tarde.');
      } else {
        setErrorGeneral('No pudimos cambiar la contraseña. Inténtalo de nuevo.');
      }
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="perfil-card mt-4" aria-labelledby="titulo-cambiar-contrasena">
      <div className="perfil-card-body">
        <h2 id="titulo-cambiar-contrasena" className="perfil-section-title mb-2">
          Cambiar contraseña
        </h2>

        {!entraConContrasena ? (
          <p className="perfil-subtitle mb-0">
            Tu cuenta entra con Google; la contraseña se administra en tu cuenta de Google.
          </p>
        ) : (
          <>
            <p className="perfil-subtitle mb-4">
              Escribe tu contraseña actual y la nueva. La nueva debe tener al menos {MINIMO} caracteres.
            </p>

            {exito && <div className="alert alert-success border-0 rounded-4 p-3 mb-3" role="status">{exito}</div>}
            {errorGeneral && <div className="alert alert-danger border-0 rounded-4 p-3 mb-3" role="alert">{errorGeneral}</div>}

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
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? `${id}-error` : undefined}
                      />
                      {error && (
                        <div id={`${id}-error`} className="invalid-feedback" role="alert">
                          {error}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="d-flex justify-content-end mt-4">
                <button type="submit" className="btn-servia-primary" disabled={guardando}>
                  {guardando ? 'Cambiando...' : 'Cambiar contraseña'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
