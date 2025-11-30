// Servicio para gestión de wallet usando Halliday API
import axios from 'axios';
import { getTelegramUser } from '../utils/telegram';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3001/api');

export interface WalletInfo {
  address: string;
  connected: boolean;
  balance?: string;
  telegramUserId?: number;
  hallidayVerified?: boolean;
}

/**
 * Genera una dirección de wallet determinística basada en el ID de Telegram
 * Usa Web Crypto API para generar un hash SHA-256 determinístico
 * IMPORTANTE: Debe usar el mismo algoritmo que el backend (SHA-256)
 * Esto asegura que el mismo usuario de Telegram siempre obtenga la misma dirección
 */
async function generateDeterministicWallet(telegramUserId: number): Promise<string> {
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
    
    // Tomar los primeros 40 caracteres (20 bytes) para la dirección Ethereum
    // DEBE ser exactamente igual al backend
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
 * Conecta el wallet usando Halliday API
 * Verifica que Halliday esté disponible y genera una wallet determinística
 * La wallet es determinística basada en el ID de Telegram del usuario
 */
export async function connectWallet(): Promise<WalletInfo> {
  const user = getTelegramUser();
  if (!user) {
    throw new Error('No se pudo obtener información de Telegram. Asegúrate de abrir la app desde Telegram.');
  }

  // Verificar conexión con Halliday API
  let hallidayVerified = false;
  try {
    const assetsResponse = await axios.get(`${API_URL}/halliday/assets`);
    if (assetsResponse.data.success) {
      hallidayVerified = true;
      console.log('✅ Halliday API verificada correctamente');
    }
  } catch (hallidayError: any) {
    console.warn('⚠️  No se pudo verificar Halliday API:', hallidayError.message);
    console.warn('💡 Continuando con wallet determinística (modo fallback)');
  }

  // Generar wallet determinística basada en el ID de Telegram
  // Esta dirección será siempre la misma para el mismo usuario
  const address = await generateDeterministicWallet(user.id);
  
  const walletInfo: WalletInfo = {
    address,
    connected: true,
    telegramUserId: user.id,
    hallidayVerified,
  };

  // Guardar en localStorage
  localStorage.setItem('firstframe_wallet', JSON.stringify(walletInfo));
  
  console.log('✅ Wallet conectado:', {
    address,
    telegramUserId: user.id,
    hallidayVerified,
  });
  
  return walletInfo;
}

/**
 * Desconecta el wallet
 */
export function disconnectWallet(): void {
  localStorage.removeItem('firstframe_wallet');
}

/**
 * Obtiene el wallet guardado desde localStorage
 */
export function getSavedWallet(): WalletInfo | null {
  try {
    const savedWallet = localStorage.getItem('firstframe_wallet');
    if (savedWallet) {
      const walletData = JSON.parse(savedWallet);
      if (walletData.address && walletData.connected) {
        return walletData as WalletInfo;
      }
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
 * Actualiza el balance del wallet guardado
 */
export async function updateWalletBalance(): Promise<WalletInfo | null> {
  const wallet = getSavedWallet();
  if (!wallet || !wallet.address) {
    return null;
  }

  try {
    const balance = await getStoryBalance(wallet.address);
    const updatedWallet: WalletInfo = {
      ...wallet,
      balance,
    };
    
    localStorage.setItem('firstframe_wallet', JSON.stringify(updatedWallet));
    return updatedWallet;
  } catch (error) {
    console.error('Error actualizando balance:', error);
    return wallet;
  }
}

