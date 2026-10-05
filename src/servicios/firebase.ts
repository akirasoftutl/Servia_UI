import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

// Configuración pública de la app web registrada en Firebase (no es secreta).
// Si falta, el panel carga igual; el inicio de sesión llega con MVP-03.
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseConfigurado = Boolean(config.apiKey && config.projectId && config.appId)

const app: FirebaseApp | null = firebaseConfigurado ? initializeApp(config) : null

// Autenticación de Firebase, o null si faltan las variables VITE_FIREBASE_*.
export const auth: Auth | null = app ? getAuth(app) : null

if (!firebaseConfigurado && import.meta.env.DEV) {
  console.warn('Faltan las variables VITE_FIREBASE_* (ver .env.example): el inicio de sesión no funcionará.')
}
