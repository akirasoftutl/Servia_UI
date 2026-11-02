
import {
  useState,
  useEffect,
  type FormEvent,
  type ChangeEvent
} from 'react';

import { ShieldAlert } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { api } from '../../servicios/api';
import './Servicios.css';

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
  const [servicioPublicado, setServicioPublicado] = useState(false);
  const [perfilCompleto, setPerfilCompleto] = useState(true);
  const [camposFaltantes, setCamposFaltantes] = useState<string[]>([]);
  const [fotosPreview, setFotosPreview] = useState<string[]>([]);

  const handleFotosChange = (e: ChangeEvent<HTMLInputElement>) => {
    const archivos = Array.from(e.target.files || []);

    const archivosValidos = archivos.filter((archivo) =>
      archivo.type.startsWith('image/')
    );

    const nuevasFotos = archivosValidos.map((archivo) =>
      URL.createObjectURL(archivo)
    );

    setFotosPreview((prev) => {
      prev.forEach((url) => URL.revokeObjectURL(url));
      return nuevasFotos;
    });

    // Permite volver a seleccionar los mismos archivos
    e.target.value = '';
  };


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

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setErrores((prev) => ({
      ...prev,
      [name]: '',
    }));
  };

  // Validaciones
  const validar = (): boolean => {
    const nuevosErrores: Record<string, string> = {};

    if (!form.nombre.trim()) {
      nuevosErrores.nombre = 'Escribe el nombre del servicio.';
    }

    if (!form.descripcion.trim()) {
      nuevosErrores.descripcion = 'Escribe una descripción.';
    }

    const precioNum = Number(form.precio);

    if (
      form.precio === '' ||
      !Number.isFinite(precioNum) ||
      precioNum < 0
    ) {
      nuevosErrores.precio = 'El precio debe ser 0 o más.';
    }

    const duracionNum = Number(form.duracion);

    if (
      form.duracion === '' ||
      !Number.isFinite(duracionNum) ||
      duracionNum < 1 ||
      !Number.isInteger(duracionNum)
    ) {
      nuevosErrores.duracion =
        'La duración debe ser de al menos 1 minuto.';
    }

    setErrores(nuevosErrores);

    return Object.keys(nuevosErrores).length === 0;
  };

  // Publicar servicio
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
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

     setServicioPublicado(true);

    } catch (error: any) {
      if (error.estado === 409) {
        setPerfilCompleto(false);

        if (error.message) {
          setCamposFaltantes([error.message]);
        }

      } else if (error.estado === 400) {
        alert(error.message || 'Revisa los datos del formulario.');

      } else {
        alert('No pudimos publicar el servicio. Intenta de nuevo.');
      }

    } finally {
      setPublicando(false);
    }
  };

  const crearOtroServicio = () => {
    setServicioPublicado(false);
    setForm({ nombre: '', descripcion: '', precio: '', duracion: '' });
    setErrores({});

    setFotosPreview((prev) => {
      prev.forEach((url) => URL.revokeObjectURL(url));
      return [];
    });
  };

  // Pantalla de carga
  if (cargando) {
    return (
      <div className="perfil-page d-flex justify-content-center align-items-center">
        <div className="text-center">
          <div
            className="spinner-border"
            style={{ color: '#9333ea' }}
            role="status"
          >
            <span className="visually-hidden">
              Cargando...
            </span>
          </div>

          <p className="text-secondary mt-3">
            Preparando formulario...
          </p>
        </div>
      </div>
    );
  }

  
