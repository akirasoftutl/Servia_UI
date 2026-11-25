import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from '../servicios/firebase';
import { api, ErrorSinConexion, MENSAJE_REQUIERE_CONEXION, vaciarCacheDatos } from '../servicios/api';
import { alertaDeError, aviso } from '../servicios/alertas';
import { vaciarCola } from '../servicios/colaOffline';
import { desactivarTokenPushActual } from '../servicios/notificaciones';

// Resultado de continuar con Google: `null` si no hay nada que hacer en la pantalla
// (la persona cerró la ventana, se fue a Google por redirección o ya se mostró el error).
export interface ResultadoGoogle {
  nuevaCuenta: boolean;
}

interface RespuestaGoogle extends ResultadoGoogle {
  tipo: string;
}

interface AuthContextType {
  usuario: User | null;
  cargando: boolean;
  cerrarSesion: () => Promise<void>;
  iniciarSesionConGoogle: () => Promise<ResultadoGoogle | null>;
  // Destino pendiente tras volver de Google por redirección (se lee una sola vez).
  leerBienvenidaGoogle: () => ResultadoGoogle | null;
  limpiarBienvenidaGoogle: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Marca que sobrevive a la redirección a Google para saber, al volver, que hay una cuenta por preparar.
const MARCA_REDIRECCION = 'servia:google-redireccion';

const CODIGOS_CERRADO = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'];
const CODIGOS_SIN_POPUP = ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'];

function codigoDe(causa: unknown): string {
  return causa && typeof causa === 'object' && 'code' in causa ? String((causa as { code: unknown }).code) : '';
}

function leerMarca(): boolean {
  try {
    return localStorage.getItem(MARCA_REDIRECCION) === '1';
  } catch {
    return false;
  }
}

function escribirMarca(activa: boolean) {
  try {
    if (activa) localStorage.setItem(MARCA_REDIRECCION, '1');
    else localStorage.removeItem(MARCA_REDIRECCION);
  } catch {
    // Sin almacenamiento no hay marca: la redirección sigue funcionando sin ella.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [cargando, setCargando] = useState(true);
  // «Preparando cuenta de Google»: mientras es true, onAuthStateChanged no verifica con /auth/yo,
  // porque justo tras entrar con Google el perfil de negocio todavía no existe.
  const preparando = useRef(false);
  const omitido = useRef<User | null>(null);
  const bienvenida = useRef<ResultadoGoogle | null>(null);
  const redireccionProcesada = useRef(false);

  const verificar = async (user: User) => {
    try {
      // Verificamos con la API si es negocio
      const respuesta = await api<{ tipo: string }>('/auth/yo');
      if (respuesta.tipo === 'negocio') {
        setUsuario(user);
      } else {
        // Si es cliente, lo sacamos inmediatamente
        await signOut(auth!);
        setUsuario(null);
      }
    } catch (error) {
      // Sin red no cerramos sesión: Firebase conserva el usuario en el
      // dispositivo y las lecturas se sirven desde la caché local.
      const sinConexion = Boolean(error && typeof error === 'object' && 'sinConexion' in error);
      if (sinConexion) {
        setUsuario(user);
      } else {
        // Si la cuenta está desactivada (403) o hay error, lo sacamos
        await signOut(auth!);
        setUsuario(null);
      }
    }
    setCargando(false);
  };

  // Termina la preparación; devuelve el usuario cuya verificación se pospuso, si quedó alguno.
  const terminarPreparacion = (): User | null => {
    preparando.current = false;
    escribirMarca(false);
    const pospuesto = omitido.current;
    omitido.current = null;
    return pospuesto;
  };

  // Crea o reconoce la cuenta de negocio en la API y deja la sesión lista.
  const completarCuentaGoogle = async (user: User, porRedireccion: boolean): Promise<ResultadoGoogle> => {
    const respuesta = await api<RespuestaGoogle>('/auth/google/negocio', { method: 'POST', sinCola: true });
    if (respuesta.tipo !== 'negocio') throw new Error('La cuenta no es de negocio');
    // Trae el claim nuevo del token (la cuenta se acaba de crear o completar).
    await user.getIdToken(true);
    const resultado = { nuevaCuenta: Boolean(respuesta.nuevaCuenta) };
    if (porRedireccion) bienvenida.current = resultado;
    terminarPreparacion();
    setUsuario(user);
    setCargando(false);
    return resultado;
  };

  // Sin sesión a medias: cierra la que abrió Google y explica qué pasó.
  const fallarGoogle = async (causa: unknown) => {
    try {
      if (auth?.currentUser) await signOut(auth);
    } catch {
      // La sesión local se descarta de todos modos al recargar.
    }
    terminarPreparacion();
    setUsuario(null);
    setCargando(false);
    if (CODIGOS_CERRADO.includes(codigoDe(causa))) return;
    if (causa instanceof ErrorSinConexion || codigoDe(causa) === 'auth/network-request-failed') {
      const mensaje = causa instanceof ErrorSinConexion ? causa.message : MENSAJE_REQUIERE_CONEXION;
      await aviso(mensaje, 'Sin conexión');
      return;
    }
    await alertaDeError(causa, 'No pudimos continuar con Google. Intenta de nuevo.');
  };

  const iniciarSesionConGoogle = async (): Promise<ResultadoGoogle | null> => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await aviso(MENSAJE_REQUIERE_CONEXION, 'Sin conexión');
      return null;
    }
    // La marca va ANTES de abrir Google: onAuthStateChanged se dispara dentro del popup.
    preparando.current = true;
    const proveedor = new GoogleAuthProvider();
    proveedor.setCustomParameters({ prompt: 'select_account' });
    try {
      let user: User;
      try {
        user = (await signInWithPopup(auth!, proveedor)).user;
      } catch (causa) {
        if (CODIGOS_CERRADO.includes(codigoDe(causa))) {
          const pospuesto = terminarPreparacion();
          if (pospuesto) await verificar(pospuesto);
          return null;
        }
        if (!CODIGOS_SIN_POPUP.includes(codigoDe(causa))) throw causa;
        // El navegador no deja abrir el popup (o es una PWA instalada): vamos por redirección.
        escribirMarca(true);
        await signInWithRedirect(auth!, proveedor);
        return null;
      }
      return await completarCuentaGoogle(user, false);
    } catch (causa) {
      await fallarGoogle(causa);
      return null;
    }
  };

