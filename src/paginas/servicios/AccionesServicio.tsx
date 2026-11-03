import { useState } from 'react';
import { api, ErrorApi } from '../../servicios/api';
import { DialogoServicio } from './DialogoServicio';

const AVISO = 'Ya no tienes servicios activos: tu negocio no aparece para los clientes hasta que actives uno.';
const ERROR = 'No pudimos guardar los cambios. Intenta de nuevo.';

// RN-11 y RN-23/D6: la API decide visibilidad y si existen reservas.
export function AccionesServicio({ id, nombre, activo, alCambiarEstado, alEliminar, alMensaje }: {
  id: string; nombre: string; activo: boolean;
  alCambiarEstado: (activo: boolean) => void;
  alEliminar: (mensaje: string) => void;
  alMensaje: (mensaje: string) => void;
}) {
  const [dialogo, setDialogo] = useState<'desactivar' | 'eliminar' | 'reservas' | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [eliminado, setEliminado] = useState(false);
  const ruta = `/negocios/mio/servicios/${id}`;

  async function consultarVisibilidad() {
    const perfil = await api<{ visible: boolean }>('/negocios/mio');
    alEliminar(`Servicio eliminado.${perfil.visible === false ? ` ${AVISO}` : ''}`);
  }

  async function cambiarEstado(nuevoActivo = !activo) {
    setOcupado(true);
    setError('');
    try {
      const respuesta = await api<{ visible: boolean }>(`${ruta}/estado`, {
        method: 'PATCH', body: JSON.stringify({ activo: nuevoActivo }),
      });
      alCambiarEstado(nuevoActivo);
      alMensaje(`Servicio ${nuevoActivo ? 'activado' : 'desactivado'}.${respuesta.visible === false ? ` ${AVISO}` : ''}`);
      setDialogo(null);
    } catch {
      setDialogo(null);
      setError(ERROR);
    } finally { setOcupado(false); }
  }

  async function eliminar() {
    setOcupado(true);
    setError('');
    try {
      await api(ruta, { method: 'DELETE' });
    } catch (error) {
      setOcupado(false);
      if (error instanceof ErrorApi && error.estado === 409) setDialogo('reservas');
      else { setDialogo(null); setError(ERROR); }
      return;
    }
    setEliminado(true);
    setDialogo(null);
    // DELETE devuelve 204. Consultar el perfil evita depender de CORS/X-Visible.
    try { await consultarVisibilidad(); }
    catch { setError('Servicio eliminado. No pudimos consultar la visibilidad del negocio. Intenta de nuevo.'); }
    finally { setOcupado(false); }
  }

  async function reintentarVisibilidad() {
    setOcupado(true);
    try { await consultarVisibilidad(); }
    catch { setError('Servicio eliminado. No pudimos consultar la visibilidad del negocio. Intenta de nuevo.'); }
    finally { setOcupado(false); }
  }

  return <div>
    <div className="d-flex gap-2" inert={dialogo !== null}>
      <button className={`btn btn-sm ${activo ? 'btn-outline-warning' : 'btn-outline-success'}`} type="button" disabled={ocupado || eliminado} onClick={() => activo ? setDialogo('desactivar') : void cambiarEstado()}>{activo ? 'Desactivar' : 'Activar'}</button>
      <button className="btn btn-sm btn-outline-danger" type="button" disabled={ocupado || eliminado} onClick={() => setDialogo('eliminar')}>Eliminar</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {eliminado && error && <button type="button" disabled={ocupado} onClick={reintentarVisibilidad}>Consultar visibilidad de nuevo</button>}
    {dialogo && <DialogoServicio ocupado={ocupado} accion={dialogo === 'eliminar' ? 'Eliminar' : 'Desactivar'}
      texto={dialogo === 'eliminar' ? `¿Eliminar «${nombre}»? Esta acción no se puede deshacer.`
        : dialogo === 'reservas' ? 'Este servicio ya tuvo reservas, así que no se puede eliminar. Puedes desactivarlo para que deje de ofrecerse.'
        : `¿Desactivar «${nombre}»? Los clientes ya no podrán reservarlo. Sus reservas existentes no cambian.`}
      alConfirmar={() => { void (dialogo === 'eliminar' ? eliminar() : cambiarEstado(false)); }} alCancelar={() => setDialogo(null)} />}
  </div>;
}
