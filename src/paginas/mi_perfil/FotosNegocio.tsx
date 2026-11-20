import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, CircleAlert, Image as ImageIcon, Images, Plus, Trash2, Upload } from 'lucide-react';
import {
  eliminarFotoNegocio,
  ErrorApi,
  subirFotoNegocio,
  type FotoNegocio,
  type FotosNegocio,
  type TipoFotoNegocio,
} from '../../servicios/api';
import { IlustracionEstado } from '../../componentes/panel/EstadosPanel';
import {
  ACCEPT_FOTOS,
  FOTOS_VACIAS,
  MAX_FOTOS_GALERIA,
  formatearTamanoArchivo,
  normalizarFotosNegocio,
  validarArchivoFoto,
} from './fotos';
import '../../estilos/panel.css';

interface FotosNegocioProps {
  fotosIniciales?: Partial<FotosNegocio> | null;
  alCambiar?: (fotos: FotosNegocio) => void;
}

interface VistaPreviaPendiente {
  tipo: TipoFotoNegocio;
  archivo: File;
  url: string;
  revocable: boolean;
}

interface FotoEnEliminacion {
  foto: FotoNegocio;
  numero: number;
}

function crearUrlPrevia(archivo: File): { url: string; revocable: boolean } {
  if (typeof URL.createObjectURL === 'function') {
    return { url: URL.createObjectURL(archivo), revocable: true };
  }
  return { url: `data:${archivo.type};base64,`, revocable: false };
}

function mensajeErrorApi(causa: unknown, respaldo: string): string {
  return causa instanceof ErrorApi ? causa.message : respaldo;
}

