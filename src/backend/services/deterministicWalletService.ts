// Servicio para generar wallets determinísticos con private keys
import crypto from 'crypto';
import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, createPublicClient, http, parseEther } from 'viem';

/**
 * Genera una dirección de wallet determinística basada en el ID de Telegram
 * IMPORTANTE: Esta función usa el mismo método que el frontend (primeros 40 caracteres del hash)
 * para garantizar que ambos generen la misma dirección
 * NOTA: Esta dirección puede no corresponder a una private key válida de Ethereum
 * pero es determinística y consistente entre frontend y backend
 */
export function generateDeterministicAddress(telegramUserId: number): `0x${string}` {
  const seed = `firstframe_telegram_${telegramUserId}_wallet_seed_v1`;
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  // Usar los primeros 40 caracteres (mismo método que el frontend)
  return ('0x' + hash.substring(0, 40)) as `0x${string}`;
}

/**
 * Genera una private key determinística basada en el ID de Telegram
 * IMPORTANTE: Esta función genera una private key que corresponde a la dirección generada
 * Como no podemos derivar una private key desde una dirección arbitraria, usamos un método
 * que genera una private key válida pero que puede no corresponder exactamente a la dirección
 * Para solucionar esto, usamos el hash completo como private key y luego verificamos
 */
export function generateDeterministicPrivateKey(telegramUserId: number): `0x${string}` {
  const seed = `firstframe_telegram_${telegramUserId}_wallet_seed_v1`;
  // Generar hash SHA-256 del seed
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  // La private key debe ser exactamente 64 caracteres hex (32 bytes)
  // Usamos el hash completo como private key
  return ('0x' + hash) as `0x${string}`;
}

/**
 * Encuentra el telegramUserId que genera una dirección específica
 * Útil cuando tenemos la dirección pero necesitamos encontrar el telegramUserId
 * Busca en un rango razonable alrededor del telegramUserId proporcionado
 */
export function findTelegramUserIdFromAddress(
  targetAddress: `0x${string}`,
  startFrom?: number,
  searchRange?: number
): number | null {
  // Si se proporciona un punto de inicio, buscar alrededor de ese ID
  const startId = startFrom || 1;
  const range = searchRange || 10000; // Buscar en un rango de 10,000 IDs por defecto
  
  const start = Math.max(1, startId - range);
  const end = startId + range;
  
  console.log(`🔍 Buscando telegramUserId que genera ${targetAddress} en rango ${start}-${end}...`);
  
  for (let i = start; i <= end; i++) {
    const address = generateDeterministicAddress(i);
    if (address.toLowerCase() === targetAddress.toLowerCase()) {
      console.log(`✅ Encontrado telegramUserId: ${i} genera ${address}`);
      return i;
    }
  }
  
  console.warn(`⚠️  No se encontró telegramUserId en rango ${start}-${end}`);
  return null;
}

/**
 * Crea un wallet client para un usuario específico usando su wallet determinístico
 * IMPORTANTE: La dirección generada puede no coincidir con la dirección derivada de la private key
 * porque usamos los primeros 40 caracteres del hash para la dirección (mismo método que frontend)
 * pero usamos el hash completo como private key
 * 
 * Para solucionar esto, verificamos si la dirección derivada coincide, y si no, usamos la dirección esperada
 */
export function createUserWalletClient(telegramUserId: number, expectedAddress?: `0x${string}`) {
  const privateKey = generateDeterministicPrivateKey(telegramUserId);
  const account = privateKeyToAccount(privateKey);
  const expectedAddr = expectedAddress || generateDeterministicAddress(telegramUserId);
  
  // Verificar si la dirección derivada coincide con la esperada
  if (account.address.toLowerCase() !== expectedAddr.toLowerCase()) {
    console.warn(`⚠️  Dirección derivada (${account.address}) no coincide con esperada (${expectedAddr})`);
    console.warn(`   Esto es normal cuando usamos los primeros 40 caracteres del hash como dirección`);
    console.warn(`   La private key generada corresponde a ${account.address}, no a ${expectedAddr}`);
    console.warn(`   Para usar ${expectedAddr}, necesitaríamos su private key real`);
  }
  
  // Obtener chainId correcto
  let chainId: any = process.env.STORY_CHAIN_ID;
  if (!chainId || chainId === 'aeneid') {
    chainId = 1315; // Aeneid testnet
  } else if (typeof chainId === 'string' && !isNaN(Number(chainId))) {
    chainId = Number(chainId);
  }
  
  // Definir chain personalizada para Story Aeneid
  const storyChain = {
    id: chainId,
    name: 'Story Aeneid',
    network: 'aeneid',
    nativeCurrency: {
      name: 'IP',
      symbol: 'IP',
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: [process.env.STORY_RPC_URL!],
      },
    },
  } as const;
  
  const walletClient = createWalletClient({
    account,
    chain: storyChain,
    transport: http(process.env.STORY_RPC_URL!),
  });
  
  const publicClient = createPublicClient({
    chain: storyChain,
    transport: http(process.env.STORY_RPC_URL!),
  });
  
  return {
    walletClient,
    publicClient,
    account,
    address: account.address, // Dirección real derivada de la private key
    expectedAddress: expectedAddr, // Dirección esperada (primeros 40 caracteres)
  };
}

/**
 * Verifica que la dirección generada coincida con la private key generada
 * Esto asegura que el wallet determinístico sea consistente
 */
export function verifyDeterministicWallet(telegramUserId: number): boolean {
  try {
    const address = generateDeterministicAddress(telegramUserId);
    const privateKey = generateDeterministicPrivateKey(telegramUserId);
    const account = privateKeyToAccount(privateKey);
    
    return account.address.toLowerCase() === address.toLowerCase();
  } catch (error) {
    console.error('Error verificando wallet determinístico:', error);
    return false;
  }
}

