import { useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { camposSinDato, type DetalleLugar } from './direccion'
import { useAutocompletarDomicilio } from './useAutocompletarDomicilio'

export const AVISO_SUGERENCIA = 'Revisa que la calle quede sin colonia ni ciudad y completa el resto de los campos.'

export const AVISO_REVISAR = 'Revisa los campos: completa lo que falte.'

// Lo que recibe el formulario al elegir: el texto de la sugerencia y, si la API
// lo dio, el detalle por campos.
export interface EleccionCalle {
  texto: string
  detalle: DetalleLugar | null
}

interface Props {
  value: string
  error?: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  // Con detalle llena cada campo; sin él, cae a la decisión A1 (texto completo en «Calle»).
  onElegir: (eleccion: EleccionCalle) => void
}

const ID_LISTA = 'calle-sugerencias'
const idOpcion = (indice: number) => `${ID_LISTA}-${indice}`

// Campo «Calle» con sugerencias de domicilio como combobox accesible.
export function CampoCalle({ value, error, onChange, onElegir }: Props) {
  const { sugerencias, abierta, nota, buscar, cerrar, terminarSesion, elegir: elegirLugar } = useAutocompletarDomicilio()
  const [activa, setActiva] = useState(-1)
  const [aviso, setAviso] = useState('')

  const expandida = abierta
  const hayOpciones = expandida && sugerencias.length > 0

  const cerrarLista = () => {
    cerrar()
    setActiva(-1)
  }

  const elegir = (indice: number) => {
    const sugerencia = sugerencias[indice]
    if (sugerencia === undefined) return
    setActiva(-1)
    setAviso('')
    // El campo sigue editable mientras llega el detalle; si el negocio escribe o
    // elige otra cosa, la respuesta se descarta.
    void elegirLugar(sugerencia).then(({ vigente, detalle }) => {
      if (!vigente) return
      onElegir({ texto: sugerencia.texto, detalle })
      if (detalle === null) setAviso(AVISO_SUGERENCIA)
      else if (camposSinDato(detalle).length > 0) setAviso(AVISO_REVISAR)
    })
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e)
    setActiva(-1)
    // Si el negocio edita la calle tras elegir, el aviso ya cumplió su papel.
    setAviso('')
    buscar(e.target.value)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        if (!hayOpciones) return
        e.preventDefault()
        setActiva((actual) => (actual + 1) % sugerencias.length)
        return
      case 'ArrowUp':
        if (!hayOpciones) return
        e.preventDefault()
        setActiva((actual) => (actual <= 0 ? sugerencias.length - 1 : actual - 1))
        return
      case 'Enter':
        // Sin opción activa, Enter se comporta como siempre.
        if (!hayOpciones || activa < 0) return
        e.preventDefault()
        elegir(activa)
        return
      case 'Escape':
        if (!expandida) return
        e.preventDefault()
        cerrarLista()
        return
    }
  }

  // Perder el foco (Tab o clic fuera) cierra sin elegir ni borrar lo escrito.
  const handleBlur = () => {
    terminarSesion()
    setActiva(-1)
  }

  return (
    <div className="perfil-calle">
      <input
        id="calle"
        type="text"
        name="calle"
        className={`form-control ${error ? 'is-invalid' : ''}`}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder="Ej. Avenida Juárez"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expandida}
        aria-controls={ID_LISTA}
        aria-activedescendant={hayOpciones && activa >= 0 ? idOpcion(activa) : undefined}
      />

      <div className="perfil-calle-lista" hidden={!expandida}>
        <ul id={ID_LISTA} role="listbox" aria-label="Direcciones sugeridas" className="list-unstyled mb-0">
          {hayOpciones && sugerencias.map(({ texto }, indice) => (
            <li
              key={`${indice}-${texto}`}
              id={idOpcion(indice)}
              role="option"
              aria-selected={indice === activa}
              className={`perfil-calle-opcion ${indice === activa ? 'activa' : ''}`}
              // mousedown + preventDefault: el campo no pierde el foco y el clic no se pierde.
              onMouseDown={(e) => {
                e.preventDefault()
                elegir(indice)
              }}
            >
              {texto}
            </li>
          ))}
        </ul>
        <p className="perfil-calle-vacio" aria-live="polite">
          {expandida && sugerencias.length === 0 ? 'Sin sugerencias' : ''}
        </p>
        <p className="perfil-calle-atribucion" translate="no">Google Maps</p>
      </div>

      {error && <div className="invalid-feedback">{error}</div>}

      <p className="panel-ayuda perfil-calle-nota" aria-live="polite">{nota}</p>
      {aviso && (
        <p className="panel-ayuda perfil-calle-nota" role="status">{aviso}</p>
      )}
    </div>
  )
}
