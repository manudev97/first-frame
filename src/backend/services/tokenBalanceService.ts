// Servicio para verificar balances de tokens ERC20 (MockERC20, WIP, etc.)
import { createPublicClient, http, Address } from 'viem';
import { getChain } from './storyClientUser';

/**
 * Obtiene el balance de un token ERC20 para una dirección específica
 */
export async function getTokenBalance(
  tokenAddress: Address,
  walletAddress: Address
): Promise<string> {
  try {
    const publicClient = createPublicClient({
      chain: getChain(),
      transport: http(process.env.STORY_RPC_URL!),
    });

    // ABI del ERC20 para balanceOf
    const erc20Abi = [
      {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }]
      },
      {
        name: 'decimals',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint8' }]
      }
    ] as const;

    // Obtener balance y decimales
    const [balance, decimals] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [walletAddress],
      }),
      publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'decimals',
      }).catch(() => 18), // Por defecto 18 decimales
    ]);

    // Convertir de wei a unidades legibles
    const divisor = BigInt(10) ** BigInt(decimals);
    const balanceInUnits = Number(balance) / Number(divisor);

    return balanceInUnits.toFixed(decimals);
  } catch (error: any) {
    console.error(`❌ Error obteniendo balance de token ${tokenAddress}:`, error);
    return '0';
  }
}

/**
 * Verifica si una dirección tiene suficiente balance de un token ERC20
 */
export async function hasSufficientTokenBalance(
  tokenAddress: Address,
  walletAddress: Address,
  requiredAmount: string
): Promise<boolean> {
  try {
    const balance = await getTokenBalance(tokenAddress, walletAddress);
    return parseFloat(balance) >= parseFloat(requiredAmount);
  } catch (error: any) {
    console.error('Error verificando balance de token:', error);
    return false;
  }
}

/**
 * Obtiene la dirección del token para regalías según la red
 */
export function getRoyaltyTokenAddress(): Address {
  const isTestnet = process.env.STORY_CHAIN_ID === 'aeneid' || process.env.STORY_CHAIN_ID === '1315';
  
  if (isTestnet) {
    return (process.env.STORY_MOCK_ERC20_ADDRESS || '0xF2104833d386a2734a4eB3B8ad6FC6812F29E38E') as Address;
  } else {
    return (process.env.STORY_WIP_TOKEN_ADDRESS || '0x1514000000000000000000000000000000000000') as Address;
  }
}

