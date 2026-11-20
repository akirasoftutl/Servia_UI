import type { CSSProperties } from 'react';
import { MAX_DIAS_SEPARADOS, MAX_VALORES, etiquetaCorta, indicePico, indicesEtiquetas, marcasEje, promedioDiario, techoEscala, type DiaReservas } from './grafica';

const reservas = (n: number) => `${n} ${n === 1 ? 'reserva' : 'reservas'}`;
const decimal = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });
const alto = (valor: number, techo: number) => `${valor / techo * 100}%`;

/** Leyenda: qué significan las barras, el pico y la línea de promedio. */
export function LeyendaGrafica({ porDia }: { porDia: DiaReservas[] }) {
  const pico = indicePico(porDia);
  return <ul className="estadisticas-leyenda" aria-label="Leyenda de la gráfica">
    <li><span className="estadisticas-muestra" aria-hidden="true" />Reservas por día</li>
    {pico >= 0 && <li><span className="estadisticas-muestra estadisticas-muestra--pico" aria-hidden="true" />
      Pico ({etiquetaCorta(porDia[pico].fecha)} · {porDia[pico].reservas})</li>}
    {porDia.length > 0 && <li><span className="estadisticas-muestra estadisticas-muestra--promedio" aria-hidden="true" />
      Promedio: {decimal.format(promedioDiario(porDia))} / día</li>}
  </ul>;
}

/** Gráfica de barras en HTML y CSS: eje, líneas guía, valor por barra, promedio y la tabla equivalente oculta. */
export function GraficaReservas({ porDia, etiquetaAccesible }: { porDia: DiaReservas[]; etiquetaAccesible: string }) {
  const techo = techoEscala(porDia);
  const marcas = marcasEje(techo);
  const pico = indicePico(porDia);
  const promedio = promedioDiario(porDia);
  const etiquetas = indicesEtiquetas(porDia.length);
  const todosLosValores = porDia.length <= MAX_VALORES;
  const juntas = porDia.length > MAX_DIAS_SEPARADOS;
  return <>
    <div className={`estadisticas-grafica grafica-marco${juntas ? ' grafica-marco--densa' : ''}`} role="img" aria-label={etiquetaAccesible}>
      <div className="grafica-grid" aria-hidden="true">
        <div className="grafica-eje-y" style={{ '--digitos': String(techo).length } as CSSProperties}>
          <div className="grafica-eje-marcas">{marcas.map((valor) =>
            <span key={valor} style={{ bottom: alto(valor, techo) }}>{valor}</span>)}</div>
        </div>
        <div className="grafica-zona" style={{ '--dias': porDia.length } as CSSProperties}>
          <div className="grafica-guias">
            {marcas.filter((valor) => valor > 0).map((valor) => <span className="grafica-guia" key={valor} style={{ bottom: alto(valor, techo) }} />)}
            {promedio > 0 && <span className="grafica-promedio-linea" style={{ bottom: alto(promedio, techo) }} />}
          </div>
          {porDia.map((dia, i) =>
            <div className={`estadisticas-columna grafica-col${i === pico ? ' grafica-col--pico' : ''}`} key={dia.fecha} title={`${dia.fecha}: ${reservas(dia.reservas)}`}>
              <div className="estadisticas-barra grafica-barra" style={{ height: alto(dia.reservas, techo) }}>
                {dia.reservas > 0 && (todosLosValores || i === pico) && <span className="grafica-valor">{dia.reservas}</span>}
              </div>
            </div>)}
        </div>
        <div className="grafica-eje-x">{etiquetas.map((i) =>
          <span className={`grafica-fecha${i === pico ? ' grafica-fecha--pico' : ''}`} key={porDia[i].fecha}
            style={{ left: `${(i + 0.5) / porDia.length * 100}%` }}>{etiquetaCorta(porDia[i].fecha)}</span>)}</div>
      </div>
    </div>
    {/* Contenedor de bloque: en display:table .visually-hidden no recorta el alto de las filas y desborda el layout. */}
    <div className="visually-hidden">
      <table><caption>Reservas por día</caption>
        <thead><tr><th scope="col">Fecha</th><th scope="col">Reservas</th></tr></thead>
        <tbody>{porDia.map((dia) => <tr key={dia.fecha}><th scope="row">{dia.fecha}</th><td>{dia.reservas}</td></tr>)}</tbody>
      </table>
    </div>
  </>;
}
