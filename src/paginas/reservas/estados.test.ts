import { formatearFecha, formatearHora } from './estados';

describe('hora y fecha de México (C4)', () => {
  it.each([
    ['2030-11-03T16:00:00Z', '10:00', '03 nov 2030'],
    ['2030-11-04T00:00:00Z', '18:00', '03 nov 2030'],
    ['2030-11-04T05:59:00Z', '23:59', '03 nov 2030'],
    ['2030-11-04T06:00:00Z', '00:00', '04 nov 2030'],
  ])('%s conserva la fecha local y muestra %s', (iso, hora, fecha) => {
    expect(formatearHora(iso)).toBe(hora);
    expect(formatearFecha(iso).replaceAll('.', '')).toBe(fecha);
  });
});
