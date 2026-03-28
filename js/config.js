// ============================================
// MONTALLANTAS LOS CASTELLANOS - CONFIGURACIÓN BASE
// ============================================
// Este archivo contiene la configuración por defecto.
// Para personalizar, crea js/config.local.js (ver .env.example)
// El archivo config.local.js está en .gitignore y NO se sube al repositorio

// Configuración base (se sobrescribe con config.local.js si existe)
window.APP_CONFIG = Object.freeze({
    site: {
        name: "Montallantas Los Castellanos",
        description: "Sistema de gestion para servicios, empleados, inventario y reportes de Montallantas Los Castellanos.",
        locale: "es-CO",
        url: "https://TU-DOMINIO.com"
    },
    storageKeys: {
        database: "montallantas_los_castellanos_db"
    },
    google: {
        verificationToken: "REEMPLAZAR_CON_TOKEN_SEARCH_CONSOLE"
    },
    firebase: {
        enabled: false, // Deshabilitado por defecto, se habilita en config.local.js
        config: {
            apiKey: "",
            authDomain: "",
            projectId: "",
            storageBucket: "",
            messagingSenderId: "",
            appId: ""
        }
    },
    supabase: {
        enabled: false, // Deshabilitado por defecto, se habilita en config.local.js
        url: "",
        anonKey: ""
    }
});

// Nota: Las credenciales reales están en js/config.local.js
// Si config.local.js no existe, la aplicación usará modo local (localStorage)
// Para producción, asegúrate de crear config.local.js con las credenciales correctas
