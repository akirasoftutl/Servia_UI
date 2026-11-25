import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../contextos/AuthContext';
import { AVISO_PERFIL_NUEVO } from '../utilidades/useAccesoGoogle';

// Guarda para /login y /registro-negocio: si ya había sesión al entrar, manda al panel.
//
// La decisión se toma una sola vez por entrada de navegación (location.key), con el primer
// valor resuelto de la sesión. Si el usuario inicia sesión o se registra desde la pantalla,
// `usuario` cambia pero NO se redirige aquí: el formulario conserva su propio destino
// (/resumen al iniciar sesión, /mi-perfil al registrarse). Se guarda fuera del componente porque Layout se remonta al cambiar el uid
// de la sesión (key={uid}) y se llevaría el estado local.
const memoria = { decision: null as { clave: string; habiaSesion: boolean; nuevaCuenta: boolean } | null, montadas: 0 }

export function RutaSoloVisitantes() {
  const { usuario, cargando, leerBienvenidaGoogle, limpiarBienvenidaGoogle } = useAuth();
  const { key } = useLocation();

  const recordada = memoria.decision?.clave === key ? memoria.decision.habiaSesion : null
  // null mientras Firebase revisa si hay sesión
  const habiaSesion = recordada ?? (cargando ? null : !!usuario)

  // Cuenta nueva que volvió de Google por redirección: va a completar su perfil, no al resumen.
  const nuevaCuenta = memoria.decision?.clave === key
    ? memoria.decision.nuevaCuenta
    : Boolean(leerBienvenidaGoogle?.()?.nuevaCuenta)

  useEffect(() => {
    if (habiaSesion !== null) {
      memoria.decision = { clave: key, habiaSesion, nuevaCuenta }
      limpiarBienvenidaGoogle?.()
    }
  }, [key, habiaSesion, nuevaCuenta, limpiarBienvenidaGoogle])

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

  if (!habiaSesion) return <Outlet />;
  return nuevaCuenta
    ? <Navigate to="/mi-perfil" replace state={{ aviso: AVISO_PERFIL_NUEVO }} />
    : <Navigate to="/resumen" replace />;
}
