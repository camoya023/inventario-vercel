/**
 * Configuración de Supabase
 * Obtiene las credenciales desde el serverless function de Vercel
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
 * @returns {Promise<Object>} Cliente de Supabase inicializado
 */
async function inicializarSupabaseClient() {
  if (supabaseClient) {
    console.log('[CONFIG] Cliente de Supabase ya inicializado');
    return supabaseClient;
  }

  try {
    const esLocal = esDesarrolloLocal();
    console.log('[CONFIG] Modo:', esLocal ? 'DESARROLLO LOCAL' : 'PRODUCCIÓN');
    console.log('[CONFIG] Obteniendo configuración de Supabase...');

    // Obtener configuración del endpoint serverless
    const apiUrl = API_BASE_URL + '/api/config';
    console.log('[CONFIG] URL de API:', apiUrl);

    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`Error al obtener configuración: ${response.status}`);
    }

    const config = await response.json();

    console.log('[CONFIG] Configuración obtenida:', {
      url: config.url ? '✓' : '✗',
      anonKey: config.anonKey ? '✓' : '✗'
    });

    // Validar que existan las credenciales
    if (!config.url || !config.anonKey) {
      throw new Error('Configuración incompleta de Supabase');
    }

    // Crear cliente de Supabase
    const { createClient } = supabase;
    supabaseClient = createClient(config.url, config.anonKey);

    console.log('[CONFIG] ✅ Cliente de Supabase inicializado correctamente');

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
