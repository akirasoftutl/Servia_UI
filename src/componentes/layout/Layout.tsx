import { Outlet } from 'react-router'
import Navbar from '../navbar/Navbar'
import Footer from '../footer/Footer'

export function Layout() {
  return (
    <div className="layout">
      <Navbar />
      <main className="contenido">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
