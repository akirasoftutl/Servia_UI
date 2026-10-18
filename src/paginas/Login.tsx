import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../servicios/firebase';
import { api, ErrorApi } from '../servicios/api';

export function Login() {
  const navigate = useNavigate();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      // 1. Login con Firebase
      await signInWithEmailAndPassword(auth!, correo, password);
      
      // 2. Verificar tipo de cuenta con la API
      const respuesta = await api<{ tipo: string }>('/auth/yo');

      if (respuesta.tipo !== 'negocio') {
        await auth!.signOut();
        setError('Este panel es para negocios. Si eres cliente, usa la app de Servia.');
        return;
      }

      // 3. Si es negocio, adentro
      navigate('/mi-perfil'); 
    } catch (error: any) {
      // TRUCO: Imprimimos el error en consola para ver qué es
      console.log("ERROR REAL:", error); 

      // Si el error viene de Firebase Auth (credenciales malas)
      if (error.code?.includes('auth/')) {
        setError('Correo o contraseña incorrectos');
      } 
      // Si el error viene de nuestra API (ej. 403 desactivado)
      else if (error.estado === 403) {
        await auth!.signOut();
        setError('Tu cuenta está desactivada. Contacta al soporte.');
      } 
      // Cualquier otro error, lo mostramos
      else {
        setError('Ocurrió un error al iniciar sesión.');
      }
    } finally {
      setCargando(false);
    }
  };

    return (
  
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      
      
      <div className="card shadow-sm border-0" style={{ maxWidth: '400px', width: '100%', borderRadius: '12px' }}>
        <div className="card-body p-4 p-md-5">
          
         
          <div className="text-center mb-4">
            <h2 className="fw-bold" style={{ color: '#e27441' }}>Servia</h2>
            <h5 className="text-muted mb-0">Iniciar Sesión</h5>
          </div>

          {error && <div className="alert alert-danger py-2 text-center" role="alert">{error}</div>}

          <form onSubmit={handleSubmit}>
            
          
            <div className="mb-3">
              <label className="form-label text-muted small">Correo electrónico</label>
              <input 
                type="email" 
                className="form-control" 
                placeholder="tu@correo.com"
                value={correo} 
                onChange={(e) => setCorreo(e.target.value)} 
                disabled={cargando}
                required
              />
            </div>

           
            <div className="mb-3">
              <label className="form-label text-muted small">Contraseña</label>
              <input 
                type="password" 
                className="form-control" 
                placeholder="Contraseña"
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                disabled={cargando}
                required
              />
            </div>

   
            <div className="form-check mb-4">
              <input className="form-check-input" type="checkbox" id="recordarme" />
              <label className="form-check-label text-muted small" htmlFor="recordarme">
                Recuérdame
              </label>
            </div>

            
            <button 
              type="submit" 
              className="btn w-100 fw-bold text-white" 
              style={{ backgroundColor: '#e27441', padding: '0.6rem', borderRadius: '8px' }}
              disabled={cargando}
            >
              {cargando ? 'Entrando...' : 'ENTRAR'}
            </button>
          </form>

         
          <div className="text-center mt-4 small">
            <Link to="/recuperar" className="text-decoration-none text-muted d-block mb-1">
              ¿Olvidaste tu contraseña?
            </Link>
            <Link to="/registro-negocio" className="text-decoration-none fw-bold" style={{ color: '#e27441' }}>
              ¿No tienes cuenta? Regístrate
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}