import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
<<<<<<< HEAD
import { Link, useNavigate } from 'react-router';
=======
>>>>>>> f9df2f0562ec411822fd6c647c766e5e234fa11d
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
<<<<<<< HEAD
  camposFaltantes: string[];
}

export function MiPerfil() {
  const navigate = useNavigate();
=======
  camposFaltantes: string[]; // La API nos da los nombres de los campos que faltan
}

export function MiPerfil() {
>>>>>>> f9df2f0562ec411822fd6c647c766e5e234fa11d
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

<<<<<<< HEAD
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const cats = await api<Categoria[]>('/categorias');
        setCategorias(cats);

=======
  // 1. Cargar categorías y datos del perfil al entrar
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        // Cargar categorías
        const cats = await api<Categoria[]>('/categorias');
        setCategorias(cats);

        // Cargar perfil actual
>>>>>>> f9df2f0562ec411822fd6c647c766e5e234fa11d
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

<<<<<<< HEAD
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
=======
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
>>>>>>> f9df2f0562ec411822fd6c647c766e5e234fa11d
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    setErrores({ ...errores, [name]: '' });
  };

<<<<<<< HEAD
  const handleCategoriaChange = (id: string) => {
    setForm({ ...form, categoriaId: id });
    setErrores({ ...errores, categoriaId: '' });
  };

=======
>>>>>>> f9df2f0562ec411822fd6c647c766e5e234fa11d
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
<<<<<<< HEAD
=======
      // Solo enviamos los campos que la API espera en el PUT
>>>>>>> f9df2f0562ec411822fd6c647c766e5e234fa11d
      const { nombre, descripcion, categoriaId, telefono, correoContacto, direccion } = form;
      const respuesta = await api<PerfilNegocio>('/negocios/mio', {
        method: 'PUT',
        body: JSON.stringify({ nombre, descripcion, categoriaId, telefono, correoContacto, direccion }),
      });
      
<<<<<<< HEAD
      setForm(respuesta); 
=======
      setForm(respuesta); // Actualizamos con la respuesta (para ver si ya no hay faltantes)
