import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router'; 
import { api, ErrorSinConexion, MENSAJE_REQUIERE_CONEXION } from '../../servicios/api';
import { aviso } from '../../servicios/alertas';
import { auth } from '../../servicios/firebase'; 
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useVolver } from '../../utilidades/useVolver';
import { useAccesoGoogle } from '../../utilidades/useAccesoGoogle';
import { BotonGoogle } from '../../componentes/BotonGoogle';
import './Registro.css'; 

interface FormularioRegistro {
  nombreNegocio: string;
  correo: string;
  telefono: string;
  contrasena: string;
}

type ErroresFormulario = Partial<Record<keyof FormularioRegistro, string>>;

export function RegistroNegocio() {
  const navigate = useNavigate();
  const volver = useVolver();
  const { cargandoGoogle, continuarConGoogle } = useAccesoGoogle();
  
  const [form, setForm] = useState<FormularioRegistro>({
    nombreNegocio: '',
    correo: '',
    telefono: '',
    contrasena: '',
  });

  const [errores, setErrores] = useState<ErroresFormulario>({});
  const [cargando, setCargando] = useState<boolean>(false);
  const [errorGlobal, setErrorGlobal] = useState<string>('');
  const [mostrarPassword, setMostrarPassword] = useState<boolean>(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    setErrores({ ...errores, [name]: undefined });
  };

  const validar = (): boolean => {
    const nuevosErrores: ErroresFormulario = {};
    
    if (!form.nombreNegocio.trim()) nuevosErrores.nombreNegocio = 'El nombre es obligatorio';
    if (!form.correo.includes('@')) nuevosErrores.correo = 'Correo inválido';
    
    // Validación de 10 dígitos exactos (como pide la API)
    if (!/^\d{10}$/.test(form.telefono)) {
      nuevosErrores.telefono = 'Debe tener exactamente 10 números (sin espacios ni +52)';
    }
    
    // Validación de mínimo 8 caracteres (como pide la API)
    if (form.contrasena.length < 8) {
      nuevosErrores.contrasena = 'Mínimo 8 caracteres';
    }
    
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorGlobal('');
    
    if (!validar()) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await aviso(MENSAJE_REQUIERE_CONEXION, 'Sin conexión');
      return;
    }
    setCargando(true);

    try {
      await api('/auth/registro/negocio', {
        method: 'POST',
        sinCola: true, // lleva la contraseña: nunca se guarda en la cola offline
        body: JSON.stringify({
          nombreNegocio: form.nombreNegocio,
          correo: form.correo,
          telefono: form.telefono,
          contrasena: form.contrasena,
        }),
      });

      await signInWithEmailAndPassword(auth!, form.correo, form.contrasena);

      navigate('/mi-perfil', { 
        state: { aviso: 'Completa tu perfil para poder publicar servicios' } 
      });

    } catch (error: any) {
      if (error instanceof ErrorSinConexion) {
        await aviso(error.message, 'Sin conexión');
      } else if (error.estado === 409) {
        setErrorGlobal('Ese correo ya tiene una cuenta');
      } else {
        setErrorGlobal(error.message || 'Ocurrió un error. Intenta de nuevo.');
      }
    } finally {
      setCargando(false); 
    }
  };

  return (
    <div className="registro-container">
      
      {/* LADO IZQUIERDO: Formulario de Registro */}
      <div className="registro-form-side">
        
        <div>
          <button 
            type="button"
            onClick={volver}
            className="back-btn"
            aria-label="Volver"
          >
            <ArrowLeft size={24} />
          </button>
        </div>

        <div className="form-wrapper">
          <div className="form-header">
            <h1>Servia para profesionales</h1>
            <p>Registra tu negocio para administrar tus servicios</p>
          </div>

          {/* Error Global */}
          {errorGlobal && (
            <div className="alert-msg alert-error" role="alert">
              {errorGlobal}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            
            {/* Nombre del Negocio */}
            <div className="form-group">
              <label className="form-label">Nombre del Negocio</label>
              <input 
                type="text" 
                name="nombreNegocio" 
                className="form-input"
                placeholder="Ej. Barbería El Bigote"
                value={form.nombreNegocio} 
                onChange={handleChange} 
                disabled={cargando}
              />
              {errores.nombreNegocio && (
                <span className="text-xs text-red-400 mt-1 block" style={{ color: '#f87171', fontSize: '0.75rem' }}>
                  {errores.nombreNegocio}
                </span>
              )}
            </div>

            {/* Correo Electrónico */}
            <div className="form-group">
              <label className="form-label">Correo electrónico</label>
              <input 
                type="email" 
                name="correo" 
                className="form-input"
                placeholder="contacto@tunegocio.com"
                value={form.correo} 
                onChange={handleChange} 
                disabled={cargando}
              />
              {errores.correo && (
                <span className="text-xs text-red-400 mt-1 block" style={{ color: '#f87171', fontSize: '0.75rem' }}>
                  {errores.correo}
                </span>
              )}
            </div>

            {/* Teléfono */}
            <div className="form-group">
              <label className="form-label">Teléfono (10 dígitos)</label>
              <input 
                type="tel" 
                name="telefono" 
                className="form-input"
                placeholder="Ej. 4771234567"
                value={form.telefono} 
                onChange={handleChange} 
                disabled={cargando}
              />
              {errores.telefono && (
                <span className="text-xs text-red-400 mt-1 block" style={{ color: '#f87171', fontSize: '0.75rem' }}>
                  {errores.telefono}
                </span>
              )}
            </div>

            {/* Contraseña */}
            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <div className="input-wrapper">
                <input 
                  type={mostrarPassword ? 'text' : 'password'} 
                  name="contrasena" 
                  className="form-input password-input"
                  placeholder="Mínimo 8 caracteres"
                  value={form.contrasena} 
                  onChange={handleChange} 
                  disabled={cargando}
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
              {errores.contrasena && (
                <span className="text-xs text-red-400 mt-1 block" style={{ color: '#f87171', fontSize: '0.75rem' }}>
                  {errores.contrasena}
                </span>
              )}
            </div>

            <button 
              type="submit" 
              className="submit-btn"
              disabled={cargando || cargandoGoogle}
            >
              {cargando ? 'Registrando...' : 'REGISTRARSE'}
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
            deshabilitado={cargando}
          />
        </div>

        {/* Footer con enlace a Login */}
        <div className="form-footer">
          <p>
            ¿Ya tienes una cuenta?{' '}
            <Link to="/login">Inicia sesión</Link>
          </p>
        </div>

      </div>

      <div className="registro-hero-side">
        <img
          src="./galeria_home/registro3.jpg"
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