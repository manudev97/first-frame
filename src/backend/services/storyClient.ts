import { StoryClient, StoryConfig } from '@story-protocol/core-sdk';
import { http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

let storyClient: StoryClient | null = null;

export async function createStoryClient(): Promise<StoryClient> {
  if (storyClient) {
    return storyClient;
  }

  if (!process.env.STORY_PRIVATE_KEY) {
    throw new Error('STORY_PRIVATE_KEY no está configurado en .env');
  }

  if (!process.env.STORY_RPC_URL) {
    throw new Error('STORY_RPC_URL no está configurado en .env');
  }

  const account = privateKeyToAccount(process.env.STORY_PRIVATE_KEY as `0x${string}`);

  // Obtener chainId correcto - Aeneid testnet usa 1315
  let chainId: any = process.env.STORY_CHAIN_ID;
  
  // Si es 'aeneid' o está vacío, usar el chainId numérico correcto
  if (!chainId || chainId === 'aeneid') {
    chainId = 1315; // ChainId correcto para Aeneid testnet
  } else if (typeof chainId === 'string' && !isNaN(Number(chainId))) {
    chainId = Number(chainId);
  }

  const config: StoryConfig = {
    account,
    transport: http(process.env.STORY_RPC_URL),
    chainId: chainId as any,
  };
  
  console.log(`🔗 Story Client configurado con chainId: ${chainId} (Aeneid testnet)`);

  storyClient = StoryClient.newClient(config);

  return storyClient;
}
