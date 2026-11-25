import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contextos/AuthContext';

export const AVISO_PERFIL_NUEVO = 'Completa tu perfil para poder publicar servicios';

// Lógica compartida del botón «Continuar con Google» de Login y Registro.
export function useAccesoGoogle() {
  const navigate = useNavigate();
  const { iniciarSesionConGoogle } = useAuth();
  const [cargandoGoogle, setCargandoGoogle] = useState(false);

  const continuarConGoogle = async () => {
    setCargandoGoogle(true);
    try {
      const resultado = await iniciarSesionConGoogle();
      if (!resultado) return;
      if (resultado.nuevaCuenta) {
        navigate('/mi-perfil', { state: { aviso: AVISO_PERFIL_NUEVO } });
      } else {
        navigate('/resumen');
      }
    } finally {
      setCargandoGoogle(false);
    }
  };

  return { cargandoGoogle, continuarConGoogle };
}
