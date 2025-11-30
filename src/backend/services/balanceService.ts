// Servicio para obtener balance de Story Testnet (Aeneid)
import { createPublicClient, http, formatEther } from 'viem';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Obtiene el balance de una dirección en Story Testnet (Aeneid)
 */
export async function getStoryBalance(address: `0x${string}`): Promise<string> {
  try {
    if (!process.env.STORY_RPC_URL) {
      throw new Error('STORY_RPC_URL no está configurado');
    }

    const publicClient = createPublicClient({
      transport: http(process.env.STORY_RPC_URL),
    });

    const balance = await publicClient.getBalance({ address });
    const balanceInEther = formatEther(balance);
    
    return balanceInEther;
  } catch (error: any) {
    console.error('Error obteniendo balance de Story:', error);
    throw new Error(`No se pudo obtener balance: ${error.message}`);
  }
}

/**
 * Verifica si una dirección tiene suficiente balance para realizar transacciones
 */
export async function hasSufficientBalance(address: `0x${string}`, minBalance: string = '0.001'): Promise<boolean> {
  try {
    const balance = await getStoryBalance(address);
    return parseFloat(balance) >= parseFloat(minBalance);
  } catch (error) {
    console.error('Error verificando balance:', error);
    return false;
  }
}

