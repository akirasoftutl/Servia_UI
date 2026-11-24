import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import { ErrorApi, eliminarImagenServicio, subirImagenServicio, type ImagenServicio } from '../../servicios/api';
import { alertaDeError, aviso as alertaAviso, confirmar, error as alertaError, exito as alertaExito } from '../../servicios/alertas';
import { ACCEPT_FOTOS, validarArchivoFoto } from '../mi_perfil/fotos';
import { ImagenConFallo } from '../mi_perfil/FotosNegocio';
import { BotonPanel } from '../../componentes/panel/BotonPanel';
import {
  MAX_IMAGENES_SERVICIO,
  MENSAJE_FALLO_QUITAR,
  MENSAJE_FALLO_SUBIDA,
  MENSAJE_TOPE_IMAGENES,
  crearPendiente,
  liberarPendiente,
  mensajeCupo,
  mensajeErrorImagen,
  type ArchivoPendiente,
} from './imagenes';

interface Props {
  // Con id (edición) cada imagen se sube o se quita al momento. Sin id (creación) las elegidas
  // quedan como vista previa en `pendientes` y el formulario las sube al crear el servicio.
  servicioId?: string;
  imagenes: ImagenServicio[];
  alCambiarImagenes: (imagenes: ImagenServicio[]) => void;
  pendientes: ArchivoPendiente[];
  alCambiarPendientes: (pendientes: ArchivoPendiente[]) => void;
}

