# Montallantas Los Castellanos

![Version](https://img.shields.io/badge/version-1.0-blue.svg)
![HTML5](https://img.shields.io/badge/HTML5-E34C26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![Firebase Auth](https://img.shields.io/badge/Firebase-Auth-FFCA28?style=flat&logo=firebase&logoColor=black)

---

## Web en vivo

<div align="center">
  <a href="https://jhormancastella.github.io/montallantas-los-castellanos/" target="_blank">
    <img src="https://img.shields.io/badge/Ver_web_en_vivo-Montallantas_Los_Castellanos-2EA043?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Ver web en vivo">
  </a>
</div>

---

## Capturas de pantalla

### Dashboard

![Dashboard de Montallantas Los Castellanos](assets/screenshots/dashboard.png)

### Reportes y cierre de caja

![Reporte diario de Montallantas Los Castellanos](assets/screenshots/reportes.png)

---

## Descripcion

**Montallantas Los Castellanos** es un sistema web de gestion para una montallanta, enfocado en operar el negocio del dia a dia desde un panel administrativo:

- Registro de servicios/facturas.
- Gestion de empleados y comisiones.
- Control de inventario (insumos).
- Reportes por fecha y exportacion a Excel.

La app esta desarrollada como frontend web (HTML/CSS/JS), usa **Firebase para autenticacion** y **Supabase (PostgreSQL) para la base de datos**.

---

## Caracteristicas principales

- Panel administrativo con secciones por modulo.
- Registro de servicios con calculo de total, insumos y comision.
- Gestion CRUD de empleados, servicios e insumos.
- Dashboard con indicadores diarios y actividad reciente.
- Reportes por fecha con exportacion a `.xlsx`.
- Sesion de admin con persistencia al recargar.
- Branding personalizado (logo + favicon).
- Estructura lista para SEO tecnico (`robots.txt`, `sitemap.xml`, manifest).

---

## Flujo general del sistema

```mermaid
flowchart TD
    A[Inicio de la web] --> B{Sesion iniciada?}
    B -->|No| C[Login de admin con Firebase Auth]
    B -->|Si| D[Cargar dashboard]
    C --> D

    D --> E[Gestion de empleados]
    D --> F[Gestion de servicios]
    D --> G[Gestion de inventario]
    D --> H[Registrar servicio]

    H --> I[Seleccionar empleado y servicio]
    I --> J[Agregar insumos]
    J --> K[Calcular total y comision]
    K --> L[Guardar en servicios_realizados]
    L --> M[Actualizar stock de insumos]
    M --> N[Generar factura vista previa]

    D --> O[Reportes por fecha]
    O --> P[Exportar reporte a Excel]

    style A fill:#1f2937,stroke:#fff,color:#fff
    style D fill:#0ea5e9,stroke:#fff,color:#fff
    style L fill:#22c55e,stroke:#fff,color:#fff
    style P fill:#f59e0b,stroke:#fff,color:#fff
```

---

## Tecnologias utilizadas

- **HTML5**: estructura de la aplicacion.
- **CSS3**: estilos responsivos y componentes visuales.
- **JavaScript (ES6+)**: logica de negocio, UI y servicios.
- **Firebase Auth**: autenticacion del administrador.
- **Supabase**: almacenamiento de datos (empleados, servicios, insumos, servicios realizados).
- **SheetJS (XLSX)**: exportacion de reportes a Excel.

---

## Estructura del proyecto

```text
montallantas-los-castellanos/
├── index.html
├── README.md
├── robots.txt
├── sitemap.xml
├── site.webmanifest
├── googlec83d7ace80820036.html
├── assets/
│   └── branding/
│       ├── favicon.png
│       └── logo-header.png
├── css/
│   └── styles.css
└── js/
    ├── app.js
    ├── config.js
    └── services/
        └── app-services.js
```

---

## Configuracion local

1. Clona el repositorio:

   ```bash
   git clone https://github.com/Jhormancastella/montallantas-los-castellanos.git
   cd montallantas-los-castellanos
   ```

2. Ejecuta con servidor local (recomendado: Live Server de VS Code/Cursor).
3. Abre `index.html` en `http://127.0.0.1:5500` (o puerto equivalente).

---

## Configuracion de servicios

### Firebase (autenticacion)

En `js/config.js`:

- `firebase.enabled: true`
- Completar `apiKey`, `authDomain`, `projectId`, etc.

### Supabase (base de datos)

En `js/config.js`:

- `supabase.enabled: true`
- `supabase.url`
- `supabase.anonKey` (clave anon/public, no `service_role`)

Tablas esperadas:

- `empleados`
- `servicios`
- `insumos`
- `servicios_realizados`

---

## SEO y PWA

- `robots.txt` y `sitemap.xml` para indexacion.
- `site.webmanifest` para experiencia tipo app.
- `favicon` y `apple-touch-icon` configurados en `index.html`.

---

## Roadmap sugerido

- Endurecer politicas RLS en Supabase para produccion.
- Integrar Supabase Storage para imagenes de insumos.
- Mejorar control de auditoria (usuario que crea/edita registros).
- Agregar pruebas end-to-end del flujo POS.

---

## Contribuciones

Las contribuciones son bienvenidas:

1. Haz fork del proyecto.
2. Crea una rama:

   ```bash
   git checkout -b feature/mi-mejora
   ```

3. Realiza cambios y commit.
4. Abre un Pull Request.

---

## Licencia

Todos los derechos reservados.

© 2026 Montallantas Los Castellanos.
