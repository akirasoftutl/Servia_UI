import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ErrorApi } from '../../servicios/api'

// Sugerencias de domicilio que da la API (`GET /lugares/autocompletar`). La
// llave de Google vive solo en la API: el panel nunca llama a Google.
export const ESPERA_MS = 300
export const MIN_LETRAS = 3
export const MAX_LETRAS = 100
export const MAX_SUGERENCIAS = 5
export const NOTA_SIN_SUGERENCIAS = 'No hay sugerencias por ahora; escribe la dirección a mano.'

export interface Sugerencia {
  texto: string
  lugarId: string
}

// Token de sesión de Places: agrupa las peticiones de una misma captura.
// Debe cumplir `^[A-Za-z0-9_-]{1,36}$`.
export function nuevoTokenSesion(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  let token = ''
  while (token.length < 32) token += Math.random().toString(36).slice(2)
  return token.slice(0, 32)
}

export function useAutocompletarDomicilio() {
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([])
  const [abierta, setAbierta] = useState(false)
  const [nota, setNota] = useState('')

  const temporizador = useRef<number | undefined>(undefined)
  const controlador = useRef<AbortController | null>(null)
  // Cada búsqueda nueva sube la versión; una respuesta de otra versión es vieja.
  const version = useRef(0)
  const sesion = useRef<string | null>(null)

  const cancelar = useCallback(() => {
    version.current += 1
    window.clearTimeout(temporizador.current)
    temporizador.current = undefined
    controlador.current?.abort()
    controlador.current = null
  }, [])

  useEffect(() => cancelar, [cancelar])

  const buscar = useCallback((texto: string) => {
    cancelar()
    setNota('')
    if (!sesion.current) sesion.current = nuevoTokenSesion()

    const q = texto.trim()
    if (q.length < MIN_LETRAS || q.length > MAX_LETRAS) {
      setSugerencias([])
      setAbierta(false)
      return
    }

    const mia = version.current
    temporizador.current = window.setTimeout(async () => {
      const peticion = new AbortController()
      controlador.current = peticion
      const parametros = new URLSearchParams({ q, sesion: sesion.current ?? nuevoTokenSesion() })
      try {
        const datos = await api<Sugerencia[]>(`/lugares/autocompletar?${parametros}`, { signal: peticion.signal })
        if (mia !== version.current) return
        const elegibles = (Array.isArray(datos) ? datos : [])
          .filter((sugerencia) => typeof sugerencia?.texto === 'string' && sugerencia.texto.trim() !== '')
          .map((sugerencia) => ({
            texto: sugerencia.texto,
            lugarId: typeof sugerencia.lugarId === 'string' ? sugerencia.lugarId : '',
          }))
          .slice(0, MAX_SUGERENCIAS)
        setSugerencias(elegibles)
        setAbierta(true)
      } catch (error) {
        if (mia !== version.current) return
        setSugerencias([])
        setAbierta(false)
        // Solo 429 y 503 merecen una nota; red, 400, 401, 403 o cuerpo raro: silencio.
        if (error instanceof ErrorApi && (error.estado === 429 || error.estado === 503)) {
          setNota(NOTA_SIN_SUGERENCIAS)
        }
      }
    }, ESPERA_MS)
  }, [cancelar])

  // Escape o Tab: cierra sin borrar lo escrito ni cambiar de sesión.
  const cerrar = useCallback(() => {
    cancelar()
    setAbierta(false)
  }, [cancelar])

  // Al elegir o al perder el foco: cierra y la siguiente captura usa otra sesión.
  const terminarSesion = useCallback(() => {
    cerrar()
    sesion.current = null
  }, [cerrar])

  return { sugerencias, abierta, nota, buscar, cerrar, terminarSesion }
}
