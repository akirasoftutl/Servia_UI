import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
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
  camposFaltantes: string[]; // La API nos da los nombres de los campos que faltan
}

export function MiPerfil() {
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

  // 1. Cargar categorías y datos del perfil al entrar
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        // Cargar categorías
        const cats = await api<Categoria[]>('/categorias');
        setCategorias(cats);

        // Cargar perfil actual
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

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    setErrores({ ...errores, [name]: '' });
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
      // Solo enviamos los campos que la API espera en el PUT
      const { nombre, descripcion, categoriaId, telefono, correoContacto, direccion } = form;
      const respuesta = await api<PerfilNegocio>('/negocios/mio', {
        method: 'PUT',
        body: JSON.stringify({ nombre, descripcion, categoriaId, telefono, correoContacto, direccion }),
      });
      
      setForm(respuesta); // Actualizamos con la respuesta (para ver si ya no hay faltantes)
      setMensajeExito('Perfil guardado correctamente.');
    } catch (error: any) {
      alert(error.message || 'Error al guardar el perfil');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <div className="text-center mt-5"><h3>Cargando perfil...</h3></div>;

  return (
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
        </div>
      </div>
    </div>
  );
}