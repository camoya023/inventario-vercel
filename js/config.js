/**
 * Configuración de Supabase
 * Obtiene las credenciales desde el serverless function de Vercel
 * o usa configuración local según query parameter
 */

// ========================================
// CONFIGURACIÓN DE ENTORNO
// ========================================

/**
 * Detecta si estamos en desarrollo local o producción
 * @returns {boolean} true si es desarrollo local
 */
function esDesarrolloLocal() {
  return window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1' ||
         window.location.port === '5500';
}

/**
 * Obtiene el entorno solicitado desde el query parameter
 * @returns {string} 'dev' o 'prod'
 */
function obtenerEntornoDeURL() {
  const params = new URLSearchParams(window.location.search);
  const env = params.get('env');

  // Si no hay parámetro, por defecto desarrollo en local
  if (!env && esDesarrolloLocal()) {
    return 'dev';
  }

  return env === 'dev' ? 'dev' : 'prod';
}

/**
 * URL base de la API según el entorno
 * IMPORTANTE: Cambia esta URL por la de tu deploy en Vercel
 */
const API_BASE_URL = esDesarrolloLocal()
  ? 'https://inventario-vercel-five.vercel.app' // ← CAMBIA ESTO por tu URL de Vercel
  : '';

// Cliente de Supabase (se inicializa de forma asíncrona)
let supabaseClient = null;

/**
 * Inicializa el cliente de Supabase obteniendo la configuración del servidor
 * o usando configuración local según el entorno
 * @returns {Promise<Object>} Cliente de Supabase inicializado
 */
async function inicializarSupabaseClient() {
  if (supabaseClient) {
    console.log('[CONFIG] Cliente de Supabase ya inicializado');
    return supabaseClient;
  }

  try {
    const esLocal = esDesarrolloLocal();
    const entorno = obtenerEntornoDeURL();

    console.log('[CONFIG] Modo:', esLocal ? 'DESARROLLO LOCAL' : 'PRODUCCIÓN');
    console.log('[CONFIG] Entorno solicitado:', entorno.toUpperCase());

    let config;

    // Si estamos en local y el entorno es 'dev', usar config local
    if (esLocal && entorno === 'dev') {
      console.log('[CONFIG] 🟢 Usando configuración LOCAL de DESARROLLO');

      // Verificar que exista config.local.js
      if (typeof window.SUPABASE_DEV_CONFIG === 'undefined') {
        throw new Error(
          'No se encontró config.local.js\n' +
          'Asegúrate de:\n' +
          '1. Crear el archivo /js/config.local.js\n' +
          '2. Incluirlo en index.html ANTES de config.js\n' +
          '3. Configurar tus credenciales de desarrollo'
        );
      }

      config = window.SUPABASE_DEV_CONFIG;

      console.log('[CONFIG] Credenciales locales:', {
        url: config.url ? config.url.substring(0, 30) + '...' : '✗',
        anonKey: config.anonKey ? '✓ (configurada)' : '✗'
      });

    } else {
      // Usar Vercel (producción o cuando se solicita prod)
      console.log('[CONFIG] 🔴 Obteniendo configuración de VERCEL (Producción)');

      const apiUrl = API_BASE_URL + '/api/config';
      console.log('[CONFIG] URL de API:', apiUrl);

      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error(`Error al obtener configuración: ${response.status}`);
      }

      config = await response.json();

      console.log('[CONFIG] Configuración obtenida:', {
        url: config.url ? '✓' : '✗',
        anonKey: config.anonKey ? '✓' : '✗'
      });
    }

    // Validar que existan las credenciales
    if (!config.url || !config.anonKey) {
      throw new Error('Configuración incompleta de Supabase');
    }

    // Crear cliente de Supabase
    const { createClient } = supabase;
    supabaseClient = createClient(config.url, config.anonKey);

    console.log('[CONFIG] ✅ Cliente de Supabase inicializado correctamente');
    console.log('[CONFIG] Conectado a:', config.url.substring(0, 40) + '...');

    return supabaseClient;

  } catch (error) {
    console.error('[CONFIG] ❌ Error inicializando Supabase:', error);
    throw error;
  }
}

/**
 * Obtiene el cliente de Supabase (debe estar inicializado previamente)
 * @returns {Object} Cliente de Supabase
 */
function getSupabaseClient() {
  if (!supabaseClient) {
    console.warn('[CONFIG] Cliente de Supabase no inicializado. Llama a inicializarSupabaseClient() primero.');
  }
  return supabaseClient;
}