  useEffect(() => {
    // Si volvemos de Google por redirección, la cuenta por preparar se atiende antes de verificar.
    const volviendoDeGoogle = leerMarca();
    if (volviendoDeGoogle) preparando.current = true;

    const unsubscribe = onAuthStateChanged(auth!, async (user) => {
      if (user) {
        if (preparando.current) {
          omitido.current = user;
          return;
        }
        await verificar(user);
      } else {
        setUsuario(null);
        if (!preparando.current) setCargando(false);
      }
    });

    if (volviendoDeGoogle && !redireccionProcesada.current) {
      redireccionProcesada.current = true;
      void (async () => {
        try {
          const resultado = await getRedirectResult(auth!);
          if (resultado?.user) {
            await completarCuentaGoogle(resultado.user, true);
          } else {
            const pospuesto = terminarPreparacion();
            if (pospuesto) await verificar(pospuesto);
            else setCargando(false);
          }
        } catch (causa) {
          await fallarGoogle(causa);
        }
      })();
    }

    return () => unsubscribe();
  }, []);

  const cerrarSesion = async () => {
    await desactivarTokenPushActual();
    // No dejamos datos ni acciones pendientes del negocio en el dispositivo.
    await Promise.all([vaciarCola(), vaciarCacheDatos()]);
    await signOut(auth!);
    setUsuario(null);
  };

  const leerBienvenidaGoogle = () => bienvenida.current;
  const limpiarBienvenidaGoogle = () => {
    bienvenida.current = null;
  };

  return (
    <AuthContext.Provider
      value={{
        usuario,
        cargando,
        cerrarSesion,
        iniciarSesionConGoogle,
        leerBienvenidaGoogle,
        limpiarBienvenidaGoogle,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook para usar el contexto fácilmente
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de un AuthProvider');
  return context;
}
