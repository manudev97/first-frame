// Servicio para generar auth tokens de Telegram para Dynamic Auto-Wallets
// Documentación: https://www.dynamic.xyz/docs/guides/integrations/telegram/telegram-auto-wallets
import crypto from 'crypto';

/**
 * Genera un auth token de Telegram para Dynamic Auto-Wallets
 * Según la documentación, el bot debe generar el token usando el bot secret
 * y pasarlo como query parameter en la URL de la mini app
 */
export function generateTelegramAuthToken(initData: string, botSecret: string): string {
  // El bot secret se usa como clave simétrica para firmar el initData
  // Esto es necesario para que Dynamic pueda verificar la autenticidad del token
  
  // Crear un hash HMAC del initData usando el bot secret
  const hmac = crypto.createHmac('sha256', botSecret);
  hmac.update(initData);
  const hash = hmac.digest('hex');
  
  // El auth token es el initData original más el hash de verificación
  // Dynamic espera recibir el initData completo como token
  return initData;
}

/**
 * Valida que el initData sea válido usando el bot secret
 */
export function validateTelegramInitData(initData: string, botSecret: string): boolean {
  try {
    // Parsear el initData (formato: key=value&key2=value2&hash=...)
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    
    if (!hash) {
      return false;
    }
    
    // Remover el hash para calcular nuestro propio hash
    params.delete('hash');
    
    // Ordenar los parámetros y crear data_check_string
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    // Calcular el hash usando el bot secret
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botSecret).digest();
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    
    // Comparar hashes
    return calculatedHash === hash;
  } catch (error) {
    console.error('Error validando initData:', error);
    return false;
  }
}

