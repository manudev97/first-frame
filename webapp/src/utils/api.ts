/**
 * Helper para obtener la URL del API de forma consistente
 * En producción, VITE_API_URL DEBE estar configurado en Vercel
 * En desarrollo, usa el proxy de Vite (/api)
 */
export function getApiUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : '');
  
  // Verificar que API_URL esté configurado en producción
  if (!apiUrl && !import.meta.env.DEV) {
    console.error('❌ ERROR CRÍTICO: VITE_API_URL no está configurado en producción!');
    console.error('   Configura VITE_API_URL en Vercel: Settings → Environment Variables');
    console.error('   Valor esperado: https://first-frame-wg3r.onrender.com/api');
    console.error('   Sin esto, todas las peticiones al backend fallarán con "Network Error"');
  }
  
  // Log en desarrollo para debugging
  if (import.meta.env.DEV) {
    console.log('🔧 [API] Usando API URL:', apiUrl || '/api (proxy de Vite)');
  } else {
    console.log('🌐 [API] Usando API URL:', apiUrl || '❌ NO CONFIGURADO');
  }
  
  return apiUrl;
}

/**
 * Constante exportada para uso directo en componentes
 * Usa getApiUrl() para obtener el valor actualizado
 */
export const API_URL = getApiUrl();

