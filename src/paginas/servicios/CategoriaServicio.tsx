import type { ChangeEvent } from 'react';
import { BotonPanel } from '../../componentes/panel/BotonPanel';
import { ErrorCampo } from '../../componentes/panel/ErrorCampo';
import {
  MAX_CATEGORIA_PERSONALIZADA, VALOR_OTRA,
  type CatalogoCategorias, type CategoriaElegida,
} from './categorias';

interface Props {
  valor: CategoriaElegida;
  alCambiar: (valor: CategoriaElegida) => void;
  catalogo: CatalogoCategorias;
  error: string;
  // Categoría guardada en el servicio, para seguir mostrándola si el catálogo ya no la ofrece.
  actual?: { id: string; nombre: string } | null;
}

export function CategoriaServicio({ valor, alCambiar, catalogo, error, actual }: Props) {
  if (catalogo.estado === 'cargando') {
    return <div className="mb-4" aria-busy="true"><p className="panel-ayuda m-0" aria-live="polite">Cargando categorías...</p></div>;
  }
  if (catalogo.estado === 'error') {
    return (
      <div className="mb-4">
        <p className="form-label">Categoría del servicio (opcional)</p>
        <p aria-live="polite" className="panel-alerta panel-alerta--error">No se pudieron cargar las categorías.</p>
        {actual && <p className="panel-ayuda">Categoría actual: {actual.nombre}. Se conserva si no la cambias.</p>}
        <BotonPanel variante="secundario" tamano="sm" onClick={catalogo.reintentar}>Reintentar</BotonPanel>
        <small className="panel-ayuda mt-2 d-block">Puedes guardar el servicio sin cambiar su categoría.</small>
      </div>
    );
  }

  const opciones = catalogo.categorias;
  const faltaActual = valor.modo === 'catalogo' && !opciones.some(c => c.id === valor.id);
  const seleccionado = valor.modo === 'otra' ? VALOR_OTRA : valor.modo === 'catalogo' ? valor.id : '';
  const cambiarSelect = (e: ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v === VALOR_OTRA) alCambiar({ modo: 'otra', id: '', texto: valor.texto });
    else if (v === '') alCambiar({ modo: 'ninguna', id: '', texto: '' });
    else alCambiar({ modo: 'catalogo', id: v, texto: '' });
  };
  const ayuda = catalogo.sinCategoriaNegocio
    ? 'Elige la categoría de tu negocio en Mi perfil para ver las categorías disponibles. Mientras tanto puedes escribir la tuya con «Otra».'
    : opciones.length === 0
      ? 'Tu categoría de negocio aún no tiene categorías de servicio. Puedes escribir la tuya con «Otra».'
      : 'Ayuda a tus clientes a encontrar este servicio.';
  const hayErrorSelect = Boolean(error) && valor.modo !== 'otra';

  return (
    <div className="mb-4">
      <label htmlFor="categoria-servicio" className="form-label">Categoría del servicio (opcional)</label>
      <select id="categoria-servicio" className={`form-select ${hayErrorSelect ? 'is-invalid' : ''}`}
        value={seleccionado} onChange={cambiarSelect}
        aria-invalid={hayErrorSelect || undefined}
        aria-describedby={hayErrorSelect ? 'categoria-servicio-error' : 'categoria-servicio-ayuda'}>
        <option value="">Sin categoría</option>
        {faltaActual && <option value={valor.id}>{actual?.id === valor.id ? actual.nombre : 'Categoría actual'}</option>}
        {opciones.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        <option value={VALOR_OTRA}>Otra (escribir la mía)</option>
      </select>
      {hayErrorSelect
        ? <ErrorCampo id="categoria-servicio-error" mensaje={error} />
        : <small id="categoria-servicio-ayuda" className="panel-ayuda mt-2 d-block">{ayuda}</small>}

      {valor.modo === 'otra' && (
        <div className="mt-3">
          <label htmlFor="categoria-personalizada" className="form-label">Tu categoría</label>
          <input id="categoria-personalizada" type="text" maxLength={MAX_CATEGORIA_PERSONALIZADA}
            className={`form-control ${error ? 'is-invalid' : ''}`} value={valor.texto}
            placeholder="Ej. Novias"
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? 'categoria-personalizada-error categoria-personalizada-pie' : 'categoria-personalizada-pie'}
            onChange={e => alCambiar({ modo: 'otra', id: '', texto: e.target.value })} />
          <div id="categoria-personalizada-pie" className="servicio-campo-pie">
            {error ? <ErrorCampo id="categoria-personalizada-error" mensaje={error} /> : <span className="panel-ayuda">Hasta {MAX_CATEGORIA_PERSONALIZADA} caracteres.</span>}
            <span className="panel-ayuda">{valor.texto.length}/{MAX_CATEGORIA_PERSONALIZADA}</span>
          </div>
        </div>
      )}
    </div>
  );
}
