import { useState, useEffect } from 'react';
import { api } from '../../servicios/api';
import './Reservas.css';

interface Reserva {
  id: string;
  folio: string;
  clienteNombre: string;
  servicioNombre: string;
  fecha: string; // Asumo que viene formateada o en ISO
  hora: string;
  estado: string;
  venceEn?: string; // Tiempo para responder (solo en pendientes)
}

export function Reservas() {
  const [pestana, setPestana] = useState<'pendientes' | 'proximas'>('pendientes');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');
  
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // Función para calcular el tiempo restante (si el backend no lo manda listo)
  const calcularTiempoRestante = (venceEn?: string) => {
    if (!venceEn) return null;
    const ahora = new Date().getTime();
    const vencimiento = new Date(venceEn).getTime();
    const diferencia = vencimiento - ahora;

    if (diferencia <= 0) return 'Vencida';

    const horas = Math.floor(diferencia / (1000 * 60 * 60));
    const minutos = Math.floor((diferencia % (1000 * 60 * 60)) / (1000 * 60));
    
    if (horas > 0) return `${horas}h ${minutos}m restantes`;
    return `${minutos}m restantes`;
  };

  const cargarReservas = async () => {
    setCargando(true);
    setError('');
    try {
      // Construimos la URL con los filtros
      let ruta = '/reservas/negocio?';
      if (pestana === 'proximas') ruta += 'vista=proximas&';
      if (filtroEstado) ruta += `estado=${filtroEstado}&`;
      if (filtroFecha) ruta += `desde=${filtroFecha}&hasta=${filtroFecha}`;

      const data = await api<{ items: Reserva[] }>(ruta);
      setReservas(data.items || []);
    } catch (err) {
      setError('No pudimos cargar las reservas. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarReservas();
  }, [pestana, filtroEstado, filtroFecha]);

  return (
    <div className="reservas-page">
      <div className="reservas-container">
        
        <header className="reservas-header">
          <h1>Reservas</h1>
          <p>Administra las solicitudes de tus clientes.</p>
        </header>

        <section className="reservas-panel">
          
          {/* Filtros */}
          <div className="d-flex flex-wrap gap-3 mb-4">
            <div>
              <label className="form-label small fw-bold text-muted">Fecha</label>
              <input type="date" className="form-control" value={filtroFecha} onChange={(e) => setFiltroFecha(e.target.value)} />
            </div>
            <div>
              <label className="form-label small fw-bold text-muted">Estado</label>
              <select className="form-select" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                <option value="">Todos</option>
                <option value="pendiente">Pendientes</option>
                <option value="confirmada">Confirmadas</option>
              </select>
            </div>
          </div>

          {/* Pestañas */}
          <div className="reservas-tabs">
            <button className={pestana === 'pendientes' ? 'active' : ''} onClick={() => setPestana('pendientes')}>
              Pendientes
            </button>
            <button className={pestana === 'proximas' ? 'active' : ''} onClick={() => setPestana('proximas')}>
              Próximas
            </button>
          </div>

          {/* Lista */}
          {cargando && <p className="text-center py-5">Cargando reservas...</p>}
          
          {!cargando && error && (
            <div className="text-center py-5">
              <p className="text-danger">{error}</p>
              <button className="btn-servia-primary" onClick={cargarReservas}>Reintentar</button>
            </div>
          )}

          {!cargando && !error && reservas.length === 0 && (
            <div className="text-center py-5">
              <p className="text-muted">
                {pestana === 'pendientes' ? 'No tienes reservas pendientes.' : 'No tienes reservas próximas.'}
              </p>
            </div>
          )}

          {!cargando && !error && reservas.length > 0 && (
            <div className="reservas-lista">
              {reservas.map((r) => (
                <div key={r.id} className="reserva-card">
                  <div className="reserva-info-principal">
                    <h3>{r.clienteNombre}</h3>
                    <p>{r.servicioNombre} · {r.fecha} a las {r.hora}</p>
                  </div>
                  
                  <div className="reserva-estado-container">
                    {/* Etiqueta de estado */}
                    <span className={`reserva-badge ${r.estado}`}>
                      {r.estado}
                    </span>

                    {/* Tiempo restante (solo en pendientes) */}
                    {pestana === 'pendientes' && r.venceEn && (
                      <span className="reserva-tiempo">
                        ⏱ {calcularTiempoRestante(r.venceEn)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

        </section>
      </div>
    </div>
  );
}