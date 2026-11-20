import { render, screen } from '@testing-library/react';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Clock } from 'lucide-react';
import { EyebrowPanel } from './EyebrowPanel';

const GRUPOS_EYEBROW = {
  operacion: 'Operación diaria',
  negocio: 'Mi negocio',
  configuracion: 'Configuración',
} as const;

function archivosDePaginas(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivosDePaginas(ruta);
    return /\.tsx$/.test(nombre) && !/\.test\.tsx$/.test(nombre) ? [ruta] : [];
  });
}

describe('EyebrowPanel', () => {
  it.each(Object.entries(GRUPOS_EYEBROW))('muestra el grupo %s con un ícono decorativo', (grupo, nombre) => {
    const { container } = render(<EyebrowPanel grupo={grupo as keyof typeof GRUPOS_EYEBROW} icono={Clock} />);
    expect(screen.getByText(nombre)).toHaveClass('panel-eyebrow');
    const icono = container.querySelector('.panel-eyebrow > svg');
    expect(icono).toHaveAttribute('aria-hidden', 'true');
  });

  it('todas las cabeceras de las pantallas usan el mismo componente, sin rótulos sueltos', () => {
    const dir = join(process.cwd(), 'src/paginas');
    const sueltos: string[] = [];
    const sinComponente: string[] = [];
    for (const archivo of archivosDePaginas(dir)) {
      const fuente = readFileSync(archivo, 'utf8');
      // El rótulo de tarjeta «PLAN SEMANAL» de Horario no es cabecera de pantalla.
      const eyebrowsSueltos = [...fuente.matchAll(/<span className="panel-eyebrow">([^<]*)/g)].filter((m) => m[1] !== 'PLAN SEMANAL');
      if (eyebrowsSueltos.length) sueltos.push(archivo);
      if (/<h1 className="panel-titulo/.test(fuente) && !fuente.includes('<EyebrowPanel')) sinComponente.push(archivo);
    }
    expect(sueltos).toEqual([]);
    expect(sinComponente).toEqual([]);
  });
});
