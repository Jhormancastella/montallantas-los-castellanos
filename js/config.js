/* ============================================
   CONFIGURACIÓN - MONTALLANTAS LOS CASTELLANOS
   ============================================
   NOTA DE SEGURIDAD:
   - Las credenciales se cargan desde js/config.local.js
   - El archivo config.local.js NO se sube a GitHub
   - Ver config.local.js.example para la estructura
   ============================================ */

// Configuración base (sin credenciales)
const baseConfig = {
    site: {
        name: "Montallantas Los Castellanos",
        description: "Sistema de gestion para servicios, empleados, inventario y reportes de Montallantas Los Castellanos.",
        locale: "es-CO",
        url: "https://TU-DOMINIO.com"
    },
    storageKeys: {
        database: "montallantas_los_castellanos_db"
    }
};

// Intentar cargar configuración local (con credenciales)
let localConfig = {};
try {
    // Este archivo se crea localmente y NO se sube a GitHub
    if (window.APP_CONFIG_LOCAL) {
        localConfig = window.APP_CONFIG_LOCAL;
    }
} catch (error) {
    console.warn("No se encontró config.local.js. Usando modo local.");
}

// Configuración final
window.APP_CONFIG = Object.freeze({
    ...baseConfig,
    ...localConfig
});
