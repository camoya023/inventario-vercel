/**
 * Vercel Serverless Function
 * Expone la configuración de Supabase desde variables de entorno
 */
export default function handler(req, res) {
  // Configurar CORS para desarrollo local
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Manejar preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Solo permitir GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Obtener variables de entorno de Vercel
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  // Validar que existan las variables
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({
      error: 'Missing environment variables',
      details: 'SUPABASE_URL and SUPABASE_ANON_KEY must be configured in Vercel'
    });
  }

  // Devolver configuración
  res.status(200).json({
    url: supabaseUrl,
    anonKey: supabaseAnonKey
  });
}
