import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../servicios/api';

interface Categoria {
  id: string;
  nombre: string;
}

interface PerfilNegocio {
  nombre: string;
  descripcion: string;
  categoriaId: string;
  telefono: string;
  correoContacto: string;
  direccion: string;
  perfilCompleto: boolean;
  camposFaltantes: string[];
}

export function MiPerfil() {
  const navigate = useNavigate();
  const [form, setForm] = useState<PerfilNegocio>({
    nombre: '',
    descripcion: '',
    categoriaId: '',
    telefono: '',
    correoContacto: '',
    direccion: '',
    perfilCompleto: false,
    camposFaltantes: [],
  });

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const cats = await api<Categoria[]>('/categorias');
        setCategorias(cats);

        const perfil = await api<PerfilNegocio>('/negocios/mio');
        setForm(perfil);
      } catch (error) {
        console.error('Error al cargar datos:', error);
      } finally {
        setCargando(false);
      }
    };
    cargarDatos();
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    setErrores({ ...errores, [name]: '' });
  };

  const handleCategoriaChange = (id: string) => {
    setForm({ ...form, categoriaId: id });
    setErrores({ ...errores, categoriaId: '' });
  };

  const validar = (): boolean => {
    const nuevosErrores: Record<string, string> = {};
    if (!form.nombre.trim()) nuevosErrores.nombre = 'El nombre es obligatorio';
    if (!form.descripcion.trim()) nuevosErrores.descripcion = 'La descripción es obligatoria';
    if (!form.categoriaId) nuevosErrores.categoriaId = 'Selecciona una categoría';
    if (!form.telefono.trim()) nuevosErrores.telefono = 'El teléfono es obligatorio';
    if (!form.correoContacto.includes('@')) nuevosErrores.correoContacto = 'Correo inválido';
    if (!form.direccion.trim()) nuevosErrores.direccion = 'La dirección es obligatoria';

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMensajeExito('');
    
    if (!validar()) return;

    setGuardando(true);
    try {
      const { nombre, descripcion, categoriaId, telefono, correoContacto, direccion } = form;
      const respuesta = await api<PerfilNegocio>('/negocios/mio', {
        method: 'PUT',
        body: JSON.stringify({ nombre, descripcion, categoriaId, telefono, correoContacto, direccion }),
      });
      
      setForm(respuesta); 
      setMensajeExito('Perfil actualizado correctamente.');
    } catch (error: any) {
      alert(error.message || 'Error al guardar el perfil');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100 bg-white">
        <div className="spinner-border" role="status" style={{ color: '#e27441' }}>
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-vh-100 py-5 px-3 px-md-5">
      <div className="container" style={{ maxWidth: '850px' }}>
        
        {/* Encabezado */}
        <div className="mb-4 d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <h2 className="fw-bold mb-1 text-dark">Perfil del negocio</h2>
            <p className="text-secondary m-0">Gestiona y actualiza la información pública de tu establecimiento.</p>
          </div>
          <span className={`badge px-3 py-2 rounded-pill fs-7 ${form.perfilCompleto ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'}`}>
            {form.perfilCompleto ? '✓ Perfil Público y Activo' : '⚠ Perfil Incompleto'}
          </span>
        </div>

        {/* Banner de alerta si está incompleto */}
        {!form.perfilCompleto && form.camposFaltantes.length > 0 && (
          <div className="alert alert-warning border-0 shadow-sm rounded-4 p-3 mb-4 d-flex align-items-center gap-3">
            <div className="p-2 bg-warning text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: 36, height: 36 }}>
              ⚠️
            </div>
            <div>
              <strong className="d-block text-dark">¡Atención! Completa tu perfil para publicar servicios.</strong>
              <span className="small text-secondary">Campos faltantes: <b>{form.camposFaltantes.join(', ')}</b>.</span>
            </div>
          </div>
        )}

        {/* Banner de éxito */}
        {mensajeExito && (
          <div className="alert alert-success border-0 shadow-sm rounded-4 p-3 mb-4 d-flex align-items-center gap-2">
            <span>✅</span>
            <span className="fw-medium">{mensajeExito}</span>
          </div>
        )}

        {/* Card Principal con Sombra */}
        <div className="card shadow border-0 rounded-4 overflow-hidden">
          <div className="card-body p-4 p-md-5">
            <form onSubmit={handleSubmit}>
              
              {/* SECCIÓN 1: Datos Generales */}
              <div className="mb-4">
                <h5 className="fw-bold text-dark mb-3">Información General</h5>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold text-secondary">Nombre del Negocio *</label>
                    <input 
                      type="text" 
                      name="nombre" 
                      className={`form-control form-control-lg rounded-3 fs-6 ${errores.nombre ? 'is-invalid' : ''}`} 
                      value={form.nombre} 
                      onChange={handleChange} 
                      placeholder="Ej. Estética Bella" 
                    />
                    {errores.nombre && <div className="invalid-feedback">{errores.nombre}</div>}
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-semibold text-secondary">Teléfono de contacto *</label>
                    <input 
                      type="tel" 
                      name="telefono" 
                      className={`form-control form-control-lg rounded-3 fs-6 ${errores.telefono ? 'is-invalid' : ''}`} 
                      value={form.telefono} 
                      onChange={handleChange} 
                      placeholder="Ej. 477 123 4567" 
                    />
                    {errores.telefono && <div className="invalid-feedback">{errores.telefono}</div>}
                  </div>

                  <div className="col-12">
                    <label className="form-label small fw-semibold text-secondary">Descripción corta *</label>
                    <textarea 
                      name="descripcion" 
                      rows={3}
                      className={`form-control rounded-3 fs-6 ${errores.descripcion ? 'is-invalid' : ''}`} 
                      value={form.descripcion} 
                      onChange={handleChange} 
                      placeholder="Cuéntales a tus clientes qué servicios ofreces y qué te distingue..." 
                    />
                    {errores.descripcion && <div className="invalid-feedback">{errores.descripcion}</div>}
                  </div>
                </div>
              </div>

              <hr className="my-4 text-muted opacity-25" />

              {/* SECCIÓN 2: Ubicación y Contacto */}
              <div className="mb-4">
                <h5 className="fw-bold text-dark mb-3">Ubicación y Correo</h5>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold text-secondary">Correo electrónico público *</label>
                    <input 
                      type="email" 
                      name="correoContacto" 
                      className={`form-control form-control-lg rounded-3 fs-6 ${errores.correoContacto ? 'is-invalid' : ''}`} 
                      value={form.correoContacto} 
                      onChange={handleChange} 
                      placeholder="Ej. contacto@negocio.com" 
                    />
                    {errores.correoContacto && <div className="invalid-feedback">{errores.correoContacto}</div>}
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-semibold text-secondary">Dirección física *</label>
                    <input 
                      type="text" 
                      name="direccion" 
                      className={`form-control form-control-lg rounded-3 fs-6 ${errores.direccion ? 'is-invalid' : ''}`} 
                      value={form.direccion} 
                      onChange={handleChange} 
                      placeholder="Ej. Av. Juárez 123, León, Gto." 
                    />
                    {errores.direccion && <div className="invalid-feedback">{errores.direccion}</div>}
                  </div>
                </div>
              </div>

              <hr className="my-4 text-muted opacity-25" />

              {/* SECCIÓN 3: Selección de Categoría */}
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="fw-bold text-dark mb-0">Categoría del Negocio *</h5>
                  <span className="small text-muted">Selecciona una opción</span>
                </div>

                <div className="row g-3">
                  {categorias.map((cat) => {
                    const seleccionada = form.categoriaId === cat.id;
                    return (
                      <div className="col-sm-6 col-md-4" key={cat.id}>
                        <div 
                          onClick={() => handleCategoriaChange(cat.id)}
                          className={`p-3 rounded-3 border d-flex align-items-center justify-content-between ${
                            seleccionada 
                              ? 'border-2 bg-white shadow-sm' 
                              : 'bg-light border-light-subtle text-secondary'
                          }`}
                          style={{ 
                            cursor: 'pointer',
                            borderColor: seleccionada ? '#e27441' : undefined,
                            transition: 'all 0.2s ease-in-out'
                          }}
                        >
                          <span className={`fw-medium fs-6 ${seleccionada ? 'text-dark fw-bold' : ''}`}>
                            {cat.nombre}
                          </span>
                          <div 
                            className="rounded-circle border d-flex align-items-center justify-content-center"
                            style={{
                              width: 20,
                              height: 20,
                              borderColor: seleccionada ? '#e27441' : '#ccc',
                              backgroundColor: seleccionada ? '#e27441' : 'transparent'
                            }}
                          >
                            {seleccionada && <span className="text-white small" style={{ fontSize: '10px' }}>✓</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {errores.categoriaId && <div className="text-danger small mt-2">{errores.categoriaId}</div>}
              </div>

              {/* FOOTER Y ACCIONES */}
              <div className="pt-4 border-top d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div className="d-flex align-items-center gap-2">
                  <button 
                    type="submit" 
                    className="btn btn-lg text-white px-4 py-2.5 fs-6 fw-semibold rounded-3 shadow-sm d-flex align-items-center gap-2" 
                    style={{ backgroundColor: '#e27441' }} 
                    disabled={guardando}
                  >
                    {guardando ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        Guardando...
                      </>
                    ) : (
                      'Guardar cambios'
                    )}
                  </button>

                  <Link to="/servicios" className="btn btn-lg btn-outline-secondary px-4 py-2.5 fs-6 rounded-3">
                    Ir a Servicios
                  </Link>
                </div>

                <span className="text-muted small">* Todos los campos son obligatorios.</span>
              </div>

            </form>
          </div>
        </div>

      </div>
    </div>
  );
}