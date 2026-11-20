import { useState } from 'react';
import '../../estilos/panel.css';

const grupos = [
  { titulo: 'Reservas', preguntas: [
    { id: 'solicitudes', pregunta: '¿Cómo reviso mis reservas?', respuesta: 'En Reservas puedes consultar las solicitudes de tu negocio y abrir su detalle para aceptarlas o rechazarlas.' },
    { id: 'vencimiento', pregunta: '¿Cuánto tiempo tengo para responder?', respuesta: 'Una solicitud Pendiente vence a las 2 horas o al inicio de la cita, lo que ocurra primero. Mientras está Pendiente ya ocupa el horario.' },
  ] },
  { titulo: 'Servicios y horario', preguntas: [
    { id: 'servicios', pregunta: '¿Dónde administro mis servicios?', respuesta: 'En Servicios puedes crear y editar los servicios de tu negocio. Si un servicio ya tuvo reservas, desactívalo para conservar su historial.' },
    { id: 'horario', pregunta: '¿Cómo organizo mi horario?', respuesta: 'En Horario configura los días y horas de atención. Usa Bloqueos para indicar fechas u horas en las que no atenderás.' },
  ] },
  { titulo: 'Cuenta', preguntas: [
    { id: 'perfil', pregunta: '¿Dónde actualizo mi cuenta?', respuesta: 'Abre el menú de la cuenta y elige Mi Perfil para consultar y actualizar la información de tu negocio.' },
    { id: 'sesion', pregunta: '¿Cómo cierro mi sesión?', respuesta: 'Abre el menú de la cuenta en la barra lateral y selecciona Cerrar sesión.' },
  ] },
];

const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();

export function Ayuda() {
  const [busqueda, setBusqueda] = useState('');
  const [abiertas, setAbiertas] = useState<string[]>([]);
  const consulta = normalizar(busqueda);
  const filtrados = grupos.map(grupo => ({ ...grupo, preguntas: grupo.preguntas.filter(p => normalizar(`${p.pregunta} ${p.respuesta}`).includes(consulta)) }))
    .filter(grupo => grupo.preguntas.length);

  return <div className="panel-pagina"><div className="panel-contenedor">
    <header className="panel-encabezado"><div className="panel-encabezado-textos">
      <span className="panel-eyebrow">OPERACIONES</span>
      <h1 className="panel-titulo">Ayuda</h1>
      <p className="panel-subtitulo">Encuentra respuestas sobre cómo usar Servia.</p>
    </div></header>
    <section className="panel-tarjeta" aria-label="Buscar preguntas frecuentes">
      <label htmlFor="ayuda-busqueda" className="form-label">Buscar preguntas</label>
      <input id="ayuda-busqueda" type="search" className="form-control" value={busqueda} onChange={e => setBusqueda(e.target.value)} aria-describedby="ayuda-indicacion" />
      <p id="ayuda-indicacion" className="panel-ayuda">Busca en las preguntas y sus respuestas.</p>
    </section>
    {filtrados.map(grupo => <section className="panel-tarjeta" aria-labelledby={`grupo-${normalizar(grupo.titulo).replaceAll(' ', '-')}`} key={grupo.titulo}>
      <div className="panel-tarjeta-encabezado"><h2 id={`grupo-${normalizar(grupo.titulo).replaceAll(' ', '-')}`} className="panel-tarjeta-titulo">{grupo.titulo}</h2></div>
      <div className="panel-lista">{grupo.preguntas.map(p => {
        const abierta = abiertas.includes(p.id);
        return <div className="panel-acordeon" key={p.id}>
          <h3 className="panel-item-titulo"><button id={`pregunta-${p.id}`} className="btn-servia-secondary panel-acordeon-boton" aria-expanded={abierta} aria-controls={`respuesta-${p.id}`} onClick={() => setAbiertas(prev => abierta ? prev.filter(id => id !== p.id) : [...prev, p.id])}>
            <span>{p.pregunta}</span><span aria-hidden="true">{abierta ? '−' : '+'}</span>
          </button></h3>
          <div id={`respuesta-${p.id}`} role="region" aria-labelledby={`pregunta-${p.id}`} hidden={!abierta}><p className="panel-item-texto">{p.respuesta}</p></div>
        </div>;
      })}</div>
    </section>)}
    {!filtrados.length && <section className="panel-tarjeta"><div className="panel-estado" role="status">
      <h2 className="panel-estado-titulo">No encontramos preguntas</h2>
      <p className="panel-estado-texto">Prueba con otras palabras o limpia la búsqueda.</p>
      <button className="btn-servia-secondary" onClick={() => setBusqueda('')}>Limpiar búsqueda</button>
    </div></section>}
  </div></div>;
}
