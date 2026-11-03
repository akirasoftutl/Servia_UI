import { useState, useEffect, type FormEvent } from 'react';
import { api } from '../../servicios/api';
import './Bloqueos.css';

interface Bloqueo {
  id: string;
  inicio: string;
  fin: string;
  motivo: string | null;
}

interface ReservaConflicto {
  folio: string;
  fecha: string;
  hora: string;
  servicio: string;
  estado: string;
}

export function Bloqueos() {
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [alerta, setAlerta] = useState('');

  const [tipo, setTipo] = useState<'dia' | 'rango' | 'horas'>('dia');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [motivo, setMotivo] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [creando, setCreando] = useState(false);

  const [reservasConflicto, setReservasConflicto] = useState<ReservaConflicto[]>([]);
  const [mostrarConflicto, setMostrarConflicto] = useState(false);

  const cargarBloqueos = async () => {
    setCargando(true);
    setError('');
    try {
      const data = await api<Bloqueo[]>('/negocios/mio/bloqueos');
      setBloqueos(data);
    } catch {
      setError('No pudimos cargar tus bloqueos.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarBloqueos();
  }, []);

  const validar = (): boolean => {
    const nuevosErrores: Record<string, string> = {};
    if (!fechaInicio) nuevosErrores.fechaInicio = 'Elige la fecha de inicio.';
    
    if (tipo === 'rango') {
      if (!fechaFin) nuevosErrores.fechaFin = 'Elige la fecha de fin.';
      else if (fechaFin < fechaInicio) nuevosErrores.fechaFin = 'La fecha final no puede ser anterior a la inicial.';
    }

    if (tipo === 'horas') {
      if (!horaInicio) nuevosErrores.horaInicio = 'Elige la hora de inicio.';
      if (!horaFin) nuevosErrores.horaFin = 'Elige la hora de fin.';
      else if (horaFin <= horaInicio) nuevosErrores.horaFin = 'La hora final debe ser posterior a la inicial.';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAlerta('');
    setMostrarConflicto(false);
    setReservasConflicto([]);

    if (!validar()) return;

    setCreando(true);
    try {
      const payload: any = {
        fechaInicio,
        motivo: motivo.trim() || undefined,
      };

      if (tipo === 'rango') payload.fechaFin = fechaFin;
      if (tipo === 'horas') {
        payload.horaInicio = horaInicio;
        payload.horaFin = horaFin;
      }

      await api('/negocios/mio/bloqueos', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setAlerta('Bloqueo creado.');
      setFechaInicio('');
      setFechaFin('');
      setHoraInicio('');
      setHoraFin('');
      setMotivo('');
      cargarBloqueos();
    } catch (error: any) {
      if (error.estado === 409) {
        setMostrarConflicto(true);
        // Si el backend manda las reservas en el error, las guardamos
        if (error.reservas) {
          setReservasConflicto(error.reservas);
        }
      } else if (error.estado === 400) {
        alert(error.message || 'Revisa los datos del formulario.');
      } else {
        alert('No pudimos guardar el bloqueo. Intenta de nuevo.');
      }
    } finally {
      setCreando(false);
    }
  };

  const handleQuitar = async (id: string) => {
    if (!window.confirm('¿Quitar este bloqueo? Los clientes podrán volver a reservar en ese periodo.')) return;
    
    try {
      await api(`/negocios/mio/bloqueos/${id}`, { method: 'DELETE' });
      setAlerta('Bloqueo quitado.');
      cargarBloqueos();
    } catch (error: any) {
      alert(error.message || 'Error al quitar el bloqueo.');
    }
  };

  // --- FUNCIONES DE FORMATEO DE FECHAS ---
  const formatearFecha = (fechaISO: string) => {
    if (!fechaISO) return '';
    const fecha = new Date(fechaISO);
    return fecha.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatearHora = (fechaISO: string) => {
    if (!fechaISO) return '';
    const fecha = new Date(fechaISO);
    return fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bloqueos-page">
      <div className="bloqueos-container">
        
        <header className="bloqueos-header">
          <h1>Bloqueos de horario</h1>
          <p>Administra los días u horas en los que no atenderás.</p>
        </header>

        {alerta && <div className="alert alert-success rounded-4 mb-4">{alerta}</div>}
        {error && <div className="alert alert-danger rounded-4 mb-4">{error}</div>}

        <div className="bloqueos-panel">
          <div className="bloqueos-grid">
            
            {/* FORMULARIO */}
            <div className="bloqueos-form">
              <h2 className="bloqueos-form-title">Nuevo bloqueo</h2>
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label">Tipo de bloqueo</label>
                  <select className="form-select" value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
                    <option value="dia">Día completo</option>
                    <option value="rango">Varios días</option>
                    <option value="horas">Unas horas</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label">Fecha de inicio *</label>
                  <input type="date" className={`form-control ${errores.fechaInicio ? 'is-invalid' : ''}`} value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                  {errores.fechaInicio && <div className="invalid-feedback">{errores.fechaInicio}</div>}
                </div>

                {tipo === 'rango' && (
                  <div className="mb-3">
                    <label className="form-label">Fecha de fin *</label>
                    <input type="date" className={`form-control ${errores.fechaFin ? 'is-invalid' : ''}`} value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
                    {errores.fechaFin && <div className="invalid-feedback">{errores.fechaFin}</div>}
                  </div>
                )}

                {tipo === 'horas' && (
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label">De *</label>
                      <input type="time" className={`form-control ${errores.horaInicio ? 'is-invalid' : ''}`} value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
                      {errores.horaInicio && <div className="invalid-feedback">{errores.horaInicio}</div>}
                    </div>
                    <div className="col-6">
                      <label className="form-label">A *</label>
                      <input type="time" className={`form-control ${errores.horaFin ? 'is-invalid' : ''}`} value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
                      {errores.horaFin && <div className="invalid-feedback">{errores.horaFin}</div>}
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <label className="form-label">Motivo (opcional)</label>
                  <input type="text" className="form-control" placeholder="Ej. Vacaciones" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                </div>

                <button type="submit" className="bloqueos-btn" disabled={creando}>
                  {creando ? 'Creando...' : 'Bloquear'}
                </button>
              </form>
            </div>

            {/* LISTA DE BLOQUEOS */}
            <div className="bloqueos-list">
              <h2 className="bloqueos-list-title">Tus bloqueos</h2>
              
              {cargando && <p>Cargando...</p>}
              {!cargando && bloqueos.length === 0 && <div className="bloqueos-empty">No tienes bloqueos.</div>}

              {!cargando && bloqueos.length > 0 && (
                <div className="bloqueos-lista">
                  {bloqueos.map((b) => (
                    <div key={b.id} className="bloqueo-card">
                      <div className="bloqueo-info">
                        <h3>
                          {formatearFecha(b.inicio)}
                          {formatearFecha(b.inicio) !== formatearFecha(b.fin) && ` - ${formatearFecha(b.fin)}`}
                        </h3>
                        <p>
                          {/* Si el inicio y fin son el mismo día, es un bloqueo por horas */}
                          {new Date(b.inicio).toDateString() === new Date(b.fin).toDateString()
                            ? `${formatearHora(b.inicio)} a ${formatearHora(b.fin)}`
                            : 'Día(s) completo(s)'
                          }
                          {b.motivo && ` · ${b.motivo}`}
                        </p>
                      </div>
                      <button onClick={() => handleQuitar(b.id)} className="bloqueo-btn-quitar">Quitar</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MODAL DE CONFLICTO 409 */}
        {mostrarConflicto && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1050 }}>
            <div className="bg-white rounded-4 shadow-lg p-4" style={{ maxWidth: '600px', width: '90%' }}>
              <h4 className="fw-bold mb-3 text-danger">No se puede bloquear</h4>
              <p>No se puede bloquear este periodo porque tiene reservas activas. Recházalas o cancélalas primero:</p>
              <div className="table-responsive mt-3">
                <table className="table table-sm">
                  <thead>
                    <tr><th>Folio</th><th>Fecha</th><th>Hora</th><th>Servicio</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    {reservasConflicto.map((r, i) => (
                      <tr key={i}><td>{r.folio}</td><td>{r.fecha}</td><td>{r.hora}</td><td>{r.servicio}</td><td>{r.estado}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-end mt-4">
                <button className="btn-servia-secondary" onClick={() => setMostrarConflicto(false)}>Entendido</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}