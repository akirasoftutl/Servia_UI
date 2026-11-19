export function EstadoClientes({ cargando, error, vacio, reintentar, carga }: {
  cargando: boolean; error: string; vacio: string; reintentar: () => void; carga: string;
}) {
  return <>
    {cargando && <div className="panel-estado">
      <div className="spinner-border" aria-hidden="true" />
      <p className="panel-estado-texto" role="status">Cargando {carga}...</p>
    </div>}
    {!cargando && error && <div className="panel-estado">
      <div className="panel-estado-icono panel-estado-icono--error" aria-hidden="true">!</div>
      <p className="panel-estado-texto" role="alert">{error}</p>
      <button className="btn-servia-primary" onClick={reintentar}>Reintentar</button>
    </div>}
    {!cargando && !error && vacio && <div className="panel-estado">
      <div className="panel-estado-icono" aria-hidden="true">✦</div>
      <p className="panel-estado-texto">{vacio}</p>
    </div>}
  </>;
}
