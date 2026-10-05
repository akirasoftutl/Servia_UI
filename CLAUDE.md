# Servia_UI

@../Servia_Contexto/AGENTS.md

## Este repo

- **Qué es:** el panel del **negocio**, una PWA con React + Vite. Solo acepta cuentas de tipo negocio.
- **Historias que le tocan:** las que en `docs/mvp.md` dicen *App: PWA* o *App: Flutter y PWA*.

## Comandos

- Instalar dependencias: `npm install`
- Correr en local: `cp .env.example .env` y `npm run dev` (http://localhost:5173); PWA instalable: `npm run build && npm run preview` (http://localhost:4173)
- Pruebas: `npm test`
- Lint: `npm run lint` (oxlint)

## Convenciones del código

- React 19 + React Router; una página por ruta en `src/paginas`, piezas compartidas en `src/componentes`.
- Toda llamada a la API pasa por `api()` de `src/servicios/api.ts` (agrega el token y maneja errores con `ErrorApi`).
- Las validaciones de negocio viven en la API; aquí solo se valida el formulario para dar mensajes rápidos.
- Textos de la interfaz en español. Color de marca: `#E27441`.

## Cómo trabajar aquí

- Cada issue de este repo es la parte del panel de una historia (o una tarea técnica), con su propia rama y su PR hacia `dev`. Lee sus secciones *Qué hay que hacer*, *Criterios* y *Cómo probarlo* antes de programar.
- Antes de abrir un PR que toque reservas, horarios o cuentas, usa la skill `verificar-reglas`.