export function FotosNegocio({ fotosIniciales = FOTOS_VACIAS, alCambiar }: FotosNegocioProps) {
  const [inicialesPrevias, setInicialesPrevias] = useState(fotosIniciales);
  const [fotos, setFotos] = useState<FotosNegocio>(() => normalizarFotosNegocio(fotosIniciales));
  if (fotosIniciales !== inicialesPrevias) {
    setInicialesPrevias(fotosIniciales);
    setFotos(normalizarFotosNegocio(fotosIniciales));
  }
  const [pendiente, setPendiente] = useState<VistaPreviaPendiente | null>(null);
  const [operacion, setOperacion] = useState<'subiendo' | 'borrando' | null>(null);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [fotoPorEliminar, setFotoPorEliminar] = useState<FotoEnEliminacion | null>(null);

  const bloqueoRef = useRef(false);
  const montadoRef = useRef(true);
  const inputPortadaRef = useRef<HTMLInputElement>(null);
  const inputGaleriaRef = useRef<HTMLInputElement>(null);
  const cancelarDialogoRef = useRef<HTMLButtonElement>(null);
  const tituloDialogoId = useId();
  const textoDialogoId = useId();

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (pendiente?.revocable && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(pendiente.url);
      }
    };
  }, [pendiente]);

  useEffect(() => {
    if (!fotoPorEliminar) return;
    const anterior = document.activeElement as HTMLElement | null;
    cancelarDialogoRef.current?.focus();
    return () => {
      anterior?.focus();
    };
  }, [fotoPorEliminar]);

  const ocupado = operacion !== null;
  const galeriaLlena = fotos.galeria.length >= MAX_FOTOS_GALERIA;

  const limpiarInputs = () => {
    if (inputPortadaRef.current) inputPortadaRef.current.value = '';
    if (inputGaleriaRef.current) inputGaleriaRef.current.value = '';
  };

  const actualizarFotos = (nuevas: FotosNegocio) => {
    setFotos(nuevas);
    alCambiar?.(nuevas);
  };

  const seleccionarArchivo = (tipo: TipoFotoNegocio) => (evento: ChangeEvent<HTMLInputElement>) => {
    const archivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!archivo || ocupado) return;

    setExito('');
    const mensajeError = validarArchivoFoto(archivo);
    if (mensajeError) {
      setError(mensajeError);
      return;
    }

    if (tipo === 'galeria' && galeriaLlena) {
      setError(`La galería ya tiene ${MAX_FOTOS_GALERIA} fotos. Elimina una antes de subir otra.`);
      return;
    }

    setError('');
    const previa = crearUrlPrevia(archivo);
    setPendiente({ tipo, archivo, ...previa });
  };

  const cancelarPrevia = () => {
    if (ocupado) return;
    setPendiente(null);
    limpiarInputs();
  };

  const confirmarSubida = async () => {
    if (!pendiente || bloqueoRef.current) return;
    const { archivo, tipo } = pendiente;
    bloqueoRef.current = true;
    setOperacion('subiendo');
    setError('');
    setExito('');

    try {
      const fotoSubida = await subirFotoNegocio(archivo, tipo);
      if (!montadoRef.current) return;
      const nuevas: FotosNegocio =
        tipo === 'portada'
          ? { ...fotos, portada: fotoSubida }
          : { ...fotos, galeria: [...fotos.galeria, fotoSubida] };
      actualizarFotos(nuevas);
      setPendiente(null);
      limpiarInputs();
      setExito(tipo === 'portada' ? 'Portada actualizada correctamente.' : 'Foto agregada a la galería.');
    } catch (causa: unknown) {
      if (!montadoRef.current) return;
      setError(mensajeErrorApi(causa, 'No pudimos subir la foto. Intenta de nuevo.'));
    } finally {
      bloqueoRef.current = false;
      if (montadoRef.current) setOperacion(null);
    }
  };

  const confirmarEliminacion = async () => {
    if (!fotoPorEliminar || bloqueoRef.current) return;
    const { foto } = fotoPorEliminar;
    bloqueoRef.current = true;
    setOperacion('borrando');
    setError('');
    setExito('');

    try {
      await eliminarFotoNegocio(foto.id);
      if (!montadoRef.current) return;
      const nuevas: FotosNegocio = {
        ...fotos,
        galeria: fotos.galeria.filter((item) => item.id !== foto.id),
      };
      actualizarFotos(nuevas);
      setFotoPorEliminar(null);
      setExito('Foto eliminada de la galería.');
    } catch (causa: unknown) {
      if (!montadoRef.current) return;
      setFotoPorEliminar(null);
      setError(mensajeErrorApi(causa, 'No pudimos eliminar la foto. Intenta de nuevo.'));
    } finally {
      bloqueoRef.current = false;
      if (montadoRef.current) setOperacion(null);
    }
  };

  return (
    <>
      <section
        id="fotos-negocio"
        className="panel-tarjeta"
        aria-labelledby="titulo-fotos-negocio"
        aria-busy={ocupado}
      >
        <div className="panel-tarjeta-encabezado">
          <div>
            <h2 id="titulo-fotos-negocio" className="panel-tarjeta-titulo">
              Fotos
            </h2>
            <p className="panel-tarjeta-subtitulo">
              Sube tu portada y hasta {MAX_FOTOS_GALERIA} fotos de galería para que los clientes conozcan tu negocio.
              Formatos JPEG, PNG o WebP de hasta 5 MB.
            </p>
          </div>
          <span className="panel-contador">
            {fotos.galeria.length} / {MAX_FOTOS_GALERIA} en galería
          </span>
        </div>

        {error && (
          <div className="panel-alerta panel-alerta--error" role="alert">
            <span className="panel-alerta-icono" aria-hidden="true">
              <CircleAlert aria-hidden="true" />
            </span>
            <div className="panel-alerta-contenido">{error}</div>
          </div>
        )}

        {exito && (
          <div className="panel-alerta panel-alerta--exito" role="status">
            <span className="panel-alerta-icono" aria-hidden="true">
              <CheckCircle2 aria-hidden="true" />
            </span>
            <div className="panel-alerta-contenido">{exito}</div>
          </div>
        )}

        {ocupado && (
          <p className="panel-cargando-texto" role="status">
            <span className="spinner-border" aria-hidden="true" />
            {operacion === 'subiendo' ? 'Subiendo foto...' : 'Eliminando foto...'}
          </p>
        )}

        <div className="panel-fotos-bloque">
          <div className="panel-fotos-cabecera">
            <div>
              <h3 className="panel-item-titulo">Portada</h3>
              <p className="panel-item-texto">Imagen principal que verán tus clientes al abrir tu perfil.</p>
            </div>
            <input
              ref={inputPortadaRef}
              id="foto-portada-input"
              type="file"
              accept={ACCEPT_FOTOS}
              className="visually-hidden"
              aria-label="Seleccionar archivo de portada"
              disabled={ocupado}
              onChange={seleccionarArchivo('portada')}
            />
            <button
              type="button"
              className="btn-servia-secondary btn-servia-sm"
              disabled={ocupado}
              onClick={() => inputPortadaRef.current?.click()}
            >
              <Upload aria-hidden="true" />
              {fotos.portada ? 'Cambiar portada' : 'Subir portada'}
            </button>
          </div>

          {pendiente?.tipo === 'portada' && (
            <div className="panel-fotos-previa" aria-label="Vista previa de portada">
              <img
                src={pendiente.url}
                alt="Vista previa de la portada"
                className="panel-fotos-previa-imagen"
              />
              <div className="panel-fotos-previa-cuerpo">
                <p className="panel-item-titulo">Vista previa antes de subir</p>
                <p className="panel-ayuda panel-fotos-previa-nombre">
                  {pendiente.archivo.name} · {formatearTamanoArchivo(pendiente.archivo.size)}
                </p>
                <div className="panel-fotos-previa-acciones">
                  <button
                    type="button"
                    className="btn-servia-primary btn-servia-sm"
                    disabled={ocupado}
                    onClick={() => void confirmarSubida()}
                  >
                    {operacion === 'subiendo'
                      ? 'Subiendo...'
                      : fotos.portada
                        ? 'Confirmar cambio'
                        : 'Guardar portada'}
                  </button>
                  <button
                    type="button"
                    className="btn-servia-secondary btn-servia-sm"
                    disabled={ocupado}
                    onClick={cancelarPrevia}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {fotos.portada ? (
            <figure className="panel-fotos-marco-portada">
              <img
                src={fotos.portada.url}
                alt="Portada actual del negocio"
                className="panel-fotos-imagen-portada"
              />
            </figure>
          ) : (
            pendiente?.tipo !== 'portada' && (
              <div className="panel-estado">
                <IlustracionEstado icono={ImageIcon} />
                <div className="panel-estado-cuerpo">
                  <h4 className="panel-estado-titulo">Sin foto de portada</h4>
                  <p className="panel-estado-texto">
                    Elige una imagen para destacar tu negocio en el catálogo de Servia.
                  </p>
                </div>
              </div>
            )
          )}
        </div>

        <div className="panel-fotos-bloque">
          <div className="panel-fotos-cabecera">
            <div>
              <h3 className="panel-item-titulo">Galería</h3>
              <p className="panel-item-texto">
                Agrega hasta {MAX_FOTOS_GALERIA} fotos de tus servicios o instalaciones.
              </p>
            </div>
            <input
              ref={inputGaleriaRef}
              id="foto-galeria-input"
              type="file"
              accept={ACCEPT_FOTOS}
              className="visually-hidden"
              aria-label="Seleccionar archivo de galería"
              disabled={ocupado || galeriaLlena}
              onChange={seleccionarArchivo('galeria')}
            />
            <button
              type="button"
              className="btn-servia-primary btn-servia-sm"
              disabled={ocupado || galeriaLlena}
              onClick={() => inputGaleriaRef.current?.click()}
            >
              <Plus aria-hidden="true" />
              {galeriaLlena ? 'Máximo 5 fotos' : 'Agregar foto'}
            </button>
          </div>

          {pendiente?.tipo === 'galeria' && (
            <div className="panel-fotos-previa" aria-label="Vista previa para la galería">
              <img
                src={pendiente.url}
                alt="Vista previa para la galería"
                className="panel-fotos-previa-imagen"
              />
              <div className="panel-fotos-previa-cuerpo">
                <p className="panel-item-titulo">Vista previa antes de subir</p>
                <p className="panel-ayuda panel-fotos-previa-nombre">
                  {pendiente.archivo.name} · {formatearTamanoArchivo(pendiente.archivo.size)}
                </p>
                <div className="panel-fotos-previa-acciones">
                  <button
                    type="button"
                    className="btn-servia-primary btn-servia-sm"
                    disabled={ocupado}
                    onClick={() => void confirmarSubida()}
                  >
                    {operacion === 'subiendo' ? 'Subiendo...' : 'Subir a la galería'}
                  </button>
                  <button
                    type="button"
                    className="btn-servia-secondary btn-servia-sm"
                    disabled={ocupado}
                    onClick={cancelarPrevia}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {fotos.galeria.length === 0 ? (
            pendiente?.tipo !== 'galeria' && (
              <div className="panel-estado">
                <IlustracionEstado icono={Images} />
                <div className="panel-estado-cuerpo">
                  <h4 className="panel-estado-titulo">Tu galería está vacía</h4>
                  <p className="panel-estado-texto">
                    Agrega fotos de tu espacio o de tu trabajo para generar confianza.
                  </p>
                </div>
              </div>
            )
          ) : (
            <ul className="panel-fotos-cuadricula list-unstyled mb-0">
              {fotos.galeria.map((foto, indice) => (
                <li className="panel-fotos-tarjeta" key={foto.id}>
                  <img
                    src={foto.url}
                    alt={`Foto ${indice + 1} de la galería`}
                    className="panel-fotos-imagen-galeria"
                  />
                  <div className="panel-fotos-tarjeta-pie">
                    <span className="panel-ayuda">Foto {indice + 1}</span>
                    <button
                      type="button"
                      className="btn-servia-danger btn-servia-sm"
                      disabled={ocupado}
                      aria-label={`Quitar foto ${indice + 1}`}
                      onClick={() => setFotoPorEliminar({ foto, numero: indice + 1 })}
                    >
                      <Trash2 aria-hidden="true" />
                      Quitar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {fotoPorEliminar &&
        createPortal(
          <div
            className="panel-dialogo-fondo"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={tituloDialogoId}
            aria-describedby={textoDialogoId}
            onKeyDown={(evento) => {
              if (evento.key === 'Escape' && !ocupado) {
                evento.preventDefault();
                setFotoPorEliminar(null);
              }
              if (evento.key === 'Tab') {
                const botones = Array.from(
                  evento.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
                );
                if (botones.length === 0) return;
                const indice = botones.indexOf(document.activeElement as HTMLButtonElement);
                evento.preventDefault();
                botones[(indice + (evento.shiftKey ? botones.length - 1 : 1)) % botones.length]?.focus();
              }
            }}
          >
            <div className="panel-dialogo">
              <div className="panel-dialogo-icono panel-dialogo-icono--peligro" aria-hidden="true">
                <Trash2 aria-hidden="true" />
              </div>
              <h2 id={tituloDialogoId} className="panel-dialogo-titulo">
                ¿Quitar foto de la galería?
              </h2>
              <p id={textoDialogoId} className="panel-dialogo-texto">
                Se eliminará la foto {fotoPorEliminar.numero} de tu galería y dejará de mostrarse a tus clientes.
              </p>
              <div className="panel-dialogo-acciones">
                <button
                  ref={cancelarDialogoRef}
                  type="button"
                  className="btn-servia-secondary"
                  disabled={ocupado}
                  onClick={() => setFotoPorEliminar(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-servia-danger"
                  disabled={ocupado}
                  onClick={() => void confirmarEliminacion()}
                >
                  {operacion === 'borrando' ? 'Eliminando...' : 'Quitar foto'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
