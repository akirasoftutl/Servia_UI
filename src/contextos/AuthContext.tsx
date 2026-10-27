import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from '../servicios/firebase';
import { api } from '../servicios/api';

interface AuthContextType {
  usuario: User | null;
  cargando: boolean;
  cerrarSesion: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Forzar cierre de sesión al iniciar para no mantener sesión persistente
    if (auth) {
      signOut(auth).catch(() => {});
    }
   
    const unsubscribe = onAuthStateChanged(auth!, async (user) => {
      if (user) {
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
          // Si la cuenta está desactivada (403) o hay error, lo sacamos
          await signOut(auth!);
          setUsuario(null);
        }
      } else {
        setUsuario(null);
      }
      setCargando(false);
    });

    return () => unsubscribe();
  }, []);

  const cerrarSesion = async () => {
    await signOut(auth!);
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, cargando, cerrarSesion }}>
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