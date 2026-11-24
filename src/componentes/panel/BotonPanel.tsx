import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';

type VarianteBoton = 'primario' | 'secundario' | 'peligro';
type TamanoBoton = 'md' | 'sm';

const CLASE_VARIANTE: Record<VarianteBoton, string> = {
  primario: 'btn-servia-primary',
  secundario: 'btn-servia-secondary',
  peligro: 'btn-servia-danger',
};

interface PropsComunes {
  variante?: VarianteBoton;
  tamano?: TamanoBoton;
  bloque?: boolean;
  className?: string;
  children: ReactNode;
}

type PropsBoton = PropsComunes &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & {
    to?: undefined;
  };

type PropsEnlace = PropsComunes &
  Omit<LinkProps, 'className' | 'children'> & {
    to: LinkProps['to'];
  };

/** Botón compartido del panel (primario, secundario o peligro); si recibe `to`, rinde un Link. */
export function BotonPanel(props: PropsBoton | PropsEnlace) {
  const {
    variante = 'primario',
    tamano = 'md',
    bloque = false,
    className = '',
    children,
  } = props;

  const clases = [
    CLASE_VARIANTE[variante],
    tamano === 'sm' ? 'btn-servia-sm' : '',
    bloque ? 'btn-servia-bloque' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if ('to' in props && props.to !== undefined) {
    const { variante: _v, tamano: _t, bloque: _b, className: _c, children: _ch, ...resto } = props;
    return (
      <Link className={clases} {...resto}>
        {children}
      </Link>
    );
  }

  const {
    variante: _v,
    tamano: _t,
    bloque: _b,
    className: _c,
    children: _ch,
    type = 'button',
    ...resto
  } = props as PropsBoton;
  return (
    <button type={type} className={clases} {...resto}>
      {children}
    </button>
  );
}
