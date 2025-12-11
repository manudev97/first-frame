// Servicio para gestión de wallet usando Dynamic Wallet
import axios from 'axios';
import { getTelegramUser } from '../utils/telegram';

// CRÍTICO: En producción, VITE_API_URL DEBE estar configurado en Vercel
// En desarrollo, usa el proxy de Vite (/api)
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : '');

export interface WalletInfo {
  address: string;
  connected: boolean;
  balance?: string; // IP nativo
  mockTokenBalance?: string; // MockERC20 tokens
  telegramUserId?: number;
}

/**
 * Genera una dirección de wallet determinística basada en el ID de Telegram
 * Usa Web Crypto API para generar un hash SHA-256 determinístico
 * IMPORTANTE: Debe usar el mismo algoritmo que el backend (SHA-256)
 * Esto asegura que el mismo usuario de Telegram siempre obtenga la misma dirección
 */
export async function generateDeterministicWallet(telegramUserId: number): Promise<string> {
  // Crear un seed determinístico basado en el ID de Telegram
  // DEBE ser exactamente el mismo que en el backend: `firstframe_telegram_${telegramUserId}_wallet_seed_v1`
  const seed = `firstframe_telegram_${telegramUserId}_wallet_seed_v1`;
  
  try {
    // Usar Web Crypto API para generar hash SHA-256 (mismo algoritmo que el backend)
    const encoder = new TextEncoder();
    const data = encoder.encode(seed);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // IMPORTANTE: Usar el hash completo como private key y derivar la dirección
    // Esto garantiza que la dirección corresponda a una private key válida
    // NOTA: Para usar ethers.js, necesitaríamos instalarlo. Por ahora, usamos el método antiguo
    // pero el backend ahora puede buscar el telegramUserId correcto que genera el wallet
    
    // Tomar los primeros 40 caracteres (20 bytes) para la dirección Ethereum
    // DEBE ser exactamente igual al backend (método antiguo para compatibilidad)
    const address = '0x' + hashHex.substring(0, 40);
    
    return address;
  } catch (error) {
    // Fallback: intentar obtener desde el backend
    console.warn('Web Crypto API no disponible, intentando obtener desde backend');
    try {
      const response = await axios.get(`${API_URL}/wallet/address/${telegramUserId}`);
      if (response.data.success) {
        return response.data.address;
      }
    } catch (backendError) {
      console.error('Error obteniendo wallet desde backend:', backendError);
    }
    
    // Último fallback: hash simple (no recomendado, pero funcional)
    console.warn('Usando fallback de hash simple');
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const hexString = Math.abs(hash).toString(16).padStart(8, '0');
    const address = '0x' + (hexString.repeat(5).substring(0, 40));
    return address;
  }
}

/**
 * Obtiene la clave de localStorage única para un usuario de Telegram
 */
function getWalletStorageKey(telegramUserId: number): string {
  return `firstframe_wallet_${telegramUserId}`;
}

/**
 * Conecta el wallet usando Dynamic Wallet
 * NOTA: Esta función ahora es un wrapper para compatibilidad
 * El usuario debe conectar su wallet usando Dynamic Widget desde la UI
 */
export async function connectWallet(): Promise<WalletInfo> {
  const user = getTelegramUser();
  if (!user) {
    throw new Error('No se pudo obtener información de Telegram. Asegúrate de abrir la app desde Telegram.');
  }

  // Con Dynamic Wallet, el usuario debe conectar desde el widget
  // Esta función se mantiene para compatibilidad pero no hace nada
  // La wallet real se obtiene desde useDynamicWallet hook
  throw new Error(
    'Por favor, conecta tu wallet usando el botón "Conectar Wallet" en la interfaz. ' +
    'Dynamic Wallet maneja la conexión automáticamente.'
  );
}

/**
 * Desconecta el wallet del usuario actual
 */
