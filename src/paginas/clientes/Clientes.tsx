import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../servicios/api';
import type { PaginaClientes } from './clientes';
import { DatosCliente } from './DatosCliente';
import { EstadoClientes } from './EstadoClientes';
import './Clientes.css';

export function Clientes() {
  const [busqueda, setBusqueda] = useState('');
  const [cursor, setCursor] = useState('');
  const [pagina, setPagina] = useState<PaginaClientes>({ items: [], siguiente: null });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let vigente = true;
    const q = busqueda.trim();
    // Cada tecla invalida de inmediato la petición anterior, incluso durante la espera.
    const temporizador = window.setTimeout(() => {
      if (q.length === 1) { setCargando(false); return; }
      const parametros = new URLSearchParams();
      if (q) parametros.set('q', q);
      if (cursor) parametros.set('cursor', cursor);
      api<PaginaClientes>(`/negocios/mio/clientes?${parametros}`)
        .then((datos) => {
          if (vigente) setPagina((anterior) => ({ items: cursor ? [...anterior.items, ...datos.items] : datos.items, siguiente: datos.siguiente }));
        })
        .catch(() => { if (vigente) setError('No pudimos cargar los clientes. Intenta de nuevo.'); })
        .finally(() => { if (vigente) setCargando(false); });
    }, q && !cursor ? 300 : 0);
    return () => { vigente = false; window.clearTimeout(temporizador); };
  }, [busqueda, cursor, revision]);

  function reintentar() { setCargando(true); setError(''); setRevision((r) => r + 1); }
  const consulta = busqueda.trim();
  const buscando = consulta.length >= 2;
  return <div className="panel-pagina"><div className="panel-contenedor">
    <header className="panel-encabezado"><div>
      <span className="panel-eyebrow">PRINCIPAL</span>
      <h1 className="panel-titulo">Clientes</h1>
      <p className="panel-subtitulo">Consulta a quienes han reservado con tu negocio.</p>
    </div></header>
    <section className="panel-tarjeta" aria-label="Clientes del negocio">
      <label htmlFor="clientes-busqueda" className="form-label">Buscar por nombre</label>
      <input id="clientes-busqueda" className="form-control" type="search" maxLength={50} value={busqueda}
        aria-describedby="clientes-ayuda" onChange={(e) => {
          setBusqueda(e.target.value); setCursor(''); setPagina({ items: [], siguiente: null }); setError(''); setCargando(true);
        }} />
      <p id="clientes-ayuda" className="panel-item-texto">Escribe al menos 2 caracteres para buscar.</p>
      <div aria-busy={cargando}>
        <EstadoClientes carga="clientes" titulo={buscando ? 'Sin resultados' : 'Aún no hay clientes'} cargando={cargando} error={error}
          vacio={pagina.items.length || consulta.length === 1 ? '' : buscando ? 'No encontramos clientes con ese nombre.' : 'Todavía no tienes clientes.'} reintentar={reintentar} />
        <div className="panel-lista">
          {pagina.items.map((cliente) => <article className="panel-item clientes-item" key={cliente.clienteUid}>
            <h2 className="panel-item-titulo"><Link to={`/clientes/${encodeURIComponent(cliente.clienteUid)}`}>{cliente.nombre || 'Cliente sin nombre'}</Link></h2>
            <DatosCliente cliente={cliente} />
          </article>)}
        </div>
        {!cargando && !error && pagina.siguiente && <button className="btn-servia-secondary btn-servia-sm clientes-mas" onClick={() => {
          setCursor(pagina.siguiente!); setCargando(true); setError('');
        }}>Cargar más</button>}
      </div>
    </section>
  </div></div>;
}
