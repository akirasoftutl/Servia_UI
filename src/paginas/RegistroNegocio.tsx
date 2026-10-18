import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router'; 
import { api } from '../servicios/api'; 
import { auth } from '../servicios/firebase'; 
import { signInWithEmailAndPassword } from 'firebase/auth';


interface FormularioRegistro {
  nombre: string;
  correo: string;
  telefono: string;
  password: string;
}

type ErroresFormulario = Partial<Record<keyof FormularioRegistro, string>>;

export function RegistroNegocio() {
  const navigate = useNavigate();
  
  const [form, setForm] = useState<FormularioRegistro>({
    nombre: '',
    correo: '',
    telefono: '',
    password: '',
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
    if (!form.nombre.trim()) nuevosErrores.nombre = 'El nombre es obligatorio';
    if (!form.correo.includes('@')) nuevosErrores.correo = 'Correo inválido';
    if (!form.telefono.trim()) nuevosErrores.telefono = 'El teléfono es obligatorio';
    if (form.password.length < 6) nuevosErrores.password = 'Mínimo 6 caracteres';
    
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
          nombre: form.nombre,
          correo: form.correo,
          telefono: form.telefono,
          password: form.password,
        }),
      });

      await signInWithEmailAndPassword(auth!, form.correo, form.password);

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
                name="nombre" 
                className={`form-control ${errores.nombre ? 'is-invalid' : ''}`}
                placeholder="Ej. Barbería El Bigote"
                value={form.nombre} 
                onChange={handleChange} 
                disabled={cargando}
              />
              {errores.nombre && <div className="invalid-feedback">{errores.nombre}</div>}
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
                placeholder="Ej. +52 55 1234 5678"
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
                name="password" 
                className={`form-control ${errores.password ? 'is-invalid' : ''}`}
                placeholder="Mínimo 6 caracteres"
                value={form.password} 
                onChange={handleChange} 
                disabled={cargando}
              />
              {errores.password && <div className="invalid-feedback">{errores.password}</div>}
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