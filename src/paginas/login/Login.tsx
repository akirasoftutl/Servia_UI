import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../servicios/firebase';
import { api } from '../../servicios/api';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useVolver } from '../../utilidades/useVolver';
import { RecuperarContrasena } from './RecuperarContrasena';
import { BotonGoogle } from '../../componentes/BotonGoogle';
import { useAccesoGoogle } from '../../utilidades/useAccesoGoogle';
import './Login.css'; 

export function Login() {
  const navigate = useNavigate();
  const volver = useVolver();
  const { cargandoGoogle, continuarConGoogle } = useAccesoGoogle();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [recuperando, setRecuperando] = useState(false);
  const enlaceOlvido = useRef<HTMLButtonElement>(null);
  const volverDeRecuperar = useRef(false);

  // Al regresar de «Recupera tu contraseña», el foco vuelve al enlace que la abrió.
  useEffect(() => {
    if (!recuperando && volverDeRecuperar.current) {
      volverDeRecuperar.current = false;
      enlaceOlvido.current?.focus();
    }
  }, [recuperando]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setExito('');
    setCargando(true);

    try {

        await signInWithEmailAndPassword(auth!, correo, password);
      
      const respuesta = await api<{ tipo: string }>('/auth/yo');

      if (respuesta.tipo !== 'negocio') {
        await auth!.signOut();
        setError('Este panel es para negocios. Si eres cliente, usa la app de Servia.');
        setCargando(false);
        return;
      }

      setExito('¡Inicio de sesión exitoso! Redirigiendo...');
      
      setTimeout(() => {
        navigate('/resumen');
      }, 1500);

    } catch (error: any) {
      if (error.code?.includes('auth/')) {
        setError('Correo o contraseña incorrectos');
      } else if (error.estado === 403) {
        await auth!.signOut();
        setError('Tu cuenta está desactivada. Contacta al soporte.');
      } else {
        setError('Ocurrió un error al iniciar sesión.');
      }
      setCargando(false);
    }
  };

  return (
    <div className="login-container">
      
      <div className="login-form-side">
        
        <div>
          <button 
            type="button"
            onClick={volver}
            className="back-btn"
            aria-label="Volver"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        </div>

        <div className="form-wrapper">
          {recuperando ? (
            <RecuperarContrasena
              correoInicial={correo}
              onVolver={() => {
                volverDeRecuperar.current = true;
                setRecuperando(false);
              }}
            />
          ) : (
          <>
            <div className="form-header">
              <h1>Servia para profesionales</h1>
              <p>Inicia sesión para administrar tu negocio</p>
            </div>

            {/* Mensajes de Error o Éxito */}
            {error && <div className="alert-msg alert-error" role="alert">{error}</div>}
            {exito && <div className="alert-msg alert-success" role="alert">{exito}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="contacto@tunegocio.com"
                  disabled={cargando || exito !== ''}
                  required
                  className="form-input"
                />
              </div>
      
              <div className="form-group">
                <div className="label-row">
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    Contraseña
                  </label>
                  <button
                    ref={enlaceOlvido}
                    type="button"
                    className="forgot-link"
                    onClick={() => {
                      setError('');
                      setRecuperando(true);
                    }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="input-wrapper">
                  <input
                    type={mostrarPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ingresa tu contraseña"
                    disabled={cargando || exito !== ''}
                    required
                    className="form-input password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPassword(!mostrarPassword)}
                    className="eye-btn"
                    aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    tabIndex={-1}
                  >
                    {mostrarPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={cargando || cargandoGoogle || exito !== ''}
                className="submit-btn"
              >
                {cargando ? 'Validando...' : 'Iniciar sesión'}
              </button>
            </form>

            <div className="divider">
              <div className="divider-line">
                <hr />
              </div>
              <span>o</span>
            </div>

            <BotonGoogle
              onClick={() => void continuarConGoogle()}
              cargando={cargandoGoogle}
              deshabilitado={cargando || exito !== ''}
            />
          </>
          )}
        </div>

        {/* Footer */}
        <div className="form-footer">
          <p>
            ¿No tienes cuenta?{' '}
            <Link to="/registro-negocio">Regístrate aquí</Link>
          </p>
        </div>
      </div>

      {/* LADO DERECHO: Imagen Hero con el borde curvo */}
      <div className="login-hero-side">
        <div className="hero-curve-wrapper">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M 0,0 Q 80,35 0,100 Z" />
          </svg>
        </div>

        <img
          src="./galeria_home/Login_page.jpg"
          alt="Profesionales de Negocio"
          className="hero-image"
        />

        <div className="hero-gradient" />

        <div className="hero-logo-box">
          <h2>Servia</h2>
          <p>para profesionales</p>
        </div>
      </div>
    </div>
  );
}