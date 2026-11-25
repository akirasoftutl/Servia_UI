// Botón «Continuar con Google» con el estilo de `.social-btn` (definido en Login.css).
interface Props {
  onClick: () => void;
  cargando?: boolean;
  deshabilitado?: boolean;
}

export function BotonGoogle({ onClick, cargando = false, deshabilitado = false }: Props) {
  return (
    <div className="social-buttons">
      <button
        type="button"
        className="social-btn"
        onClick={onClick}
        disabled={cargando || deshabilitado}
        aria-label="Continuar con Google"
        aria-busy={cargando}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.11 0-5.74-2.1-6.68-4.93H1.21v3.15C3.2 21.3 7.31 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.32 14.27c-.24-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.21C.44 8.11 0 9.99 0 12s.44 3.89 1.21 5.42l4.11-3.15z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.2 2.7 1.21 6.58l4.11 3.15c.94-2.83 3.57-4.98 6.68-4.98z"
          />
        </svg>
        <span>{cargando ? 'Conectando...' : 'Continuar con Google'}</span>
      </button>
    </div>
  );
}
