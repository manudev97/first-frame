// Servicio para crear Story Client con wallet del usuario
import { StoryClient, StoryConfig } from '@story-protocol/core-sdk';
import { http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import crypto from 'crypto';

/**
 * Genera una dirección de wallet determinística basada en el ID de Telegram
 * IMPORTANTE: Esta función usa el mismo método que el frontend (primeros 40 caracteres del hash)
 * para garantizar que ambos generen la misma dirección
 */
export function generateDeterministicWallet(telegramUserId: number): string {
  // Usar el mismo método que el frontend: primeros 40 caracteres del hash SHA-256
  const seed = `firstframe_telegram_${telegramUserId}_wallet_seed_v1`;
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return '0x' + hash.substring(0, 40);
}

/**
 * Crea un Story Client usando la wallet del usuario
 * IMPORTANTE: En Story Protocol, necesitamos la private key para firmar transacciones
 * Como no podemos obtener la private key del usuario desde su wallet determinística,
 * usamos la private key del bot pero especificamos el recipient como la wallet del usuario
 */
export async function createStoryClientForUser(userWalletAddress: `0x${string}`): Promise<{
  client: StoryClient;
  recipient: `0x${string}`;
}> {
  if (!process.env.STORY_PRIVATE_KEY) {
    throw new Error('STORY_PRIVATE_KEY no está configurado en .env');
  }

  if (!process.env.STORY_RPC_URL) {
    throw new Error('STORY_RPC_URL no está configurado en .env');
  }

  // Usar la private key del bot para firmar, pero el recipient será la wallet del usuario
  const account = privateKeyToAccount(process.env.STORY_PRIVATE_KEY as `0x${string}`);

  // Obtener chainId correcto - Aeneid testnet usa 1315
  let chainId: any = process.env.STORY_CHAIN_ID;
  
  if (!chainId || chainId === 'aeneid') {
    chainId = 1315;
  } else if (typeof chainId === 'string' && !isNaN(Number(chainId))) {
    chainId = Number(chainId);
  }

  const config: StoryConfig = {
    account, // Bot account para firmar
    transport: http(process.env.STORY_RPC_URL),
    chainId: chainId as any,
  };
  
  const client = StoryClient.newClient(config);

  return {
    client,
    recipient: userWalletAddress, // Wallet del usuario como recipient
  };
}

/**
 * Obtiene la configuración de la chain para Story Protocol
 */
export function getChain() {
  // Obtener chainId correcto - Aeneid testnet usa 1315
  let chainId: any = process.env.STORY_CHAIN_ID;
  
  if (!chainId || chainId === 'aeneid') {
    chainId = 1315;
  } else if (typeof chainId === 'string' && !isNaN(Number(chainId))) {
    chainId = Number(chainId);
  }

  // Retornar configuración de chain para viem
  // Aeneid testnet: chainId 1315
  return {
    id: chainId as number,
    name: chainId === 1315 ? 'Aeneid Testnet' : 'Story Mainnet',
    network: chainId === 1315 ? 'aeneid' : 'story',
    nativeCurrency: {
      decimals: 18,
      name: 'IP',
      symbol: 'IP',
    },
    rpcUrls: {
      default: {
        http: [process.env.STORY_RPC_URL || ''],
      },
    },
  };
}

