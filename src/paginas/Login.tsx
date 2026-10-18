import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router'; // Quitamos Link porque vamos a borrar el de registro
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../servicios/firebase';
import { api } from '../servicios/api';

export function Login() {
  const navigate = useNavigate();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [exito, setExito] = useState(''); // Para mostrar el mensaje de "Inició sesión"
  const [cargando, setCargando] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false); // Para el ojito

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setExito('');
    setCargando(true);

    try {
      // 1. Login con Firebase
      await signInWithEmailAndPassword(auth!, correo, password);
      
      // 2. Verificar tipo de cuenta con la API
      const respuesta = await api<{ tipo: string }>('/auth/yo');

      if (respuesta.tipo !== 'negocio') {
        await auth!.signOut();
        setError('Este panel es para negocios. Si eres cliente, usa la app de Servia.');
        setCargando(false);
        return;
      }

      // 3. Mostrar mensaje de éxito antes de redirigir
      setExito('¡Inicio de sesión exitoso! Redirigiendo...');
      
      setTimeout(() => {
        navigate('/mi-perfil');
      }, 1500); // Espera 1.5 segundos para que se lea el mensaje

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
    // Fondo con un degradado suave para mejorar el diseño
    <div className="min-vh-100 d-flex align-items-center justify-content-center" style={{ background: 'linear-gradient(135deg, #fff5f0 0%, #ffd8c2 100%)' }}>
      
      <div className="card shadow-lg border-0" style={{ maxWidth: '420px', width: '100%', borderRadius: '16px' }}>
        <div className="card-body p-4 p-md-5">
          
          <div className="text-center mb-4">
            <h2 className="fw-bold" style={{ color: '#e27441', fontSize: '2.5rem' }}>Servia</h2>
            <p className="text-muted fw-semibold">Panel del Negocio</p>
          </div>

          {/* Mensajes de Error o Éxito */}
          {error && <div className="alert alert-danger py-2 text-center small" role="alert">{error}</div>}
          {exito && <div className="alert alert-success py-2 text-center small" role="alert">{exito}</div>}

          <form onSubmit={handleSubmit}>
            {/* Input Correo con nuevo placeholder */}
            <div className="mb-3">
              <label className="form-label fw-semibold text-secondary small">Correo electrónico</label>
              <input 
                type="email" 
                className="form-control form-control-lg" 
                placeholder="contacto@tunegocio.com" // <-- Placeholder cambiado
                value={correo} 
                onChange={(e) => setCorreo(e.target.value)} 
                disabled={cargando || exito !== ''}
                required
              />
            </div>

            {/* Input Contraseña con botón de ver/ocultar */}
            <div className="mb-4 position-relative">
              <label className="form-label fw-semibold text-secondary small">Contraseña</label>
              <input 
                type={mostrarPassword ? "text" : "password"} // <-- Cambia dinámicamente
                className="form-control form-control-lg" 
                placeholder="Ingresa tu contraseña"
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                disabled={cargando || exito !== ''}
                required
                style={{ paddingRight: '45px' }} // Espacio para el ojito
              />
                          <button 
                type="button"
                className="btn position-absolute end-0 border-0 bg-transparent text-secondary"
                onClick={() => setMostrarPassword(!mostrarPassword)}
                style={{ top: '38px', zIndex: 10 }}
                tabIndex={-1}
              >
                {mostrarPassword ? (
                  // Ojo Abierto (Cuando la contraseña ES VISIBLE)
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                ) : (
                  // Ojo Tachado (Cuando la contraseña ESTÁ OCULTA)
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                )}
              </button>
            </div>

            <button 
              type="submit" 
              className="btn w-100 fw-bold text-white shadow-sm" 
              style={{ backgroundColor: '#e27441', padding: '0.8rem', borderRadius: '10px', fontSize: '1.1rem' }}
              disabled={cargando || exito !== ''}
            >
              {cargando ? 'Validando...' : 'INICIAR SESIÓN'}
            </button>
          </form>

          {/* QUITAMOS EL ENLACE DE REGISTRO COMO PIDIÓ TU COMPAÑERO */}
          <div className="text-center mt-4 small text-muted">
            Acceso exclusivo para negocios registrados.
          </div>

        </div>
      </div>
    </div>
  );
}