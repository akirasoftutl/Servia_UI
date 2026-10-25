import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../servicios/api';

interface PerfilNegocio {
  perfilCompleto: boolean;
  camposFaltantes: string[];
}

export function NuevoServicio() {
  const navigate = useNavigate();
  
  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    duracion: '',
  });

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [publicando, setPublicando] = useState(false);
  
  const [perfilCompleto, setPerfilCompleto] = useState(true);
  const [camposFaltantes, setCamposFaltantes] = useState<string[]>([]);

  useEffect(() => {
    const verificarPerfil = async () => {
      try {
        const perfil = await api<PerfilNegocio>('/negocios/mio');
        setPerfilCompleto(perfil.perfilCompleto);
        setCamposFaltantes(perfil.camposFaltantes || []);
      } catch (error) {
        console.error('Error al verificar perfil:', error);
      } finally {
        setCargando(false);
      }
    };
    verificarPerfil();
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    setErrores({ ...errores, [name]: '' });
  };

  const validar = (): boolean => {
    const nuevosErrores: Record<string, string> = {};
    
    if (!form.nombre.trim()) nuevosErrores.nombre = 'Escribe el nombre del servicio.';
    if (!form.descripcion.trim()) nuevosErrores.descripcion = 'Escribe una descripción.';
    
    const precioNum = Number(form.precio);
    if (form.precio === '' || isNaN(precioNum) || precioNum < 0) {
      nuevosErrores.precio = 'El precio debe ser 0 o más.';
    }

    const duracionNum = Number(form.duracion);
    if (form.duracion === '' || isNaN(duracionNum) || duracionNum < 1 || !Number.isInteger(duracionNum)) {
      nuevosErrores.duracion = 'La duración debe ser de al menos 1 minuto.';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validar()) return;

    setPublicando(true);
    try {
       await api('/negocios/mio/servicios', {
        method: 'POST',
        body: JSON.stringify({
          nombre: form.nombre,
          descripcion: form.descripcion,
          precio: Number(form.precio),
          duracionMin: Number(form.duracion),
        }),
      });

      alert('Servicio publicado.');
      navigate('/servicios'); 
      
    } catch (error: any) {
      if (error.estado === 409) {
        setPerfilCompleto(false);
        if (error.message) setCamposFaltantes([error.message]); 
      } else if (error.estado === 400) {
        alert(error.message || 'Revisa los datos del formulario.');
      } else {
        alert('No pudimos publicar el servicio. Intenta de nuevo.');
      }
    } finally {
      setPublicando(false);
    }
  };

  if (cargando) return <div className="text-center mt-5"><h3>Cargando...</h3></div>;

  return (
    // Fondo gris claro para toda la página, igual que en la imagen
    <div className="min-vh-100 bg-light py-5">
      <div className="container" style={{ maxWidth: '850px' }}>
        
        {/* Encabezado: Título a la izquierda y botón a la derecha */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="fw-bold mb-0 text-dark" style={{ fontSize: '2rem' }}>Nuevo servicio</h2>
          <Link to="/servicios" className="btn btn-outline-secondary bg-white px-4 py-2" style={{ borderRadius: '8px' }}>
            Volver a Mis Servicios
          </Link>
        </div>

        {/* Aviso de perfil incompleto */}
        {!perfilCompleto && (
          <div className="alert alert-warning shadow-sm border-0 mb-4 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 rounded-4">
            <div>
              <strong className="d-block mb-1">Completa tu perfil para publicar servicios.</strong>
              <span className="small">Te falta: {camposFaltantes.join(', ')}.</span>
            </div>
            <Link to="/mi-perfil" className="btn btn-warning fw-bold px-4" style={{ borderRadius: '8px' }}>Ir a Mi perfil</Link>
          </div>
        )}

        {/* Tarjeta contenedora del formulario */}
        <div className="card shadow-sm border-0" style={{ borderRadius: '16px' }}>
          <div className="card-body p-4 p-md-5">
            <fieldset disabled={!perfilCompleto || publicando}>
              <form onSubmit={handleSubmit}>
                
                {/* Campo: Nombre */}
                <div className="mb-4">
                  <label className="form-label fw-semibold text-secondary" style={{ fontSize: '0.9rem' }}>
                    Nombre del servicio *
                  </label>
                  <input 
                    type="text" 
                    name="nombre" 
                    className={`form-control form-control-lg ${errores.nombre ? 'is-invalid' : ''}`} 
                    value={form.nombre} 
                    onChange={handleChange} 
                    placeholder="Ej. Corte de cabello" 
                    style={{ borderRadius: '8px', borderColor: errores.nombre ? '#dc3545' : '#dee2e6' }}
                  />
                  {errores.nombre && <div className="invalid-feedback">{errores.nombre}</div>}
                </div>

                {/* Campo: Descripción */}
                <div className="mb-4">
                  <label className="form-label fw-semibold text-secondary" style={{ fontSize: '0.9rem' }}>
                    Descripción *
                  </label>
                  <textarea 
                    name="descripcion" 
                    className={`form-control ${errores.descripcion ? 'is-invalid' : ''}`} 
                    rows={3} 
                    value={form.descripcion} 
                    onChange={handleChange} 
                    placeholder="Describe brevemente el servicio..."
                    style={{ borderRadius: '8px', borderColor: errores.descripcion ? '#dc3545' : '#dee2e6' }}
                  ></textarea>
                  {errores.descripcion && <div className="invalid-feedback">{errores.descripcion}</div>}
                </div>

                {/* Fila: Precio y Duración */}
                <div className="row g-4 mb-5">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold text-secondary" style={{ fontSize: '0.9rem' }}>
                      Precio (MXN) *
                    </label>
                    <input 
                      type="number" 
                      name="precio" 
                      className={`form-control form-control-lg ${errores.precio ? 'is-invalid' : ''}`} 
                      value={form.precio} 
                      onChange={handleChange} 
                      placeholder="0.00" 
                      min="0" 
                      step="0.01" 
                      style={{ borderRadius: '8px', borderColor: errores.precio ? '#dc3545' : '#dee2e6' }}
                    />
                    {errores.precio && <div className="invalid-feedback">{errores.precio}</div>}
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-semibold text-secondary" style={{ fontSize: '0.9rem' }}>
                      Duración (minutos) *
                    </label>
                    <input 
                      type="number" 
                      name="duracion" 
                      className={`form-control form-control-lg ${errores.duracion ? 'is-invalid' : ''}`} 
                      value={form.duracion} 
                      onChange={handleChange} 
                      placeholder="30" 
                      min="1" 
                      step="1" 
                      style={{ borderRadius: '8px', borderColor: errores.duracion ? '#dc3545' : '#dee2e6' }}
                    />
                    {errores.duracion && <div className="invalid-feedback">{errores.duracion}</div>}
                  </div>
                </div>

                {/* Línea divisoria y botones */}
                <hr className="text-muted mb-4" style={{ opacity: 0.15 }} />
                
                <div className="d-flex align-items-center gap-3">
                  <button 
                    type="submit" 
                    className="btn btn-lg text-white px-5 fw-bold shadow-sm" 
                    style={{ backgroundColor: '#e27441', borderRadius: '50px', minWidth: '200px' }}
                  >
                    {publicando ? 'Publicando...' : 'Publicar servicio'}
                  </button>
                  
                  <Link 
                    to="/servicios" 
                    className="btn btn-lg btn-white bg-white border px-4 text-dark" 
                    style={{ borderRadius: '50px' }}
                  >
                    Cancelar
                  </Link>
                </div>

              </form>
            </fieldset>
          </div>
        </div>
      </div>
    </div>
  );
}