# montallantas-los-castellanos

Web para administrar servicios, empleados, inventario y reportes de Montallantas Los Castellanos.

## Estado actual

- La aplicacion mantiene el mismo diseno visual.
- Firebase queda preparado pero desactivado por defecto.
- Mientras no tengamos credenciales reales, la app funciona en modo local usando `localStorage`.

## Archivos clave

- `index.html`: interfaz principal actual.
- `js/config.js`: configuracion del sitio, Google y Firebase.
- `js/services/app-services.js`: capa de datos local/Firebase.
- `docs/revision-tecnica.md`: hallazgos y siguiente fase de refactor.
- `robots.txt`, `sitemap.xml`, `site.webmanifest`, `google-site-verification.html`: base para SEO tecnico.

## Cuando me compartas credenciales

1. Se actualiza `js/config.js`.
2. Se activa `firebase.enabled = true`.
3. Se conecta autenticacion y reglas segun el flujo que definamos.
