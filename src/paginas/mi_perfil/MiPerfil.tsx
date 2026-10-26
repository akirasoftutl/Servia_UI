import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import './MiPerfil.css';
import { api } from '../../servicios/api';

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
  const [mostrarModalExito, setMostrarModalExito] = useState(false);

  // Estado local para la vista previa de la imagen
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);


  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const cats = await api<Categoria[]>('/categorias');
        setCategorias(cats);

        const perfil = await api<Partial<PerfilNegocio>>('/negocios/mio');
        setForm((prev) => ({
          ...prev,
          ...perfil,
          nombre: perfil.nombre ?? '',
          descripcion: perfil.descripcion ?? '',
          categoriaId: perfil.categoriaId ?? '',
          telefono: perfil.telefono ?? '',
          correoContacto: perfil.correoContacto ?? '',
          direccion: perfil.direccion ?? '',
          perfilCompleto: perfil.perfilCompleto ?? false,
          camposFaltantes: perfil.camposFaltantes ?? [],
        }));
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
    setMostrarModalExito(false);

    if (pasoActual !== 3) return;
    if (!validarPaso(3)) return;

    setGuardando(true);
    try {
      const { nombre, descripcion, categoriaId, telefono, correoContacto, direccion } = form;
      const respuesta = await api<PerfilNegocio>('/negocios/mio', {
        method: 'PUT',
        body: JSON.stringify({ nombre, descripcion, categoriaId, telefono, correoContacto, direccion }),
      });

      setForm((prev) => ({
        ...prev,
        ...respuesta,
        nombre: respuesta.nombre ?? prev.nombre ?? '',
        descripcion: respuesta.descripcion ?? prev.descripcion ?? '',
        categoriaId: respuesta.categoriaId ?? prev.categoriaId ?? '',
        telefono: respuesta.telefono ?? prev.telefono ?? '',
        correoContacto: respuesta.correoContacto ?? prev.correoContacto ?? '',
        direccion: respuesta.direccion ?? prev.direccion ?? '',
        perfilCompleto: respuesta.perfilCompleto ?? prev.perfilCompleto ?? false,
        camposFaltantes: respuesta.camposFaltantes ?? prev.camposFaltantes ?? [],
      }));
      setMensajeExito('Perfil actualizado correctamente');
      setMostrarModalExito(true);
    } catch (error: any) {
      alert(error.message || 'Error al guardar el perfil');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div className="perfil-page d-flex align-items-center justify-content-center">
        <div className="text-center">
          <div
            className="spinner-border"
            style={{ color: '#9333ea' }}
            role="status"
          >
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="text-secondary mt-3 mb-0">
            Cargando información del negocio...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="perfil-page">
      <div className="perfil-container">

        {/* Aviso de perfil incompleto */}
        {!form.perfilCompleto &&
          (form.camposFaltantes?.length ?? 0) > 0 && (
            <div
              className="alert alert-warning border-0 rounded-4 p-3 mb-4"
              role="status"
            >
              <div className="d-flex align-items-start gap-3">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{
                    width: 42,
                    height: 42,
                    background: '#fff0c2',
                    fontSize: 20,
                  }}
                >
                  ⚠️
                </div>

                <div>
                  <strong className="d-block mb-1">
                    Completa tu perfil para publicar servicios
                  </strong>
                  <span className="small text-secondary">
                    Campos pendientes:{' '}
                    <strong>
                      {form.camposFaltantes.join(', ')}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          )}

        {/* Mensaje de éxito */}
        {mensajeExito && !mostrarModalExito && (
          <div
            className="alert alert-success border-0 rounded-4 p-3 mb-4"
            role="status"
          >
            <div className="d-flex align-items-center gap-2">
              <span style={{ fontSize: 20 }}>✓</span>
              <span className="fw-semibold">{mensajeExito}</span>
            </div>
          </div>
        )}

        {mostrarModalExito && (
          <div
            className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', zIndex: 1050 }}
            onClick={() => setMostrarModalExito(false)}
          >
            <div
              className="bg-white rounded-4 shadow-lg p-4 text-center"
              style={{ maxWidth: '400px', width: '90%' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                style={{
                  width: 64,
                  height: 64,
                  background: '#dcfce7',
                  color: '#16a34a',
                  fontSize: 32,
                }}
              >
                ✓
              </div>
              <h4 className="fw-bold mb-2">¡Éxito!</h4>
              <p className="text-secondary mb-4">{mensajeExito}</p>
              <button
                type="button"
                className="btn-servia-primary px-4"
                onClick={() => setMostrarModalExito(false)}
              >
                Aceptar
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>

          {/* Tarjeta principal */}
          <div className="perfil-card">
            <div className="perfil-card-body">

              {/* Encabezado */}
              <header className="perfil-header">
                <div className="d-flex align-items-center gap-2 mb-3">
                  <span
                    className="rounded-pill px-3 py-2 small fw-semibold"
                    style={{
                      color: '#7e22ce',
                      background: '#f5eaff',
                    }}
                  >
                    <span className="me-2">✦</span>
                    PANEL DE NEGOCIO
                  </span>
                </div>

                <h1 className="perfil-title">
                  Perfil del negocio
                </h1>

                <p className="perfil-subtitle">
                  Administra la información de tu establecimiento
                  y haz que más clientes te encuentren en Servia.
                </p>
              </header>

              <div className="perfil-progress-lines" aria-hidden="true">
                <span className={pasoActual >= 1 ? 'active' : ''} />
                <span className={pasoActual >= 2 ? 'active' : ''} />
                <span className={pasoActual >= 3 ? 'active' : ''} />
              </div>

              {pasoActual === 1 && (
                <section aria-labelledby="titulo-informacion">
                  <div className="mb-4">
                    <h2
                      id="titulo-informacion"
                      className="perfil-section-title mb-2"
                    >
                      Información general
                    </h2>

                    <p className="perfil-subtitle">
                      Cuéntales a tus clientes quién eres y cómo
                      pueden ponerse en contacto contigo.
                    </p>
                  </div>

                  <div className="row g-4">

                    {/* Campos del negocio */}
                    <div className="col-12 col-lg-7">
                      <div className="row g-3">

                        <div className="col-12 col-md-6">
                          <label
                            htmlFor="nombre"
                            className="form-label"
                          >
                            Nombre del negocio *
                          </label>

                          <input
                            id="nombre"
                            type="text"
                            name="nombre"
                            className={`form-control ${errores.nombre ? 'is-invalid' : ''
                              }`}
                            value={form.nombre}
                            onChange={handleChange}
                            placeholder="Ej. Barbería El Bigote"
                            autoComplete="organization"
                            required
                          />

                          {errores.nombre && (
                            <div className="invalid-feedback">
                              {errores.nombre}
                            </div>
                          )}
                        </div>

                        <div className="col-12 col-md-6">
                          <label
                            htmlFor="telefono"
                            className="form-label"
                          >
                            Teléfono de contacto *
                          </label>

                          <input
                            id="telefono"
                            type="tel"
                            name="telefono"
                            className={`form-control ${errores.telefono ? 'is-invalid' : ''
                              }`}
                            value={form.telefono}
                            onChange={handleChange}
                            placeholder="477 123 4567"
                            autoComplete="tel"
                            required
                          />

                          {errores.telefono && (
                            <div className="invalid-feedback">
                              {errores.telefono}
                            </div>
                          )}
                        </div>

                        <div className="col-12">
                          <label
                            htmlFor="email"
                            className="form-label"
                          >
                            Correo electrónico *
                          </label>

                          <input
                            id="email"
                            type="email"
                            name="email"
                            className={`form-control ${errores.email ? 'is-invalid' : ''
                              }`}
                            value={camposExtra.email}
                            onChange={handleChange}
                            placeholder="contacto@negocio.com"
                            autoComplete="email"
                            required
                          />

                          {errores.email && (
                            <div className="invalid-feedback">
                              {errores.email}
                            </div>
                          )}
                        </div>

                        <div className="col-12">
                          <label
                            htmlFor="descripcion"
                            className="form-label"
                          >
                            Descripción del negocio *
                          </label>

                          <textarea
                            id="descripcion"
                            name="descripcion"
                            rows={5}
                            maxLength={500}
                            className={`form-control ${errores.descripcion ? 'is-invalid' : ''
                              }`}
                            value={form.descripcion}
                            onChange={handleChange}
                            placeholder="Describe tus servicios, tu experiencia y qué te hace diferente..."
                            required
                          />

                          <div className="d-flex justify-content-between align-items-center mt-2">
                            {errores.descripcion ? (
                              <span className="text-danger small">
                                {errores.descripcion}
                              </span>
                            ) : (
                              <span className="text-secondary small">
                                Una buena descripción genera confianza.
                              </span>
                            )}

                            <span className="text-secondary small">
                              {(form.descripcion || '').length}/500
                            </span>
                          </div>
                        </div>

                      </div>
                    </div>

              
                    <div className="col-12 col-lg-5">
                      <div className="perfil-upload h-100">
                        <h3 className="fw-bold mb-2 fs-6">
                          Imagen de tu negocio
                        </h3>

                        <p className="text-secondary small mb-3">
                          Agrega tu logotipo o una imagen que
                          represente tu establecimiento.
                        </p>

                        <div className="perfil-image-preview mb-3">
                          {imagenPreview ? (
                            <img
                              src={imagenPreview}
                              alt="Vista previa de la imagen del negocio"
                            />
                          ) : (
                            <div className="perfil-image-placeholder">
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                aria-hidden="true"
                              >
                                <rect
                                  x="3"
                                  y="3"
                                  width="18"
                                  height="18"
                                  rx="3"
                                />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <path d="m21 15-5-5L5 21" />
                              </svg>

                              <span>
                                Aún no has seleccionado una imagen
                              </span>
                            </div>
                          )}
                        </div>

                        <input
                          type="file"
                          id="logo-upload"
                          accept="image/png,image/jpeg,image/webp"
                          className="d-none"
                          onChange={handleImagenChange}
                        />

                        <label
                          htmlFor="logo-upload"
                          className="btn-servia-secondary d-flex align-items-center justify-content-center gap-2 w-100"
                          style={{ cursor: 'pointer' }}
                        >

                          {imagenPreview
                            ? 'Cambiar imagen'
                            : 'Seleccionar imagen'}
                        </label>

                        <p className="text-secondary text-center small mt-3 mb-0">
                          Máximo 5 MB
                        </p>
                      </div>
                    </div>

                  </div>
                </section>
              )}

              {/* =========================================
                  PASO 2: UBICACIÓN Y CONTACTO
              ========================================= */}
              {pasoActual === 2 && (
                <section aria-labelledby="titulo-ubicacion">
                  <div className="mb-4">
                    <h2
                      id="titulo-ubicacion"
                      className="perfil-section-title mb-2"
                    >
                      Ubicación y contacto
                    </h2>

                    <p className="perfil-subtitle">
                      Facilita que tus clientes encuentren tu
                      establecimiento.
                    </p>
                  </div>

                  <div className="row g-3">

                    <div className="col-12">
                      <label
                        htmlFor="direccion"
                        className="form-label"
                      >
                        Calle y número *
                      </label>

                      <input
                        id="direccion"
                        type="text"
                        name="direccion"
                        className={`form-control ${errores.direccion ? 'is-invalid' : ''
                          }`}
                        value={form.direccion}
                        onChange={handleChange}
                        placeholder="Ej. Avenida Juárez 123"
                        autoComplete="street-address"
                        required
                      />

                      {errores.direccion && (
                        <div className="invalid-feedback">
                          {errores.direccion}
                        </div>
                      )}
                    </div>

                    <div className="col-12 col-md-6">
                      <label
                        htmlFor="colonia"
                        className="form-label"
                      >
                        Colonia / Asentamiento
                      </label>

                      <input
                        id="colonia"
                        type="text"
                        name="colonia"
                        className={`form-control ${errores.colonia ? 'is-invalid' : ''
                          }`}
                        value={camposExtra.colonia}
                        onChange={handleChange}
                        placeholder="Ej. Centro"
                      />

                      {errores.colonia && (
                        <div className="invalid-feedback">
                          {errores.colonia}
                        </div>
                      )}
                    </div>

                    <div className="col-12 col-md-6">
                      <label
                        htmlFor="codigoPostal"
                        className="form-label"
                      >
                        Código postal *
                      </label>

                      <input
                        id="codigoPostal"
                        type="text"
                        name="codigoPostal"
                        inputMode="numeric"
                        maxLength={5}
                        className={`form-control ${errores.codigoPostal ? 'is-invalid' : ''
                          }`}
                        value={camposExtra.codigoPostal}
                        onChange={handleChange}
                        placeholder="Ej. 37000"
                        autoComplete="postal-code"
                        required
                      />

                      {errores.codigoPostal && (
                        <div className="invalid-feedback">
                          {errores.codigoPostal}
                        </div>
                      )}
                    </div>

                    <div className="col-12 col-md-6">
                      <label
                        htmlFor="ciudad"
                        className="form-label"
                      >
                        Ciudad / Municipio *
                      </label>

                      <input
                        id="ciudad"
                        type="text"
                        name="ciudad"
                        className={`form-control ${errores.ciudad ? 'is-invalid' : ''
                          }`}
                        value={camposExtra.ciudad}
                        onChange={handleChange}
                        placeholder="Ej. León"
                        autoComplete="address-level2"
                        required
                      />

                      {errores.ciudad && (
                        <div className="invalid-feedback">
                          {errores.ciudad}
                        </div>
                      )}
                    </div>

                    <div className="col-12 col-md-6">
                      <label
                        htmlFor="estado"
                        className="form-label"
                      >
                        Estado *
                      </label>

                      <input
                        id="estado"
                        type="text"
                        name="estado"
                        className={`form-control ${errores.estado ? 'is-invalid' : ''
                          }`}
                        value={camposExtra.estado}
                        onChange={handleChange}
                        placeholder="Ej. Guanajuato"
                        autoComplete="address-level1"
                        required
                      />

                      {errores.estado && (
                        <div className="invalid-feedback">
                          {errores.estado}
                        </div>
                      )}
                    </div>

                    <div className="col-12">
                      <label
                        htmlFor="referencias"
                        className="form-label"
                      >
                        Referencias de ubicación
                      </label>

                      <textarea
                        id="referencias"
                        name="referencias"
                        rows={3}
                        className={`form-control ${errores.referencias ? 'is-invalid' : ''
                          }`}
                        value={camposExtra.referencias}
                        onChange={handleChange}
                        placeholder="Ej. Entre 5 de Mayo y Madero, frente a la plaza."
                      />

                      {errores.referencias && (
                        <div className="invalid-feedback">
                          {errores.referencias}
                        </div>
                      )}
                    </div>

                  </div>
                </section>
              )}

              {/* =========================================
                  PASO 3: CATEGORÍA DEL NEGOCIO
              ========================================= */}
              {pasoActual === 3 && (
                <section aria-labelledby="titulo-categoria">
                  <div className="mb-4">
                    <h2
                      id="titulo-categoria"
                      className="perfil-section-title mb-2"
                    >
                      Categoría del negocio
                    </h2>

                    <p className="perfil-subtitle">
                      Selecciona la categoría que mejor describe
                      los servicios que ofreces.
                    </p>
                  </div>

                  {errores.categoriaId && (
                    <div className="alert alert-danger py-2 small">
                      {errores.categoriaId}
                    </div>
                  )}

                  {categorias.length === 0 ? (
                    <div className="text-center py-5">
                      <p className="text-secondary mb-0">
                        No hay categorías disponibles por el momento.
                      </p>
                    </div>
                  ) : (
                    <div className="row g-3">
                      {categorias.map((cat) => {
                        const seleccionada =
                          form.categoriaId === cat.id;

                        const categoriaImagenes: Record<string, string> = {
                          'cabello-barba': '/galeria_home/galeria_1.jpg',
                          'estetica-facial-corporal': '/galeria_home/galeria_2.jpg',
                          'unas-pestanas-cejas': '/galeria_home/galeria_3.jpg',
                          'fitness': '/galeria_home/galeria_4.jpeg',
                          'maquillaje-imagen': '/galeria_home/galeria_5.jpeg',
                        };

                        const imagenCategoria =
                          categoriaImagenes[cat.id] || '/galeria_home/galeria_1.jpg';

                        return (
                          <div
                            className="col-12 col-sm-6 col-lg-4"
                            key={cat.id}
                          >
                            <button
                              type="button"
                              className={`perfil-category w-100 text-start ${seleccionada ? 'selected' : ''
                                }`}
                              style={{
                                backgroundImage: `linear-gradient(to top, rgba(20, 15, 30, 0.88), rgba(20, 15, 30, 0.08)), url('${imagenCategoria}')`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                color: '#fff',
                                fontFamily: 'inherit',
                              }}
                              onClick={() =>
                                handleCategoriaChange(cat.id)
                              }
                              aria-pressed={seleccionada}
                            >
                              <span className="w-100 d-flex align-items-end justify-content-between gap-2">
                                <span className="fw-bold">
                                  {cat.nombre}
                                </span>

                              
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <p className="text-secondary small mt-3 mb-0">
                    Puedes seleccionar una sola categoría.
                  </p>
                </section>
              )}

              <div className="perfil-actions">
                <div>
                  {pasoActual > 1 && (
                    <button
                      type="button"
                      onClick={handleAnterior}
                      className="btn-servia-secondary"
                    >
                       Anterior
                    </button>
                  )}
                </div>

                <div className="d-flex align-items-center gap-2">
                  {pasoActual < 3 ? (
                    <button
                      type="button"
                      onClick={handleSiguiente}
                      className="btn-servia-primary"
                    >
                      Continuar
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="btn-servia-primary"
                      disabled={guardando}
                    >
                      {guardando ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                            aria-hidden="true"
                          />
                          Guardando...
                        </>
                      ) : (
                        <>
                          Guardar cambios
                        </>
                      )}
                    </button>
                  )}

                  <Link
                    to="/servicios"
                    className="btn-servia-secondary text-decoration-none d-inline-flex align-items-center justify-content-center"
                  >
                    Salir
                  </Link>
                </div>
              </div>

              {/* Pie de la tarjeta */}
              <div
                className="d-flex align-items-center justify-content-center gap-2 mt-4 pt-3"
                style={{ borderTop: '1px solid #eceef4' }}
              >
                <span style={{ color: '#9333ea' }}>●</span>
                <span className="text-secondary small">
                  Tu información te ayuda a conectar con más clientes.
                </span>
              </div>

            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
