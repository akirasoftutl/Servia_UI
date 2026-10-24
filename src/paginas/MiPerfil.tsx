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
  
  // Estado para controlar el paso actual (1, 2 o 3)
  const [pasoActual, setPasoActual] = useState<number>(1);

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

  // Estados adicionales para los campos extendidos de la UI
  const [camposExtra, setCamposExtra] = useState({
    email: '',
    colonia: '',
    codigoPostal: '',
    ciudad: '',
    estado: '',
    referencias: '',
  });

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');

  // Estado local para la vista previa de la imagen
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);

  // Estilo reutilizable para el gradiente morado a rosa
  const gradientStyle = {
    background: 'linear-gradient(135deg, #7e22ce 0%, #ec4899 100%)',
  };

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
    if (['email', 'colonia', 'codigoPostal', 'ciudad', 'estado', 'referencias'].includes(name)) {
      setCamposExtra({ ...camposExtra, [name]: value });
    } else {
      setForm({ ...form, [name]: value });
    }
    setErrores({ ...errores, [name]: '' });
  };

  const handleCategoriaChange = (id: string) => {
    setForm({ ...form, categoriaId: id });
    setErrores({ ...errores, categoriaId: '' });
  };

  const handleImagenChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagenPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Validación por paso individual
  const validarPaso = (paso: number): boolean => {
    const nuevosErrores: Record<string, string> = {};

    if (paso === 1) {
      if (!form.nombre.trim()) nuevosErrores.nombre = 'El nombre es obligatorio';
      if (!form.telefono.trim()) nuevosErrores.telefono = 'El teléfono es obligatorio';
      if (!camposExtra.email.includes('@')) nuevosErrores.email = 'Correo inválido';
      if (!form.descripcion.trim()) nuevosErrores.descripcion = 'La descripción es obligatoria';
    }

    if (paso === 2) {
      if (!form.direccion.trim()) nuevosErrores.direccion = 'La calle y número son obligatorios';
      if (!camposExtra.codigoPostal.trim()) nuevosErrores.codigoPostal = 'El código postal es obligatorio';
      if (!camposExtra.ciudad.trim()) nuevosErrores.ciudad = 'La ciudad es obligatoria';
      if (!camposExtra.estado.trim()) nuevosErrores.estado = 'El estado es obligatorio';
    }

    if (paso === 3) {
      if (!form.categoriaId) nuevosErrores.categoriaId = 'Selecciona una categoría';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleSiguiente = () => {
    if (validarPaso(pasoActual)) {
      setPasoActual((prev) => Math.min(prev + 1, 3));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleAnterior = () => {
    setPasoActual((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMensajeExito('');

    if (!validarPaso(3)) return;

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
        <div className="spinner-border text-dark" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-vh-100 py-5 px-3 px-md-5">
      <div className="container" style={{ maxWidth: '850px' }}>

        {/* BANNERS DE ESTADO */}
        {!form.perfilCompleto && form.camposFaltantes.length > 0 && (
          <div className="alert alert-warning border-0 shadow-lg rounded-4 p-3 mb-4 d-flex align-items-center gap-3">
            <div className="p-2 bg-warning text-dark rounded-circle d-flex align-items-center justify-content-center" style={{ width: 36, height: 36 }}>
              ⚠️
            </div>
            <div>
              <strong className="d-block text-dark">¡Atención! Completa tu perfil para publicar servicios.</strong>
              <span className="small text-secondary">Campos faltantes: <b>{form.camposFaltantes.join(', ')}</b>.</span>
            </div>
          </div>
        )}

        {mensajeExito && (
          <div className="alert alert-success border-0 shadow-lg rounded-4 p-3 mb-4 d-flex align-items-center gap-2">
            <span>✅</span>
            <span className="fw-medium text-dark">{mensajeExito}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {/* CARD 1: INFORMACIÓN GENERAL */}
          {pasoActual === 1 && (
            <div className="card shadow-lg border-0 rounded-4 overflow-hidden mb-4">
              <div className="card-body p-4 p-md-5">
                <div className="border-bottom pb-4 mb-4">
                  <h2 className="fw-bold mb-1 text-black">Perfil del negocio</h2>
                  <p className="text-secondary m-0">Gestiona y actualiza la información pública de tu establecimiento.</p>
                </div>

                <div className="d-flex align-items-center gap-3 mb-4">
                  <div className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-sm" style={{ width: 32, height: 32, ...gradientStyle }}>
                    1
                  </div>
                  <h5 className="fw-bold text-black m-0">Información General</h5>
                </div>

                <div className="row g-4 align-items-start">
                  <div className="col-md-7 col-lg-8">
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

                      <div className="col-md-6">
                        <label className="form-label small fw-semibold text-secondary">Correo electrónico *</label>
                        <input
                          type="email"
                          name="email"
                          className={`form-control form-control-lg rounded-3 fs-6 ${errores.email ? 'is-invalid' : ''}`}
                          value={camposExtra.email}
                          onChange={handleChange}
                          placeholder="Ej. contacto@negocio.com"
                        />
                        {errores.email && <div className="invalid-feedback">{errores.email}</div>}
                      </div>

                      <div className="col-12">
                        <label className="form-label small fw-semibold text-secondary">Descripción corta *</label>
                        <textarea
                          name="descripcion"
                          rows={4}
                          className={`form-control rounded-3 fs-6 ${errores.descripcion ? 'is-invalid' : ''}`}
                          value={form.descripcion}
                          onChange={handleChange}
                          placeholder="Cuéntales a tus clientes qué servicios ofreces y qué te distingue..."
                        />
                        {errores.descripcion && <div className="invalid-feedback">{errores.descripcion}</div>}
                      </div>
                    </div>
                  </div>

                  <div className="col-md-5 col-lg-4 text-center">
                    <label className="form-label small fw-semibold text-secondary mb-3 d-block text-md-start">
                      Imagen de portada / Logo
                    </label>

                    <div
                      className="d-flex align-items-center justify-content-center overflow-hidden position-relative mx-auto mb-3 rounded-4 shadow-sm"
                      style={{ width: '100%', maxWidth: '240px', height: '240px' }}
                    >
                      {imagenPreview ? (
                        <img src={imagenPreview} alt="Preview" className="w-100 h-100 object-fit-cover" />
                      ) : (
                        <div className="text-center p-4 text-secondary bg-light rounded-4 w-100 h-100 d-flex flex-column align-items-center justify-content-center">
                          <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="opacity-50 mb-2">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="small">Sin foto</span>
                        </div>
                      )}
                    </div>

                    <div className="mx-auto" style={{ maxWidth: '240px' }}>
                      <input
                        type="file"
                        id="logo-upload"
                        accept="image/*"
                        className="d-none"
                        onChange={handleImagenChange}
                      />
                      <label
                        htmlFor="logo-upload"
                        className="btn btn-sm btn-dark rounded-3 px-3 py-2 fw-medium shadow-sm mb-2 w-100"
                        style={{ cursor: 'pointer' }}
                      >
                        {imagenPreview ? 'Cambiar imagen' : 'Seleccionar imagen'}
                      </label>
                      <p className="text-secondary small m-0" style={{ fontSize: '11px' }}>
                        Máx 5MB.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CARD 2: UBICACIÓN Y CONTACTO */}
          {pasoActual === 2 && (
            <div className="card shadow-lg border-0 rounded-4 overflow-hidden mb-4">
              <div className="card-body p-4 p-md-5">
                <div className="border-bottom pb-4 mb-4">
                  <h2 className="fw-bold mb-1 text-black">Perfil del negocio</h2>
                  <p className="text-secondary m-0">Gestiona y actualiza la ubicación física de tu establecimiento.</p>
                </div>

                <div className="d-flex align-items-center gap-3 mb-4">
                  <div className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-sm" style={{ width: 32, height: 32, ...gradientStyle }}>
                    2
                  </div>
                  <h5 className="fw-bold text-black m-0">Ubicación y Contacto</h5>
                </div>

                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label small fw-semibold text-secondary">Calle y número *</label>
                    <input
                      type="text"
                      name="direccion"
                      className={`form-control form-control-lg rounded-3 fs-6 ${errores.direccion ? 'is-invalid' : ''}`}
                      value={form.direccion}
                      onChange={handleChange}
                      placeholder="Ej. Av. Juárez 123"
                    />
                    {errores.direccion && <div className="invalid-feedback">{errores.direccion}</div>}
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-semibold text-secondary">Colonia / Asentamiento</label>
                    <input
                      type="text"
                      name="colonia"
                      className={`form-control form-control-lg rounded-3 fs-6 ${errores.colonia ? 'is-invalid' : ''}`}
                      value={camposExtra.colonia}
                      onChange={handleChange}
                      placeholder="Ej. Centro"
                    />
                    {errores.colonia && <div className="invalid-feedback">{errores.colonia}</div>}
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-semibold text-secondary">Código Postal *</label>
                    <input
                      type="text"
                      name="codigoPostal"
                      className={`form-control form-control-lg rounded-3 fs-6 ${errores.codigoPostal ? 'is-invalid' : ''}`}
                      value={camposExtra.codigoPostal}
                      onChange={handleChange}
                      placeholder="Ej. 37000"
                    />
                    {errores.codigoPostal && <div className="invalid-feedback">{errores.codigoPostal}</div>}
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-semibold text-secondary">Ciudad / Municipio *</label>
                    <input
                      type="text"
                      name="ciudad"
                      className={`form-control form-control-lg rounded-3 fs-6 ${errores.ciudad ? 'is-invalid' : ''}`}
                      value={camposExtra.ciudad}
                      onChange={handleChange}
                      placeholder="Ej. León"
                    />
                    {errores.ciudad && <div className="invalid-feedback">{errores.ciudad}</div>}
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-semibold text-secondary">Estado *</label>
                    <input
                      type="text"
                      name="estado"
                      className={`form-control form-control-lg rounded-3 fs-6 ${errores.estado ? 'is-invalid' : ''}`}
                      value={camposExtra.estado}
                      onChange={handleChange}
                      placeholder="Ej. Guanajuato"
                    />
                    {errores.estado && <div className="invalid-feedback">{errores.estado}</div>}
                  </div>

                  <div className="col-12">
                    <label className="form-label small fw-semibold text-secondary">Referencias de ubicación</label>
                    <input
                      type="text"
                      name="referencias"
                      className={`form-control form-control-lg rounded-3 fs-6 ${errores.referencias ? 'is-invalid' : ''}`}
                      value={camposExtra.referencias}
                      onChange={handleChange}
                      placeholder="Ej. Entre calle 5 de Mayo y Madero, frente a la plaza."
                    />
                    {errores.referencias && <div className="invalid-feedback">{errores.referencias}</div>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CARD 3: CATEGORÍA DEL NEGOCIO */}
          {pasoActual === 3 && (
            <div className="card shadow-lg border-0 rounded-4 overflow-hidden mb-4">
              <div className="card-body p-4 p-md-5">
                <div className="border-bottom pb-4 mb-4">
                  <h2 className="fw-bold mb-1 text-black">Perfil del negocio</h2>
                  <p className="text-secondary m-0">Selecciona el sector al que pertenece tu establecimiento.</p>
                </div>

                <div className="d-flex align-items-center justify-content-between mb-4">
                  <div className="d-flex align-items-center gap-3">
                    <div className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-sm" style={{ width: 32, height: 32, ...gradientStyle }}>
                      3
                    </div>
                    <h5 className="fw-bold text-black m-0">Categoría del Negocio</h5>
                  </div>
                  <span className="small text-secondary">Selecciona una opción</span>
                </div>

                <div className="row g-3">
                  {categorias.map((cat) => {
                    const seleccionada = form.categoriaId === cat.id;
                    return (
                      <div className="col-sm-6 col-md-4" key={cat.id}>
                        <div
                          onClick={() => handleCategoriaChange(cat.id)}
                          className="rounded-4 position-relative overflow-hidden shadow-sm d-flex align-items-end p-3"
                          style={{
                            cursor: 'pointer',
                            height: '180px',
                            backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 60%, transparent 100%), url('https://images.unsplash.com/photo-1521737852567-6949f3f9f2b5')`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            border: seleccionada ? '4px solid #ec4899' : '1px solid #dee2e6',
                            boxShadow: seleccionada ? '0 0 0 4px rgba(236, 72, 153, 0.25)' : '0 .125rem .25rem rgba(0,0,0,.075)',
                            transition: 'all 0.2s ease-in-out'
                          }}
                        >
                          <div className="w-100 text-white z-1">
                            <span className="fw-bold fs-6 d-block">
                              {cat.nombre}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {errores.categoriaId && <div className="text-danger small mt-2">{errores.categoriaId}</div>}
              </div>
            </div>
          )}

          {/* CONTROLES DE NAVEGACIÓN Y ACCIÓN */}
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 pt-2 mb-5">
            <div>
              {pasoActual > 1 && (
                <button 
                  type="button" 
                  onClick={handleAnterior}
                  className="btn btn-lg btn-outline-dark px-4 py-2.5 fs-6 rounded-3"
                >
                  ← Anterior
                </button>
              )}
            </div>

            <div className="d-flex align-items-center gap-2 ms-auto">
              {pasoActual < 3 ? (
                <button 
                  type="button" 
                  onClick={handleSiguiente}
                  className="btn btn-lg text-white px-4 py-2.5 fs-6 fw-semibold rounded-3 shadow-lg border-0"
                  style={gradientStyle}
                >
                  Siguiente 
                </button>
              ) : (
                <button 
                  type="submit" 
                  className="btn btn-lg text-white px-4 py-2.5 fs-6 fw-semibold rounded-3 shadow-lg border-0 d-flex align-items-center gap-2" 
                  style={gradientStyle} 
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
              )}

              <Link to="/servicios" className="btn btn-lg btn-outline-secondary px-4 py-2.5 fs-6 rounded-3">
                Ir a Servicios
              </Link>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
}