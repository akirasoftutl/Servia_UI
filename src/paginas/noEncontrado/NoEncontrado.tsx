import { Link } from 'react-router'

export function NoEncontrado() {
  return (
    <section>
      <h1>No encontramos esta página</h1>
      <p>
        <Link to="/">Volver al inicio</Link>
      </p>
    </section>
  )
}
