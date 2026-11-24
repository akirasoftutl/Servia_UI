import { useRef, useState } from 'react';
import { api, ErrorApi } from '../../servicios/api';
import { BotonPanel } from '../../componentes/panel/BotonPanel';
import { alertaDeError, confirmar, error as alertaError, exito } from '../../servicios/alertas';

const AVISO = 'Ya no tienes servicios activos: tu negocio no aparece para los clientes hasta que actives uno.';
const ERROR = 'No pudimos guardar los cambios. Intenta de nuevo.';
const ERROR_VISIBILIDAD = 'Servicio eliminado. No pudimos consultar la visibilidad del negocio. Intenta de nuevo.';

// RN-11 y RN-23/D6: la API decide visibilidad y si existen reservas.
export function AccionesServicio({ id, nombre, activo, alCambiarEstado, alEliminar }: {
  id: string; nombre: string; activo: boolean;
  alCambiarEstado: (activo: boolean) => void;
  alEliminar: (mensaje: string) => void;
  alMensaje?: (mensaje: string) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [errorVisibilidad, setErrorVisibilidad] = useState(false);
  const [eliminado, setEliminado] = useState(false);
  const enProceso = useRef(false);
  const ruta = `/negocios/mio/servicios/${id}`;

  async function consultarVisibilidad() {
    const perfil = await api<{ visible: boolean }>('/negocios/mio');
    const mensaje = `Servicio eliminado.${perfil.visible === false ? ` ${AVISO}` : ''}`;
    setErrorVisibilidad(false);
    await exito(mensaje);
    alEliminar(mensaje);
  }

  async function cambiarEstado(nuevoActivo = !activo) {
    setOcupado(true);
    try {
      const respuesta = await api<{ visible: boolean }>(`${ruta}/estado`, {
        method: 'PATCH', body: JSON.stringify({ activo: nuevoActivo }),
      });
      alCambiarEstado(nuevoActivo);
      await exito(`Servicio ${nuevoActivo ? 'activado' : 'desactivado'}.${respuesta.visible === false ? ` ${AVISO}` : ''}`);
    } catch (causa: unknown) {
      await alertaDeError(causa, ERROR);
    } finally {
      setOcupado(false);
    }
  }

  async function solicitarCambioEstado() {
    if (ocupado || eliminado || enProceso.current) return;
    enProceso.current = true;
    try {
      if (activo) {
        const aceptado = await confirmar({
          titulo: 'Desactivar servicio',
          texto: `¿Desactivar «${nombre}»? Los clientes ya no podrán reservarlo. Sus reservas existentes no cambian.`,
          confirmar: 'Desactivar',
          cancelar: 'Cancelar',
        });
        if (!aceptado) return;
      }
      await cambiarEstado(!activo);
    } finally {
      enProceso.current = false;
    }
  }

  async function solicitarEliminacion() {
    if (ocupado || eliminado || enProceso.current) return;
    enProceso.current = true;
    try {
      const aceptado = await confirmar({
        titulo: 'Eliminar servicio',
        texto: `¿Eliminar «${nombre}»? Esta acción no se puede deshacer.`,
        confirmar: 'Eliminar',
        cancelar: 'Cancelar',
        peligro: true,
      });
      if (!aceptado) return;

      setOcupado(true);
      try {
        await api(ruta, { method: 'DELETE' });
      } catch (causa: unknown) {
        setOcupado(false);
        if (causa instanceof ErrorApi && causa.estado === 409) {
          const desactivar = await confirmar({
            titulo: 'Desactivar servicio',
            texto: 'Este servicio ya tuvo reservas, así que no se puede eliminar. Puedes desactivarlo para que deje de ofrecerse.',
            confirmar: 'Desactivar',
            cancelar: 'Cancelar',
          });
          if (desactivar) await cambiarEstado(false);
        } else {
          await alertaDeError(causa, ERROR);
        }
        return;
      }

      setEliminado(true);
      // DELETE devuelve 204. Consultar el perfil evita depender de CORS/X-Visible.
      try {
        await consultarVisibilidad();
      } catch {
        setErrorVisibilidad(true);
        await alertaError(ERROR_VISIBILIDAD);
      } finally {
        setOcupado(false);
      }
    } finally {
      enProceso.current = false;
    }
  }

  async function reintentarVisibilidad() {
    if (ocupado) return;
    setOcupado(true);
    try {
      await consultarVisibilidad();
    } catch {
      setErrorVisibilidad(true);
      await alertaError(ERROR_VISIBILIDAD);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div>
      <div className="servicio-acciones-botones">
        <BotonPanel variante="secundario" tamano="sm" disabled={ocupado || eliminado} onClick={() => void solicitarCambioEstado()}>
          {activo ? 'Desactivar' : 'Activar'}
        </BotonPanel>
        <BotonPanel variante="peligro" tamano="sm" disabled={ocupado || eliminado} onClick={() => void solicitarEliminacion()}>
          Eliminar
        </BotonPanel>
      </div>
      {eliminado && errorVisibilidad && (
        <BotonPanel variante="secundario" tamano="sm" disabled={ocupado} onClick={() => void reintentarVisibilidad()}>
          Consultar visibilidad de nuevo
        </BotonPanel>
      )}
    </div>
  );
}
