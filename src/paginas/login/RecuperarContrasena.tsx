import { useEffect, useRef, useState, type FormEvent } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../servicios/firebase';

// MVP-04: el mensaje es el mismo exista o no la cuenta, para no revelar qué correos están registrados.
export const MENSAJE_ENLACE_ENVIADO =
  'Si el correo está registrado, te enviamos un enlace para crear una contraseña nueva.';
const MENSAJE_CORREO_INVALIDO = 'Escribe un correo válido.';
const MENSAJE_ERROR_ENVIO = 'No pudimos enviar el correo. Inténtalo de nuevo.';

const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  correoInicial?: string;
  onVolver: () => void;
}

export function RecuperarContrasena({ correoInicial = '', onVolver }: Props) {
  const [correo, setCorreo] = useState(correoInicial);
  const [errorCorreo, setErrorCorreo] = useState('');
  const [errorEnvio, setErrorEnvio] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  const campoCorreo = useRef<HTMLInputElement>(null);

  // Al abrir la vista, el foco pasa a su título para que el lector de pantalla anuncie el cambio.
  useEffect(() => {
    titulo.current?.focus();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorEnvio('');
    const limpio = correo.trim();
    if (!FORMATO_CORREO.test(limpio)) {
      setErrorCorreo(MENSAJE_CORREO_INVALIDO);
      campoCorreo.current?.focus();
      return;
    }
    setErrorCorreo('');
    setEnviando(true);
    try {
      await sendPasswordResetEmail(auth!, limpio);
      setEnviado(true);
    } catch (error: unknown) {
      const codigo = (error as { code?: string })?.code;
      if (codigo === 'auth/user-not-found') {
        // Nunca se revela que la cuenta no existe.
        setEnviado(true);
      } else if (codigo === 'auth/invalid-email') {
        setErrorCorreo(MENSAJE_CORREO_INVALIDO);
        campoCorreo.current?.focus();
      } else {
        // Red, demasiados intentos u otro: un aviso genérico que tampoco revela nada de la cuenta.
        setErrorEnvio(MENSAJE_ERROR_ENVIO);
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <div className="form-header">
        <h1 ref={titulo} tabIndex={-1}>Recupera tu contraseña</h1>
        <p>Escribe el correo de tu negocio y te enviaremos un enlace para crear una contraseña nueva.</p>
      </div>

      {enviado && <div className="alert-msg alert-success" role="status">{MENSAJE_ENLACE_ENVIADO}</div>}
      {errorEnvio && <div className="alert-msg alert-error" role="alert">{errorEnvio}</div>}

      {!enviado && (
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="correo-recuperar">
              Correo electrónico
            </label>
            <input
              ref={campoCorreo}
              id="correo-recuperar"
              type="email"
              autoComplete="email"
              value={correo}
              onChange={(e) => {
                setCorreo(e.target.value);
                setErrorCorreo('');
              }}
              placeholder="contacto@tunegocio.com"
              disabled={enviando}
              aria-invalid={errorCorreo ? true : undefined}
              aria-describedby={errorCorreo ? 'correo-recuperar-error' : undefined}
              className="form-input"
            />
            {errorCorreo && (
              <p id="correo-recuperar-error" className="field-error" role="alert">
                {errorCorreo}
              </p>
            )}
          </div>

          <button type="submit" disabled={enviando} className="submit-btn">
            {enviando ? 'Enviando...' : 'Enviar enlace'}
          </button>
        </form>
      )}

      <button type="button" className="forgot-link back-to-login" onClick={onVolver}>
        Volver a iniciar sesión
      </button>
    </>
  );
}
