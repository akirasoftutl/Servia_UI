import { useLocation } from 'react-router'

export function MiPerfil() {
  const location = useLocation()
  const aviso = location.state?.aviso

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Mi Perfil</h1>
      {aviso && <div style={{ background: '#d1fae5', padding: '1rem', marginBottom: '1rem', borderRadius: '8px' }}>{aviso}</div>}
      <p>Aquí irá el formulario para completar el perfil (Issue #8).</p>
    </div>
  )
}