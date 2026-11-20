import type { RouteObject } from 'react-router'
import { rutas } from './router'

const rutasHijas = (lista: RouteObject[]): string[] =>
  lista.flatMap(ruta => [...(ruta.path ? [ruta.path] : []), ...rutasHijas(ruta.children ?? [])])

it('UI109 cada ruta del panel se declara una sola vez', () => {
  const caminos = rutasHijas(rutas).filter(camino => camino !== '/' && camino !== '*')
  const repetidas = caminos.filter((camino, i) => caminos.indexOf(camino) !== i)
  expect(repetidas).toEqual([])
})
