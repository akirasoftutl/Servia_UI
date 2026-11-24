import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Image as ImageIcon, ImageOff, Images, Plus, Trash2, Upload } from 'lucide-react';
import {
  eliminarFotoNegocio,
  subirFotoNegocio,
  type FotoNegocio,
  type FotosNegocio,
  type TipoFotoNegocio,
} from '../../servicios/api';
import { alertaDeError, aviso, confirmar, exito } from '../../servicios/alertas';
import { IlustracionEstado } from '../../componentes/panel/EstadosPanel';
import { BotonPanel } from '../../componentes/panel/BotonPanel';
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

function crearUrlPrevia(archivo: File): { url: string; revocable: boolean } {
  if (typeof URL.createObjectURL === 'function') {
    return { url: URL.createObjectURL(archivo), revocable: true };
  }
  return { url: `data:${archivo.type};base64,`, revocable: false };
}

// Si la URL de la foto no responde, el navegador solo mostraría el texto alternativo:
// se cambia por un aviso claro con el mismo tamaño que la imagen.
export function ImagenConFallo({
  src,
  alt,
  className,
  variante,
  mensaje = 'No se pudo cargar la foto',
}: {
  src: string;
  alt: string;
  className: string;
  variante: 'portada' | 'galeria';
  mensaje?: string;
}) {
  const [fallo, setFallo] = useState(false);
  if (fallo) {
    return (
      <div className={`panel-fotos-error panel-fotos-error--${variante}`} role="status">
        <ImageOff aria-hidden="true" />
        <span>{mensaje}</span>
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} onError={() => setFallo(true)} />;
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

  const bloqueoRef = useRef(false);
  const montadoRef = useRef(true);
  const inputPortadaRef = useRef<HTMLInputElement>(null);
  const inputGaleriaRef = useRef<HTMLInputElement>(null);

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

    const mensajeError = validarArchivoFoto(archivo);
    if (mensajeError) {
      void aviso(mensajeError);
      return;
    }

    if (tipo === 'galeria' && galeriaLlena) {
      void aviso(`La galería ya tiene ${MAX_FOTOS_GALERIA} fotos. Elimina una antes de subir otra.`);
      return;
    }

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
      await exito(tipo === 'portada' ? 'Portada actualizada correctamente.' : 'Foto agregada a la galería.');
    } catch (causa: unknown) {
      if (!montadoRef.current) return;
      await alertaDeError(causa, 'No pudimos subir la foto. Intenta de nuevo.');
    } finally {
      bloqueoRef.current = false;
      if (montadoRef.current) setOperacion(null);
    }
  };

  const solicitarEliminacion = async (foto: FotoNegocio, tipo: TipoFotoNegocio, numero: number) => {
    if (bloqueoRef.current || ocupado) return;
    bloqueoRef.current = true;
    try {
      const aceptado = await confirmar({
        titulo: tipo === 'portada' ? '¿Quitar la portada?' : '¿Quitar foto de la galería?',
        texto: tipo === 'portada'
          ? 'Se eliminará la portada de tu negocio y dejará de mostrarse a tus clientes.'
          : `Se eliminará la foto ${numero} de tu galería y dejará de mostrarse a tus clientes.`,
        confirmar: tipo === 'portada' ? 'Sí, quitar portada' : 'Quitar foto',
        cancelar: 'Cancelar',
        peligro: true,
      });
      if (!aceptado || !montadoRef.current) return;

      setOperacion('borrando');
      await eliminarFotoNegocio(foto.id);
      if (!montadoRef.current) return;
      const nuevas: FotosNegocio =
        tipo === 'portada'
          ? { ...fotos, portada: null }
          : { ...fotos, galeria: fotos.galeria.filter((item) => item.id !== foto.id) };
      actualizarFotos(nuevas);
      await exito(tipo === 'portada' ? 'Portada eliminada.' : 'Foto eliminada de la galería.');
    } catch (causa: unknown) {
      if (!montadoRef.current) return;
      await alertaDeError(causa, 'No pudimos eliminar la foto. Intenta de nuevo.');
    } finally {
      bloqueoRef.current = false;
      if (montadoRef.current) setOperacion(null);
    }
  };

  return (
    <section
      id="fotos-negocio"
      className="panel-tarjeta"
      aria-labelledby="titulo-fotos-negocio"
      aria-busy={ocupado}
    >
      <div className="panel-tarjeta-encabezado panel-tarjeta-encabezado--con-aviso">
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
      <p className="panel-tarjeta-subtitulo panel-fotos-aviso" id="aviso-fotos-aparte">
        Las fotos se suben aparte y al instante: no necesitas pulsar «Guardar cambios» del perfil.
      </p>

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
            aria-describedby="aviso-fotos-aparte"
            disabled={ocupado}
            onChange={seleccionarArchivo('portada')}
          />
          <div className="panel-fotos-cabecera-acciones">
            <BotonPanel
              variante="secundario"
              tamano="sm"
              disabled={ocupado}
              aria-describedby="aviso-fotos-aparte"
              onClick={() => inputPortadaRef.current?.click()}
            >
              <Upload aria-hidden="true" />
              {fotos.portada ? 'Cambiar portada' : 'Subir portada'}
            </BotonPanel>
            {fotos.portada && (
              <BotonPanel
                variante="peligro"
                tamano="sm"
                disabled={ocupado}
                onClick={() => void solicitarEliminacion(fotos.portada!, 'portada', 0)}
              >
                <Trash2 aria-hidden="true" />
                Quitar portada
              </BotonPanel>
            )}
          </div>
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
                <BotonPanel
                  variante="primario"
                  tamano="sm"
                  disabled={ocupado}
                  onClick={() => void confirmarSubida()}
                >
                  {operacion === 'subiendo'
                    ? 'Subiendo...'
                    : fotos.portada
                      ? 'Confirmar cambio'
                      : 'Guardar portada'}
                </BotonPanel>
                <BotonPanel
                  variante="secundario"
                  tamano="sm"
                  disabled={ocupado}
                  onClick={cancelarPrevia}
                >
                  Cancelar
                </BotonPanel>
              </div>
            </div>
          </div>
        )}

        {fotos.portada ? (
          <figure className="panel-fotos-marco-portada">
            <ImagenConFallo
              key={fotos.portada.url}
              src={fotos.portada.url}
              alt="Portada actual del negocio"
              className="panel-fotos-imagen-portada"
              variante="portada"
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
            aria-describedby="aviso-fotos-aparte"
            disabled={ocupado || galeriaLlena}
            onChange={seleccionarArchivo('galeria')}
          />
          <BotonPanel
            variante="primario"
            tamano="sm"
            disabled={ocupado || galeriaLlena}
            aria-describedby="aviso-fotos-aparte"
            onClick={() => inputGaleriaRef.current?.click()}
          >
            <Plus aria-hidden="true" />
            {galeriaLlena ? 'Máximo 5 fotos' : 'Agregar foto'}
          </BotonPanel>
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
                <BotonPanel
                  variante="primario"
                  tamano="sm"
                  disabled={ocupado}
                  onClick={() => void confirmarSubida()}
                >
                  {operacion === 'subiendo' ? 'Subiendo...' : 'Subir a la galería'}
                </BotonPanel>
                <BotonPanel
                  variante="secundario"
                  tamano="sm"
                  disabled={ocupado}
                  onClick={cancelarPrevia}
                >
                  Cancelar
                </BotonPanel>
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
                <ImagenConFallo
                  key={foto.url}
                  src={foto.url}
                  alt={`Foto ${indice + 1} de la galería`}
                  className="panel-fotos-imagen-galeria"
                  variante="galeria"
                />
                <div className="panel-fotos-tarjeta-pie">
                  <span className="panel-ayuda">Foto {indice + 1}</span>
                  <BotonPanel
                    variante="peligro"
                    tamano="sm"
                    disabled={ocupado}
                    aria-label={`Quitar foto ${indice + 1}`}
                    onClick={() => void solicitarEliminacion(foto, 'galeria', indice + 1)}
                  >
                    <Trash2 aria-hidden="true" />
                    Quitar
                  </BotonPanel>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
