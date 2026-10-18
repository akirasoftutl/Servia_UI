import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router'; 
import { api } from '../servicios/api'; 
import { auth } from '../servicios/firebase'; 
import { signInWithEmailAndPassword } from 'firebase/auth';

interface FormularioRegistro {
  nombreNegocio: string;
  correo: string;
  telefono: string;
  contrasena: string;
}

type ErroresFormulario = Partial<Record<keyof FormularioRegistro, string>>;

export function RegistroNegocio() {
  const navigate = useNavigate();
  
  const [form, setForm] = useState<FormularioRegistro>({
    nombreNegocio: '',
    correo: '',
    telefono: '',
    contrasena: '',
  });

  const [errores, setErrores] = useState<ErroresFormulario>({});
  const [cargando, setCargando] = useState<boolean>(false);
  const [errorGlobal, setErrorGlobal] = useState<string>('');

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
    setCargando(true);

    try {
      await api('/auth/registro/negocio', {
        method: 'POST',
        body: JSON.stringify({
          nombreNegocio: form.nombreNegocio,
          correo: form.correo,
          telefono: form.telefono,
          contrasena: form.contrasena,
        }),
      });

      await signInWithEmailAndPassword(auth!, form.correo, form.contrasena);

      alert('Tu cuenta se creó correctamente');
      navigate('/mi-perfil', { 
        state: { aviso: 'Completa tu perfil para poder publicar servicios' } 
      });

    } catch (error: any) {
      if (error.estado === 409) {
        setErrorGlobal('Ese correo ya tiene una cuenta');
      } else {
        setErrorGlobal(error.message || 'Ocurrió un error. Intenta de nuevo.');
      }
    } finally {
      setCargando(false); 
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center" style={{ background: 'linear-gradient(135deg, #fff5f0 0%, #ffd8c2 100%)' }}>
      
      <div className="card shadow-lg border-0" style={{ maxWidth: '450px', width: '100%', borderRadius: '1rem' }}>
        <div className="card-body p-5">
          
          <div className="text-center mb-4">
            <h2 className="fw-bold" style={{ color: '#e87a47' }}>Servia</h2>
            <h5 className="text-muted">Registro de Negocio</h5>
          </div>

          {errorGlobal && <div className="alert alert-danger py-2 text-center" role="alert">{errorGlobal}</div>}

          <form onSubmit={handleSubmit}>
            
            <div className="mb-3">
              <label className="form-label fw-semibold">Nombre del Negocio</label>
              <input 
                type="text" 
                name="nombreNegocio" 
                className={`form-control ${errores.nombreNegocio ? 'is-invalid' : ''}`}
                placeholder="Ej. Barbería El Bigote"
                value={form.nombreNegocio} 
                onChange={handleChange} 
                disabled={cargando}
              />
              {errores.nombreNegocio && <div className="invalid-feedback">{errores.nombreNegocio}</div>}
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold">Correo Electrónico</label>
              <input 
                type="email" 
                name="correo" 
                className={`form-control ${errores.correo ? 'is-invalid' : ''}`}
                placeholder="tu@correo.com"
                value={form.correo} 
                onChange={handleChange} 
                disabled={cargando}
              />
              {errores.correo && <div className="invalid-feedback">{errores.correo}</div>}
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold">Teléfono</label>
              <input 
                type="tel" 
                name="telefono" 
                className={`form-control ${errores.telefono ? 'is-invalid' : ''}`}
                placeholder="Ej. 4771234567"
                value={form.telefono} 
                onChange={handleChange} 
                disabled={cargando}
              />
              {errores.telefono && <div className="invalid-feedback">{errores.telefono}</div>}
            </div>

            <div className="mb-4">
              <label className="form-label fw-semibold">Contraseña</label>
              <input 
                type="password" 
                name="contrasena" 
                className={`form-control ${errores.contrasena ? 'is-invalid' : ''}`}
                placeholder="Mínimo 8 caracteres"
                value={form.contrasena} 
                onChange={handleChange} 
                disabled={cargando}
              />
              {errores.contrasena && <div className="invalid-feedback">{errores.contrasena}</div>}
            </div>

            <button 
              type="submit" 
              className="btn w-100 fw-bold text-white shadow-sm" 
              style={{ backgroundColor: '#e87a47', padding: '0.75rem' }}
              disabled={cargando}
            >
              {cargando ? 'Registrando...' : 'REGISTRARSE'}
            </button>
          </form>

          <div className="text-center mt-4">
            <span className="text-muted">¿Ya tienes cuenta? </span>
            <Link to="/login" className="text-decoration-none fw-bold" style={{ color: '#e87a47' }}>
              Inicia sesión
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}