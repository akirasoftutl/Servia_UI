import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Ayuda } from './Ayuda';

it('C2 expande varias respuestas con ratón, Enter y Espacio y las contrae', async () => {
  const user = userEvent.setup();
  render(<Ayuda />);
  const botones = screen.getAllByRole('button');
  for (const boton of botones) expect(boton).toHaveAttribute('aria-expanded', 'false');
  await user.click(botones[0]);
  expect(botones[0]).toHaveAttribute('aria-expanded', 'true');
  expect(document.getElementById(botones[0].getAttribute('aria-controls')!)).toBeVisible();
  botones[1].focus();
  await user.keyboard('{Enter}');
  expect(botones[1]).toHaveAttribute('aria-expanded', 'true');
  await user.keyboard(' ');
  expect(botones[1]).toHaveAttribute('aria-expanded', 'false');
  await user.click(botones[0]);
  expect(document.getElementById(botones[0].getAttribute('aria-controls')!)).not.toBeVisible();
});
it('C3 filtra preguntas y respuestas ignorando acentos, mayúsculas y espacios', async () => {
  const user = userEvent.setup();
  render(<Ayuda />);
  const buscar = screen.getByRole('searchbox');
  await user.type(buscar, '  SESION  ');
  expect(screen.getByRole('button', { name: '¿Cómo cierro mi sesión?' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Reservas' })).not.toBeInTheDocument();
  await user.clear(buscar);
  await user.type(buscar, 'historial');
  expect(screen.getByRole('button', { name: '¿Dónde administro mis servicios?' })).toBeVisible();
  expect(screen.getAllByRole('button')).toHaveLength(1);
});
it('C3 muestra vacío claro y permite recuperar todas las categorías', async () => {
  const user = userEvent.setup();
  render(<Ayuda />);
  await user.type(screen.getByRole('searchbox'), 'sincoincidencias');
  expect(screen.getByRole('status')).toHaveTextContent('No encontramos preguntas');
  await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
  for (const name of ['Reservas', 'Servicios y horario', 'Cuenta']) expect(screen.getByRole('heading', { name })).toBeVisible();
  expect(screen.getAllByRole('button')).toHaveLength(6);
});
it('C4 conserva cabecera, tarjetas y clases del sistema compartido sin CSS ni dependencias propias', () => {
  const { container } = render(<Ayuda />);
  expect(container.querySelector('.panel-pagina > .panel-contenedor > .panel-encabezado .panel-titulo')).toHaveTextContent('Ayuda');
  expect(container.querySelectorAll('.panel-tarjeta')).toHaveLength(4);
  expect(container.querySelector('[style]')).toBeNull();
  const fuente = readFileSync('src/paginas/ayuda/Ayuda.tsx', 'utf8');
  const css = readFileSync('src/estilos/panel.css', 'utf8');
  expect(fuente).not.toMatch(/\b\d+(px|rem)\b|#[\da-f]{3,8}\b|alert\(/i);
  expect(fuente.match(/import .*\.css['"]/g)).toEqual(["import '../../estilos/panel.css'"]);
  for (const nodo of container.querySelectorAll('[class]')) for (const clase of nodo.classList) expect(css).toContain(`.${clase}`);
});