return (
  <div className="perfil-page">
    <div className="perfil-container">

      {/* Aviso de perfil incompleto */}
      {!perfilCompleto && (
        <div className="alert alert-warning border-0 rounded-4 p-3 mb-4">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">

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
              <ShieldAlert />
              </div>

              <div>
                <strong className="d-block mb-1">
                  Completa tu perfil para publicar servicios.
                </strong>

                <span className="small text-secondary">
                  Campos pendientes:{' '}
                  <strong>{camposFaltantes.join(', ')}</strong>
                </span>
              </div>
            </div>

            <Link
              to="/mi-perfil"
              className="btn btn-warning fw-semibold px-4 py-2 rounded-3 text-decoration-none"
            >
              Completar mi perfil
            </Link>
          </div>
        </div>
      )}

      <div className="perfil-card">
        <div className="perfil-card-body">

          <header className="perfil-header">

            <span
              className="rounded-pill px-3 py-2 small fw-semibold d-inline-block mb-3"
              style={{
                color: '#7e22ce',
                background: '#f5eaff',
              }}
            >
              ✦ PANEL DE NEGOCIO
            </span>

            <h1 className="perfil-title">
              Nuevo servicio
            </h1>

            <p className="perfil-subtitle">
              Agrega un nuevo servicio a tu negocio y permite
              que más clientes conozcan lo que ofreces.
            </p>

          </header>

          <form onSubmit={handleSubmit} noValidate>

            <fieldset disabled={!perfilCompleto || publicando}>

              <section className="borde-personalizado">

                <h2 className="perfil-section-title mb-2">
                  Información del servicio
                </h2>

                <p className="perfil-subtitle mb-4">
                  Completa los datos principales de tu servicio.
                </p>

                {/* Nombre */}
                <div className="mb-4">
                  <label htmlFor="nombre" className="form-label">
                    Nombre del servicio *
                  </label>

                  <input
                    id="nombre"
                    type="text"
                    name="nombre"
                    className={`form-control ${
                      errores.nombre ? 'is-invalid' : ''
                    }`}
                    value={form.nombre}
                    onChange={handleChange}
                    placeholder="Ej. Corte de cabello"
                    required
                  />

                  {errores.nombre && (
                    <div className="invalid-feedback">
                      {errores.nombre}
                    </div>
                  )}
                </div>

                {/* Descripción */}
                <div className="mb-4">
                  <label htmlFor="descripcion" className="form-label">
                    Descripción del servicio *
                  </label>

                  <textarea
                    id="descripcion"
                    name="descripcion"
                    rows={4}
                    maxLength={500}
                    className={`form-control ${
                      errores.descripcion ? 'is-invalid' : ''
                    }`}
                    value={form.descripcion}
                    onChange={handleChange}
                    placeholder="Describe en qué consiste el servicio, qué incluye y qué beneficios obtiene el cliente..."
                    required
                  />

                  <div className="d-flex justify-content-between mt-2">
                    {errores.descripcion ? (
                      <span className="text-danger small">
                        {errores.descripcion}
                      </span>
                    ) : (
                      <span className="text-secondary small">
                        Describe brevemente lo que ofreces.
                      </span>
                    )}

                    <span className="text-secondary small">
                      {form.descripcion.length}/500
                    </span>
                  </div>
                </div>

              </section>


              <section className="borde-personalizado pb-4">

                <h2 className="perfil-section-title mb-2">
                  Precio y duración
                </h2>

                <p className="perfil-subtitle mb-4">
                  Establece el costo y el tiempo aproximado
                  de realización.
                </p>

                <div className="row g-3">
                <div className="col-12 col-md-6">
                    <label htmlFor="precio" className="form-label">
                      Precio del servicio *
                    </label>

                    <div className="input-group ">
                      <span
                        className="input-group-text"
                        style={{
                          background: '#f8f0ff',
                          color: '#7e22ce',
                          borderColor: '#dfe3ec',
                        }}
                      >
                        $
                      </span>

                      <input
                        id="precio"
                        type="number"
                        name="precio"
                        className={`form-control ${
                          errores.precio ? 'is-invalid' : ''
                        }`}
                        value={form.precio}
                        onChange={handleChange}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>

                    {errores.precio && (
                      <div className="text-danger small mt-2">
                        {errores.precio}
                      </div>
                    )}

                    <small className="text-secondary mt-2 d-block">
                      Precio en pesos mexicanos (MXN).
                    </small>
                  </div>

                  {/* Duración */}
                  <div className="col-12 col-md-6">
                    <label htmlFor="duracion" className="form-label">
                      Duración del servicio *
                    </label>

                    <div className="input-group">
                      <input
                        id="duracion"
                        type="number"
                        name="duracion"
                        className={`form-control ${
                          errores.duracion ? 'is-invalid' : ''
                        }`}
                        value={form.duracion}
                        onChange={handleChange}
                        placeholder="30"
                        min="1"
                        step="1"
                        required
                      />

                      <span
                        className="input-group-text"
                        style={{
                          background: '#f8f0ff',
                          color: '#7e22ce',
                          borderColor: '#dfe3ec',
                        }}
                      >
                        Minutos
                      </span>
                    </div>

                    {errores.duracion && (
                      <div className="text-danger small mt-2">
                        {errores.duracion}
                      </div>
                    )}

                    <small className="text-secondary mt-2 d-block">
                      Tiempo aproximado para realizar el servicio.
                    </small>
                  </div>

                </div>
              </section>

              <section className="mb-4">

                <div className="mb-3">
                  <h2 className="perfil-section-title mb-2">
                    Fotografías del servicio
                  </h2>

                  <p className="perfil-subtitle">
                    Muestra imágenes de tus trabajos para que
                    tus clientes conozcan la calidad de tus servicios.
                  </p>
                </div>

                {/* Área de fotografías */}
                <div
                  className="rounded-4 p-3 p-md-4"
                  style={{
                    background: '#faf9fc',
                    border: '1px dashed #c9b5e8',
                  }}
                >

                  <input
                    type="file"
                    id="fotos-servicio"
                    accept="image/*"
                    multiple
                    className="d-none"
                    onChange={handleFotosChange}
                  />

                  {fotosPreview.length === 0 ? (

                    <label
                      htmlFor="fotos-servicio"
                      className="d-flex flex-column align-items-center justify-content-center text-center py-4"
                      style={{ cursor: 'pointer' }}
                    >
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center mb-3"
                        style={{
                          width: 65,
                          height: 65,
                          background: '#f1e5ff',
                          color: '#9333ea',
                          fontSize: 28,
                        }}
                      >
                        <span>↑</span>
                      </div>

                      <strong className="mb-2">
                        Agrega fotografías de tu servicio
                      </strong>

                      <span className="text-secondary small">
                        Haz clic para seleccionar imágenes de tu dispositivo.
                      </span>

                      <span
                        className="mt-3 small fw-semibold"
                        style={{ color: '#9333ea' }}
                      >
                        Seleccionar fotografías
                      </span>
                    </label>

                  ) : (

                    <div>
                      <div className="row g-3">

                        {fotosPreview.map((foto, index) => (
                          <div
                            className="col-6 col-md-4 col-lg-3"
                            key={foto}
                          >
                            <div
                              className="rounded-3 overflow-hidden position-relative"
                              style={{
                                height: 155,
                                border: '1px solid #e5e7eb',
                              }}
                            >
                              <img
                                src={foto}
                                alt={`Fotografía del servicio ${index + 1}`}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                }}
                              />
                            </div>

                            <p className="text-secondary small mt-2 mb-0">
                              Fotografía {index + 1}
                            </p>
                          </div>
                        ))}

                      </div>

                      <label
                        htmlFor="fotos-servicio"
                        className="btn-servia-secondary d-inline-flex align-items-center gap-2 mt-4"
                        style={{ cursor: 'pointer' }}
                      >
                        <span>+</span>
                        Cambiar fotografías
                      </label>
                    </div>

                  )}

                  <div className="text-center mt-3">
                    <small className="text-secondary">
                      Las fotografías son únicamente una vista previa
                      y no se guardarán ni enviarán al servidor.
                    </small>
                  </div>

                </div>
              </section>
            </fieldset>

            <div
              className="d-flex flex-wrap justify-content-between align-items-center gap-3 pt-4 mt-2"
              style={{ borderTop: '1px solid #eceef4' }}
            >

              <Link
                to="/servicios"
                className="btn-servia-secondary text-decoration-none"
              >
                Cancelar
              </Link>

              <button
                type="submit"
                className="btn-servia-primary"
                disabled={!perfilCompleto || publicando}
              >
                {publicando ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Publicando...
                  </>
                ) : (
                  <>
                    Publicar servicio
                  </>
                )}
              </button>

            </div>

          </form>

          <div
            className="d-flex align-items-center justify-content-center gap-2 mt-4 pt-3"
            style={{ borderTop: '1px solid #eceef4' }}
          >
            <span style={{ color: '#9333ea' }}>●</span>

            <span className="text-secondary small">
              Publica tus servicios y conecta con nuevos clientes.
            </span>
          </div>

        </div>
      </div>
       {servicioPublicado && (
        <div
          className="servicio-alerta-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="servicio-alerta-titulo"
          aria-describedby="servicio-alerta-texto"
        >
          <div className="servicio-alerta-card">
            <div className="servicio-alerta-icono" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>

            <h2 id="servicio-alerta-titulo" className="servicio-alerta-titulo">
              ¡Servicio publicado!
            </h2>

            <p id="servicio-alerta-texto" className="servicio-alerta-texto">
              <strong>{form.nombre}</strong> ya forma parte de tu catálogo.
              Tus clientes podrán encontrarlo y reservarlo.
            </p>

            <div className="servicio-alerta-acciones">
              <button
                type="button"
                className="btn-servia-primary"
                onClick={() => navigate('/servicios')}
              >
                Ver mis servicios
              </button>

              <button
                type="button"
                className="btn-servia-secondary"
                onClick={crearOtroServicio}
              >
                Crear otro servicio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
  
);
}
