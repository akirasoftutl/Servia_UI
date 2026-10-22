import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../servicios/firebase';
import { api } from '../../servicios/api';
import { ArrowLeft, Eye, EyeOff, Smartphone } from 'lucide-react';
import './Login.css'; 

export function Login() {
  const navigate = useNavigate();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);

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
        navigate('/mi-perfil');
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
      
      {/* LADO IZQUIERDO: Formulario de Login */}
      <div className="login-form-side">
        
        <div>
          <button 
            type="button"
            onClick={() => navigate(-1)}
            className="back-btn"
            aria-label="Volver"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        </div>

        <div className="form-wrapper">
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
                <a href="#forgot" className="forgot-link">
                  ¿Olvidaste tu contraseña?
                </a>
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
              disabled={cargando || exito !== ''}
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

          <div className="social-buttons">
            <button
              type="button"
              className="social-btn"
            >
              <Smartphone size={18} />
              <span>Continuar con el celular</span>
            </button>

            <button
              type="button"
              className="social-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.11 0-5.74-2.1-6.68-4.93H1.21v3.15C3.2 21.3 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.32 14.27c-.24-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.21C.44 8.11 0 9.99 0 12s.44 3.89 1.21 5.42l4.11-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.2 2.7 1.21 6.58l4.11 3.15c.94-2.83 3.57-4.98 6.68-4.98z"
                />
              </svg>
              <span>Continuar con Google</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="form-footer">
          <p>Acceso exclusivo para negocios registrados.</p>
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
          src="https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1400&q=80"
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