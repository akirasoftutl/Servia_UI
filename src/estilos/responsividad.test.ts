import { readFileSync } from 'node:fs';

const css = (ruta: string) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const regla = (fuente: string, selector: string) => {
  const inicio = fuente.indexOf(`${selector} {`);
  return inicio < 0 ? '' : fuente.slice(inicio, fuente.indexOf('}', inicio));
};

describe('responsividad del panel (reglas de CSS)', () => {
  it('Resumen: rejilla 2x2 bajo la tarjeta destacada en móvil y destacada + dos columnas en pantallas anchas, sin auto-fit', () => {
    const fuente = css('../paginas/resumen/Resumen.css');
    expect(regla(fuente, '.resumen-tarjetas')).toContain('repeat(2, minmax(0, 1fr))');
    expect(regla(fuente, '.resumen-hero')).toContain('grid-column: 1 / -1');
    expect(fuente).not.toContain('auto-fit');
    expect(fuente).toMatch(/@media \(min-width: 1100px\)[\s\S]*minmax\(0, 1\.15fr\) repeat\(2, minmax\(0, 1fr\)\)/);
  });

  it('Estadísticas: 2 columnas en móvil y 3x2 desde tablet, sin auto-fit', () => {
    const fuente = css('../paginas/estadisticas/Estadisticas.css');
    expect(regla(fuente, '.estadisticas-metricas')).toContain('repeat(2, minmax(0, 1fr))');
    expect(fuente).not.toContain('auto-fit');
    expect(fuente).toMatch(/@media \(min-width: 651px\)[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/);
  });

  it('Reservas: la tarjeta toma su disposición de la hoja de estilos', () => {
    expect(regla(css('../paginas/reservas/Reservas.css'), '.reserva-card')).toContain('cursor: pointer');
  });

  it('Horario: la insignia no define un segundo punto', () => {
    expect(css('../paginas/horario/Horario.css')).not.toContain('horario-estado-punto');
  });
});
