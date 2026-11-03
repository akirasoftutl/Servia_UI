import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../contextos/AuthContext';

// Guarda para /login y /registro-negocio: si ya había sesión al entrar, manda al panel.
//
// La decisión se toma una sola vez por entrada de navegación (location.key), con el primer
// valor resuelto de la sesión. Si el usuario inicia sesión o se registra desde la pantalla,
// `usuario` cambia pero NO se redirige aquí: el formulario conserva su propio destino
// (/mi-perfil). Se guarda fuera del componente porque Layout se remonta al cambiar el uid
// de la sesión (key={uid}) y se llevaría el estado local.
const memoria = { decision: null as { clave: string; habiaSesion: boolean } | null, montadas: 0 }

export function RutaSoloVisitantes() {
  const { usuario, cargando } = useAuth();
  const { key } = useLocation();

  const recordada = memoria.decision?.clave === key ? memoria.decision.habiaSesion : null
  // null mientras Firebase revisa si hay sesión
  const habiaSesion = recordada ?? (cargando ? null : !!usuario)

  useEffect(() => {
    if (habiaSesion !== null) memoria.decision = { clave: key, habiaSesion }
  }, [key, habiaSesion])

  useEffect(() => {
    memoria.montadas++
    return () => {
      memoria.montadas--
      // Si nadie la vuelve a montar en este mismo commit (remonte de Layout), se olvida la decisión.
      queueMicrotask(() => { if (memoria.montadas === 0) memoria.decision = null })
    }
  }, [])

  // Mientras Firebase revisa si hay sesión, no mostramos el formulario ni redirigimos
  if (habiaSesion === null) return <div className="text-center mt-5"><h3>Cargando...</h3></div>;

  return habiaSesion ? <Navigate to="/servicios" replace /> : <Outlet />;
}