>>>>>>> f9df2f0562ec411822fd6c647c766e5e234fa11d
      setMensajeExito('Perfil guardado correctamente.');
    } catch (error: any) {
      alert(error.message || 'Error al guardar el perfil');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <div className="text-center mt-5"><h3>Cargando perfil...</h3></div>;

  return (
<<<<<<< HEAD
    // Fondo gris claro para toda la pantalla
    <div className="container-fluid bg-light min-vh-100 p-0">
      <div className="row g-0">
        
        {/* BARRA LATERAL (Sidebar) Moderna */}
        <div className="col-md-3 col-lg-2 bg-white border-end p-3 d-flex flex-column" style={{ minHeight: 'calc(100vh - 60px)' }}>
          <h5 className="fw-bold mb-4" style={{ color: '#333' }}>Mi negocio</h5>
          
          <div className="nav flex-column nav-pills gap-2">
            <button className="nav-link text-start text-dark border-0">Reservas</button>
            <button className="nav-link text-start text-dark border-0">Servicios</button>
            <button className="nav-link text-start text-dark border-0">Horario</button>
            
            {/* Botón Activo */}
            <button className="nav-link text-start border-0 text-white fw-bold" style={{ backgroundColor: '#e27441' }}>
              Perfil
            </button>
            
            <button className="nav-link text-start text-dark border-0">Avisos (2)</button>
          </div>

          <div className="mt-auto pt-4">
            <button className="btn btn-outline-danger w-100 rounded-pill" onClick={() => navigate('/login')}>
              Cerrar sesión
            </button>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="col-md-9 col-lg-10 p-4 p-md-5">
          <div className="mb-4">
            <h2 className="fw-bold mb-1">Perfil del negocio</h2>
            <p className="text-muted">Completa tu información para que los clientes puedan encontrarte.</p>
          </div>

          {/* Aviso de perfil incompleto (Estilo Bootstrap alert) */}
          {!form.perfilCompleto && form.camposFaltantes.length > 0 && (
            <div className="alert alert-warning shadow-sm border-0 d-flex align-items-center mb-4" role="alert">
              <div>
                <strong className="d-block mb-1">¡Atención! Completa tu perfil para publicar servicios.</strong>
                <span className="small">Te falta llenar: {form.camposFaltantes.join(', ')}.</span>
              </div>
            </div>
          )}

          {mensajeExito && <div className="alert alert-success shadow-sm border-0 mb-4">{mensajeExito}</div>}

          {/* Tarjeta blanca para el formulario */}
          <div className="card shadow-sm border-0 rounded-4">
            <div className="card-body p-4 p-md-5">
              <form onSubmit={handleSubmit}>
                <div className="row g-4">
                  
                  {/* Fila 1 */}
                  <div className="col-md-6">
                    <label className="form-label fw-semibold text-secondary">Nombre del Negocio *</label>
                    <input type="text" name="nombre" className={`form-control form-control-lg ${errores.nombre ? 'is-invalid' : ''}`} value={form.nombre} onChange={handleChange} placeholder="Ej. Estética Bella" />
                    {errores.nombre && <div className="invalid-feedback">{errores.nombre}</div>}
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-semibold text-secondary">Descripción *</label>
                    <input type="text" name="descripcion" className={`form-control form-control-lg ${errores.descripcion ? 'is-invalid' : ''}`} value={form.descripcion} onChange={handleChange} placeholder="Ej. Especialistas en cuidado personal" />
                    {errores.descripcion && <div className="invalid-feedback">{errores.descripcion}</div>}
                  </div>

                  {/* Fila 2 */}
                  <div className="col-md-6">
                    <label className="form-label fw-semibold text-secondary">Teléfono *</label>
                    <input type="tel" name="telefono" className={`form-control form-control-lg ${errores.telefono ? 'is-invalid' : ''}`} value={form.telefono} onChange={handleChange} placeholder="Ej. 477 123 4567" />
                    {errores.telefono && <div className="invalid-feedback">{errores.telefono}</div>}
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-semibold text-secondary">Correo de contacto *</label>
                    <input type="email" name="correoContacto" className={`form-control form-control-lg ${errores.correoContacto ? 'is-invalid' : ''}`} value={form.correoContacto} onChange={handleChange} placeholder="Ej. contacto@negocio.com" />
                    {errores.correoContacto && <div className="invalid-feedback">{errores.correoContacto}</div>}
                  </div>

                  {/* Fila 3 */}
                  <div className="col-12">
                    <label className="form-label fw-semibold text-secondary">Dirección *</label>
                    <input type="text" name="direccion" className={`form-control form-control-lg ${errores.direccion ? 'is-invalid' : ''}`} value={form.direccion} onChange={handleChange} placeholder="Ej. Av. Juárez 123, León, Gto." />
                    {errores.direccion && <div className="invalid-feedback">{errores.direccion}</div>}
                  </div>

                  {/* Fila 4: Categorías (Con un diseño más limpio) */}
                  <div className="col-12 mt-4">
                    <label className="form-label fw-semibold text-secondary mb-3">Categoría * · Selecciona una del catálogo</label>
                    <div className={`bg-light p-4 rounded-3 border ${errores.categoriaId ? 'border-danger' : ''}`}>
                      <div className="row">
                        {categorias.map((cat) => (
                          <div className="col-md-6 mb-2" key={cat.id}>
                            <div className="form-check">
                              <input 
                                className="form-check-input" 
                                type="radio" 
                                name="categoria" 
                                id={`cat-${cat.id}`} 
                                checked={form.categoriaId === cat.id}
                                onChange={() => handleCategoriaChange(cat.id)}
                                style={{ cursor: 'pointer' }}
                              />
                              <label className="form-check-label" htmlFor={`cat-${cat.id}`} style={{ cursor: 'pointer' }}>
                                {cat.nombre}
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {errores.categoriaId && <div className="text-danger small mt-2">{errores.categoriaId}</div>}
                  </div>

                </div>

                {/* Botones de acción */}
                <div className="mt-5 d-flex flex-wrap align-items-center gap-3 border-top pt-4">
                  <button type="submit" className="btn btn-lg text-white px-5 fw-bold rounded-pill shadow-sm" style={{ backgroundColor: '#e27441' }} disabled={guardando}>
                    {guardando ? 'Guardando...' : 'Guardar perfil'}
                  </button>
                  <Link to="/servicios" className="btn btn-lg btn-light px-4 rounded-pill border">
                    Ir a Servicios
                  </Link>
                  <span className="text-muted small ms-auto">Todos los campos con (*) son obligatorios.</span>
                </div>
              </form>
            </div>
          </div>

=======
    <div className="container py-4" style={{ maxWidth: '800px' }}>
      <h2 className="fw-bold mb-4">Mi Perfil</h2>

      {/* Aviso de perfil incompleto dinámico */}
      {!form.perfilCompleto && form.camposFaltantes.length > 0 && (
        <div className="alert alert-warning" role="alert">
          <strong>¡Atención!</strong> Tu perfil está incompleto. Te falta llenar: 
          <ul className="mb-0 mt-2">
            {form.camposFaltantes.map((campo, index) => (
              <li key={index}>{campo}</li>
            ))}
          </ul>
        </div>
      )}

      {mensajeExito && <div className="alert alert-success">{mensajeExito}</div>}

      <div className="card shadow-sm border-0">
        <div className="card-body p-4">
          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              {/* Nombre */}
              <div className="col-md-6">
                <label className="form-label fw-semibold">Nombre del Negocio</label>
                <input type="text" name="nombre" className={`form-control ${errores.nombre ? 'is-invalid' : ''}`} value={form.nombre} onChange={handleChange} />
                {errores.nombre && <div className="invalid-feedback">{errores.nombre}</div>}
              </div>

              {/* Categoría */}
              <div className="col-md-6">
                <label className="form-label fw-semibold">Categoría</label>
                <select name="categoriaId" className={`form-select ${errores.categoriaId ? 'is-invalid' : ''}`} value={form.categoriaId} onChange={handleChange}>
                  <option value="">Selecciona...</option>
                  {categorias.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                  ))}
                </select>
                {errores.categoriaId && <div className="invalid-feedback">{errores.categoriaId}</div>}
              </div>

              {/* Descripción */}
              <div className="col-12">
                <label className="form-label fw-semibold">Descripción</label>
                <textarea name="descripcion" className={`form-control ${errores.descripcion ? 'is-invalid' : ''}`} rows={3} value={form.descripcion} onChange={handleChange}></textarea>
                {errores.descripcion && <div className="invalid-feedback">{errores.descripcion}</div>}
              </div>

              {/* Teléfono */}
              <div className="col-md-6">
                <label className="form-label fw-semibold">Teléfono</label>
                <input type="tel" name="telefono" className={`form-control ${errores.telefono ? 'is-invalid' : ''}`} value={form.telefono} onChange={handleChange} />
                {errores.telefono && <div className="invalid-feedback">{errores.telefono}</div>}
              </div>

              {/* Correo de contacto */}
              <div className="col-md-6">
                <label className="form-label fw-semibold">Correo de contacto</label>
                <input type="email" name="correoContacto" className={`form-control ${errores.correoContacto ? 'is-invalid' : ''}`} value={form.correoContacto} onChange={handleChange} />
                {errores.correoContacto && <div className="invalid-feedback">{errores.correoContacto}</div>}
              </div>

              {/* Dirección */}
              <div className="col-12">
                <label className="form-label fw-semibold">Dirección</label>
                <input type="text" name="direccion" className={`form-control ${errores.direccion ? 'is-invalid' : ''}`} value={form.direccion} onChange={handleChange} />
                {errores.direccion && <div className="invalid-feedback">{errores.direccion}</div>}
              </div>
            </div>

            <div className="mt-4 text-end">
              <button type="submit" className="btn text-white fw-bold px-4" style={{ backgroundColor: '#e27441' }} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar perfil'}
              </button>
            </div>
          </form>
>>>>>>> f9df2f0562ec411822fd6c647c766e5e234fa11d
        </div>
      </div>
    </div>
  );
}