export function disconnectWallet(): void {
  const user = getTelegramUser();
  if (user) {
    const storageKey = getWalletStorageKey(user.id);
    localStorage.removeItem(storageKey);
    console.log(`✅ Wallet desconectado para usuario ${user.id}`);
  } else {
    // Fallback: limpiar todas las wallets si no hay usuario
    // Esto puede pasar si se llama fuera del contexto de Telegram
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('firstframe_wallet_')) {
        localStorage.removeItem(key);
      }
    });
    // También limpiar la clave antigua por compatibilidad
    localStorage.removeItem('firstframe_wallet');
  }
}

/**
 * Obtiene el wallet guardado desde localStorage para el usuario actual
 * IMPORTANTE: Solo devuelve la wallet del usuario actual de Telegram
 */
export function getSavedWallet(): WalletInfo | null {
  try {
    const user = getTelegramUser();
    if (!user) {
      // Si no hay usuario de Telegram, no devolver wallet
      // Esto previene que se muestre la wallet de otro usuario
      return null;
    }

    // Usar clave única por usuario
    const storageKey = getWalletStorageKey(user.id);
    const savedWallet = localStorage.getItem(storageKey);
    
    if (savedWallet) {
      const walletData = JSON.parse(savedWallet);
      // Verificar que la wallet pertenece al usuario actual
      if (walletData.address && walletData.connected && walletData.telegramUserId === user.id) {
        return walletData as WalletInfo;
      } else {
        // Si la wallet no coincide con el usuario actual, limpiarla
        console.warn(`⚠️  Wallet encontrada pero no coincide con usuario actual. Limpiando...`);
        localStorage.removeItem(storageKey);
        return null;
      }
    }
    
    // Limpiar clave antigua por compatibilidad si existe
    const oldWallet = localStorage.getItem('firstframe_wallet');
    if (oldWallet) {
      console.warn('⚠️  Encontrada wallet con clave antigua. Limpiando...');
      localStorage.removeItem('firstframe_wallet');
    }
  } catch (e) {
    console.error('Error cargando wallet guardado:', e);
  }
  return null;
}

/**
 * Verifica si el wallet está conectado
 */
export function isWalletConnected(): boolean {
  const wallet = getSavedWallet();
  return wallet !== null && wallet.connected;
}

/**
 * Obtiene el balance de Story Testnet para una dirección
 */
export async function getStoryBalance(address: string): Promise<string> {
  try {
    const response = await axios.get(`${API_URL}/balance/${address}`);
    if (response.data.success) {
      return response.data.balance;
    }
    throw new Error('No se pudo obtener el balance');
  } catch (error: any) {
    console.error('Error obteniendo balance:', error);
    return '0';
  }
}

/**
 * Obtiene el balance de MockERC20 para una dirección
 */
export async function getMockTokenBalance(address: string): Promise<string> {
  try {
    const response = await axios.get(`${API_URL}/balance/${address}/token`);
    if (response.data.success) {
      return response.data.balance;
    }
    throw new Error('No se pudo obtener el balance de MockERC20');
  } catch (error: any) {
    console.error('Error obteniendo balance de MockERC20:', error);
    return '0';
  }
}

/**
 * Actualiza el balance del wallet guardado (IP nativo y MockERC20)
 */
export async function updateWalletBalance(): Promise<WalletInfo | null> {
  const wallet = getSavedWallet();
  if (!wallet || !wallet.address) {
    return null;
  }

  const user = getTelegramUser();
  if (!user) {
    return null;
  }

  try {
    const [balance, mockTokenBalance] = await Promise.all([
      getStoryBalance(wallet.address),
      getMockTokenBalance(wallet.address),
    ]);
    
    const updatedWallet: WalletInfo = {
      ...wallet,
      balance,
      mockTokenBalance,
    };
    
    // Guardar con clave única por usuario
    const storageKey = getWalletStorageKey(user.id);
    localStorage.setItem(storageKey, JSON.stringify(updatedWallet));
    return updatedWallet;
  } catch (error) {
    console.error('Error actualizando balance:', error);
    return wallet;
  }
}

