import { Users } from 'lucide-react';
import { EstadoCargando, EstadoError, EstadoVacio } from '../../componentes/panel/EstadosPanel';

export function EstadoClientes({ cargando, error, vacio, reintentar, carga, titulo = 'Sin resultados' }: {
  cargando: boolean; error: string; vacio: string; reintentar: () => void; carga: string; titulo?: string;
}) {
  return <>
    {cargando && <EstadoCargando mensaje={`Cargando ${carga}...`} />}
    {!cargando && error && <EstadoError mensaje={error} onReintentar={reintentar} />}
    {!cargando && !error && vacio && <EstadoVacio icono={Users} titulo={titulo} texto={vacio} />}
  </>;
}
