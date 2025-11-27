/**
 * Configuración de Supabase
 * Obtiene las credenciales desde el serverless function de Vercel
 */

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
    console.log('[CONFIG] Obteniendo configuración de Supabase...');

    // Obtener configuración del endpoint serverless
    const response = await fetch('/api/config');

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
