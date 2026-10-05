# Servia_UI

Panel web del **negocio** de Servia: una PWA hecha con React + Vite.

Aquí el negocio se registra, arma su perfil, publica sus servicios, define su horario y atiende las reservas de sus clientes. Solo acepta cuentas de tipo negocio.

## Parte de Servia

| Repo | Qué es |
|---|---|
| [Servia_BE](https://github.com/akirasoftutl/Servia_BE) | API (NestJS + Firebase) |
| [Servia_UI](https://github.com/akirasoftutl/Servia_UI) | Panel del negocio (PWA con React + Vite) |
| [Servia_Movil](https://github.com/akirasoftutl/Servia_Movil) | App del cliente (Flutter) |
| [Servia_Contexto](https://github.com/akirasoftutl/Servia_Contexto) | Documentación, historias de usuario y contexto del proyecto |

El alcance del MVP, las reglas de negocio y las decisiones del proyecto están en [Servia_Contexto](https://github.com/akirasoftutl/Servia_Contexto).

## Ramas

- `main`: lo entregable. Solo recibe `dev` al cierre de cada sprint.
- `dev`: integración y QA. Es la rama por defecto.
- Una rama por issue (`feature/`, `fix/`, `chore/`, `docs/`) que sale de `dev` y regresa a `dev` con un pull request.

El paso a paso está en la [guía de Git](https://github.com/akirasoftutl/Servia_Contexto/blob/main/docs/flujo-de-trabajo-git.md).

## Cómo correrlo

Necesitas **Node.js 22 o más nuevo** y npm. Para ver datos reales, la API (`Servia_BE`) debe estar corriendo.

```bash
npm install
cp .env.example .env      # URL de la API y configuración web de Firebase (ver docs/firebase.md de Servia_BE)
npm run dev               # http://localhost:5173
```

| Comando | Para qué |
|---|---|
| `npm run dev` | Desarrollo con recarga automática (el service worker está apagado en este modo) |
| `npm run build` | Compilar para producción (genera el service worker y el manifest) |
| `npm run preview` | Servir lo compilado en http://localhost:4173; aquí se prueba la instalación de la PWA |
| `npm test` | Pruebas (Vitest + Testing Library) |
| `npm run lint` | Revisar el código (oxlint) |

**Probar que se puede instalar:** `npm run build && npm run preview`, abre http://localhost:4173 en Chrome y aparece el ícono de instalar en la barra de direcciones. En DevTools → *Application* se ven el *Manifest* y el *Service worker*.

## Estructura

```
src/
├── main.tsx             Arranque: rutas y registro del service worker
├── router.tsx           Rutas del panel
├── componentes/         Piezas compartidas (Layout con el encabezado)
├── paginas/             Una página por ruta (Inicio, NoEncontrado…)
├── servicios/
│   ├── api.ts           Cliente de la API: agrega el token de Firebase y convierte errores en ErrorApi
│   └── firebase.ts      Inicializa Firebase web con las variables VITE_FIREBASE_*
├── pruebas/setup.ts     Configuración de las pruebas
└── estilos.css          Estilos globales y color de Servia (#E27441)
public/                  Íconos de la PWA, generados a partir del logo
```

Para llamar a la API usa `api()`: `const perfil = await api<Perfil>('/negocios/mio')`. Si hay sesión, agrega solo el token; si la API responde con error, lanza `ErrorApi` con `estado` (código HTTP) y el mensaje del servidor.
