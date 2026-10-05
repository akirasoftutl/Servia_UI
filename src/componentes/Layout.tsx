import { Link, Outlet } from 'react-router'

export function Layout() {
  return (
    <div className="layout">
      <header className="encabezado">
        <Link to="/" className="marca">
          <img src="/pwa-192x192.png" alt="" width={32} height={32} />
          <span>
            Servia <small>Panel del negocio</small>
          </span>
        </Link>
      </header>
      <main className="contenido">
        <Outlet />
      </main>
    </div>
  )
}