// Sección «Imágenes del servicio» (HU-N27): hasta 3 imágenes JPEG, PNG o WebP de hasta 5 MB.
export function ImagenesServicio({ servicioId, imagenes, alCambiarImagenes, pendientes, alCambiarPendientes }: Props) {
  const [subiendo, setSubiendo] = useState<ArchivoPendiente | null>(null);
  const [quitando, setQuitando] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const bloqueo = useRef(false);
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  const total = servicioId ? imagenes.length : pendientes.length;
  const lleno = total >= MAX_IMAGENES_SERVICIO;
  const ocupado = subiendo !== null || quitando;

  const mostrarErrorImagen = async (causa: unknown, respaldoRed: string) => {
    if (causa instanceof ErrorApi && (causa.estado === 401 || causa.estado === 403)) {
      await alertaError(mensajeErrorImagen(causa, respaldoRed));
      return;
    }
    await alertaDeError(causa, respaldoRed);
  };

  const subirLote = async (id: string, archivos: File[], avisoCupo: string) => {
    bloqueo.current = true;
    let actuales = imagenes;
    let agregadas = 0;
    let fallo = false;
    for (const archivo of archivos) {
      const previa = crearPendiente(archivo);
      setSubiendo(previa);
      try {
        const nueva = await subirImagenServicio(id, archivo);
        actuales = [...actuales, nueva];
        agregadas += 1;
        if (montado.current) alCambiarImagenes(actuales);
      } catch (causa) {
        if (montado.current) await mostrarErrorImagen(causa, MENSAJE_FALLO_SUBIDA);
        fallo = true;
      } finally {
        liberarPendiente(previa);
      }
      if (fallo || !montado.current) break;
    }
    bloqueo.current = false;
    if (!montado.current) return;
    setSubiendo(null);
    if (agregadas > 0) {
      await alertaExito(agregadas === 1 ? 'Imagen agregada.' : `${agregadas} imágenes agregadas.`);
    }
    if (!fallo && avisoCupo && montado.current) {
      await alertaAviso(avisoCupo);
    }
  };

  const elegir = (evento: ChangeEvent<HTMLInputElement>) => {
    const elegidos = Array.from(evento.target.files ?? []);
    evento.target.value = '';
    if (elegidos.length === 0 || ocupado || bloqueo.current) return;
    // El servidor es la autoridad; aquí solo se adelantan los mensajes (formato, tamaño y tope).
    for (const archivo of elegidos) {
      const invalido = validarArchivoFoto(archivo);
      if (invalido) { void alertaAviso(invalido); return; }
    }
    const libres = MAX_IMAGENES_SERVICIO - total;
    if (libres <= 0) { void alertaAviso(MENSAJE_TOPE_IMAGENES); return; }
    const aceptados = elegidos.slice(0, libres);
    const avisoCupo = elegidos.length > libres ? mensajeCupo(libres) : '';
    if (servicioId) {
      void subirLote(servicioId, aceptados, avisoCupo);
    } else {
      alCambiarPendientes([...pendientes, ...aceptados.map(crearPendiente)]);
      if (avisoCupo) void alertaAviso(avisoCupo);
    }
  };

  const quitarPendiente = (pendiente: ArchivoPendiente) => {
    liberarPendiente(pendiente);
    alCambiarPendientes(pendientes.filter(item => item.clave !== pendiente.clave));
  };

  const solicitarQuitar = async (imagen: ImagenServicio, numero: number) => {
    if (!servicioId || bloqueo.current || ocupado) return;
    bloqueo.current = true;
    try {
      const aceptado = await confirmar({
        titulo: 'Quitar imagen',
        texto: `¿Quitar la imagen ${numero}? Dejará de mostrarse a tus clientes.`,
        confirmar: 'Quitar',
        cancelar: 'Cancelar',
        peligro: true,
      });
      if (!aceptado || !montado.current) return;

      setQuitando(true);
      await eliminarImagenServicio(servicioId, imagen.id);
      if (!montado.current) return;
      alCambiarImagenes(imagenes.filter(item => item.id !== imagen.id));
      await alertaExito('Imagen quitada.');
    } catch (causa) {
      if (montado.current) await mostrarErrorImagen(causa, MENSAJE_FALLO_QUITAR);
    } finally {
      bloqueo.current = false;
      if (montado.current) setQuitando(false);
    }
  };

  return (
    <section className="servicio-seccion servicio-seccion--ultima" aria-labelledby="titulo-imagenes-servicio" aria-busy={ocupado}>
      <div className="servicio-imagenes-cabecera">
        <div>
          <h2 id="titulo-imagenes-servicio" className="panel-tarjeta-titulo">Imágenes del servicio</h2>
          <p className="panel-tarjeta-subtitulo servicio-seccion-subtitulo">
            Muestra hasta {MAX_IMAGENES_SERVICIO} imágenes de tus trabajos para que tus clientes conozcan tu servicio. JPEG, PNG o WebP de hasta 5 MB.
          </p>
        </div>
        <span className="panel-contador">{total} de {MAX_IMAGENES_SERVICIO} imágenes</span>
      </div>

      <div className="servicio-fotos">
        <input ref={input} type="file" accept={ACCEPT_FOTOS} multiple className="visually-hidden"
          aria-label="Seleccionar imágenes del servicio" disabled={ocupado || lleno} onChange={elegir} />

        {total === 0 && !subiendo && (
          <div className="servicio-fotos-vacio">
            <div className="servicio-fotos-icono" aria-hidden="true"><ImagePlus aria-hidden="true" /></div>
            <strong>Agrega imágenes de tu servicio</strong>
            <span className="panel-ayuda">Aún no hay imágenes de este servicio.</span>
          </div>
        )}

        {(total > 0 || subiendo) && (
          <ul className="panel-fotos-cuadricula list-unstyled mb-0">
            {servicioId && imagenes.map((imagen, indice) => (
              <li className="panel-fotos-tarjeta" key={imagen.id}>
                <ImagenConFallo key={imagen.url} src={imagen.url} alt={`Imagen ${indice + 1} del servicio`}
                  className="panel-fotos-imagen-galeria" variante="galeria" mensaje="No se pudo cargar la imagen" />
                <div className="panel-fotos-tarjeta-pie">
                  <span className="panel-ayuda">Imagen {indice + 1}</span>
                  <BotonPanel variante="peligro" tamano="sm" disabled={ocupado}
                    aria-label={`Quitar imagen ${indice + 1}`} onClick={() => void solicitarQuitar(imagen, indice + 1)}>
                    <Trash2 aria-hidden="true" />Quitar
                  </BotonPanel>
                </div>
              </li>
            ))}
            {!servicioId && pendientes.map((pendiente, indice) => (
              <li className="panel-fotos-tarjeta" key={pendiente.clave}>
                <img src={pendiente.url} alt={`Vista previa de la imagen ${indice + 1}`} className="panel-fotos-imagen-galeria" />
                <div className="panel-fotos-tarjeta-pie">
                  <span className="panel-ayuda">Imagen {indice + 1}</span>
                  <BotonPanel variante="peligro" tamano="sm"
                    aria-label={`Quitar imagen ${indice + 1}`} onClick={() => quitarPendiente(pendiente)}>
                    <Trash2 aria-hidden="true" />Quitar
                  </BotonPanel>
                </div>
              </li>
            ))}
            {subiendo && (
              <li className="panel-fotos-tarjeta servicio-imagen-subiendo">
                <img src={subiendo.url} alt={`Vista previa de ${subiendo.archivo.name}`} className="panel-fotos-imagen-galeria" />
                <div className="panel-fotos-tarjeta-pie" role="status">
                  <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                  <span className="panel-ayuda">Subiendo...</span>
                </div>
              </li>
            )}
          </ul>
        )}

        <div className="servicio-imagenes-acciones">
          <BotonPanel variante="secundario" disabled={ocupado || lleno} onClick={() => input.current?.click()}>
            <Plus aria-hidden="true" />{lleno ? `Máximo ${MAX_IMAGENES_SERVICIO} imágenes` : 'Agregar imagen'}
          </BotonPanel>
          {lleno && <p className="panel-ayuda mb-0">{MENSAJE_TOPE_IMAGENES}</p>}
          {!servicioId && total > 0 && <p className="panel-ayuda mb-0">Se subirán cuando publiques el servicio.</p>}
        </div>
      </div>
    </section>
  );
}
