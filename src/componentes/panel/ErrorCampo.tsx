interface ErrorCampoProps {
  id: string
  mensaje?: string
  className?: string
}

export function ErrorCampo({ id, mensaje, className }: ErrorCampoProps) {
  if (!mensaje) return null
  return (
    <p
      id={id}
      role="alert"
      className={className ? `panel-error-campo ${className}` : 'panel-error-campo'}
    >
      {mensaje}
    </p>
  )
}
