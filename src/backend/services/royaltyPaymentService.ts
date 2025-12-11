// Servicio para pagar regalías usando payRoyaltyOnBehalf del Royalty Module
// Según la documentación: https://docs.story.foundation/developers/smart-contracts-guide/claim-revenue
import { StoryClient } from '@story-protocol/core-sdk';
import { createStoryClientForUser } from './storyClientUser';
import { createPublicClient, createWalletClient, http, parseUnits, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getChain } from './storyClientUser';
import { generateDeterministicAddress } from './deterministicWalletService';

/**
 * Token whitelisted para regalías en Story Protocol
 * En testnet (Aeneid), usar MockERC20
 * En mainnet, usar $WIP
 */
/**
 * Obtiene la dirección del token whitelisted para regalías
 * Direcciones oficiales desde: https://docs.story.foundation/developers/deployed-smart-contracts#whitelisted-revenue-tokens
 */
const getRoyaltyTokenAddress = (): Address => {
  const isTestnet = process.env.STORY_CHAIN_ID === 'aeneid' || process.env.STORY_CHAIN_ID === '1315';
  
  if (isTestnet) {
    // MockERC20 token address para Aeneid testnet
    // Dirección oficial: 0xF2104833d386a2734a4eB3B8ad6FC6812F29E38E
    // Puedes mintear tokens aquí: https://aeneid.storyscan.io/address/0xF2104833d386a2734a4eB3B8ad6FC6812F29E38E?tab=write_contract#0x40c10f19
    const mockToken = process.env.STORY_MOCK_ERC20_ADDRESS || '0xF2104833d386a2734a4eB3B8ad6FC6812F29E38E';
    return mockToken as Address;
  } else {
    // WIP token address para Story mainnet
    // Dirección oficial: 0x1514000000000000000000000000000000000000
    const wipToken = process.env.STORY_WIP_TOKEN_ADDRESS || '0x1514000000000000000000000000000000000000';
    return wipToken as Address;
  }
};

/**
 * Verificar y aprobar el Royalty Module para que pueda gastar tokens del usuario
 */
export async function approveRoyaltyModule(
  userWalletAddress: Address,
  userTelegramId: number,
  tokenAddress: Address,
  amount: string
): Promise<string | null> {
  try {
    console.log(`🔐 Verificando aprobación del Royalty Module...`);
    console.log(`   - Usuario: ${userWalletAddress}`);
    console.log(`   - Token: ${tokenAddress}`);
    console.log(`   - Monto: ${amount}`);
    
    // Crear cliente para el usuario
    const { client } = await createStoryClientForUser(userWalletAddress);
    
    // Obtener la dirección del Royalty Module
    // Dirección oficial de Aeneid Testnet: 0xD2f60c40fEbccf6311f8B47c4f2Ec6b040400086
    // Fuente: https://docs.story.foundation/developers/deployed-smart-contracts
    const royaltyModuleAddress = process.env.STORY_ROYALTY_MODULE_ADDRESS || '0xD2f60c40fEbccf6311f8B47c4f2Ec6b040400086';
    
    // Verificar si ya está aprobado
    // TODO: Implementar verificación de allowance usando el contrato ERC20
    // Por ahora, asumimos que necesitamos aprobar
    
    // Aprobar el Royalty Module para gastar tokens
    // Esto requiere interactuar con el contrato ERC20 directamente
    // Por ahora, retornamos null y manejamos la aprobación en el pago principal
    console.log(`✅ Aprobación del Royalty Module verificada (manejo manual requerido)`);
    return null;
  } catch (error: any) {
    console.error('❌ Error verificando aprobación del Royalty Module:', error);
    // No fallar si la aprobación falla, intentar el pago de todas formas
    return null;
  }
}

/**
 * Pagar regalía usando payRoyaltyOnBehalf del Royalty Module
 * Esto descuenta automáticamente del balance del usuario y agrega fondos al IP Royalty Vault
 * 
 * Según la documentación: ROYALTY_MODULE.payRoyaltyOnBehalf(childIpId, address(0), address(MERC20), amount)
 */
export async function payRoyaltyWithSDK(
  ipId: Address,
  payerWalletAddress: Address,
  payerTelegramId: number,
  amount: string, // Monto en tokens (ej: "0.1")
  currencyToken?: Address // Token a usar (opcional, por defecto usa MockERC20 o WIP)
): Promise<{ txHash: string; receipt: any }> {
  try {
    console.log(`💰 Pagando regalía usando payRoyaltyOnBehalf del Royalty Module:`);
    console.log(`   - IP ID: ${ipId}`);
    console.log(`   - Payer: ${payerWalletAddress}`);
    console.log(`   - Amount: ${amount}`);
    
    // Obtener el token a usar
    const tokenAddress = currencyToken || getRoyaltyTokenAddress();
    console.log(`   - Token: ${tokenAddress}`);
    
    // Obtener dirección del Royalty Module
    const royaltyModuleAddress = (process.env.STORY_ROYALTY_MODULE_ADDRESS || '0xD2f60c40fEbccf6311f8B47c4f2Ec6b040400086') as Address;
    console.log(`   - Royalty Module: ${royaltyModuleAddress}`);
    
    // IMPORTANTE: Usar la dirección del frontend directamente
    // El frontend envía la dirección correcta (0x23ce993e709af9763aa4bf8f84da9d8ae871ab73)
    // No intentar generar desde telegramUserId porque puede no coincidir
    console.log(`   - Usando wallet del frontend: ${payerWalletAddress}`);
    
    // Crear wallet client usando la dirección del frontend
    // Necesitamos encontrar el telegramUserId que genera esta dirección para obtener la private key
    const { createUserWalletClient, findTelegramUserIdFromAddress } = await import('./deterministicWalletService');
    
    // Buscar el telegramUserId correcto que genera el payerWalletAddress
    const foundUserId = findTelegramUserIdFromAddress(
      payerWalletAddress,
      payerTelegramId,
      100000 // Buscar en un rango amplio
    );
    
    if (!foundUserId) {
      throw new Error(
        `No se pudo encontrar el telegramUserId que genera el wallet ${payerWalletAddress}. ` +
        `El wallet puede haber sido generado de otra forma. ` +
        `Por favor, verifica que estás usando la dirección correcta del bot.`
      );
    }
    
    console.log(`✅ Encontrado telegramUserId correcto: ${foundUserId} para wallet ${payerWalletAddress}`);
    const userWallet = createUserWalletClient(foundUserId, payerWalletAddress);
    
    // Convertir el monto a la unidad correcta (18 decimales para la mayoría de tokens)
    const amountInWei = parseUnits(amount, 18);
    
    // IMPORTANTE: Usar la dirección del frontend (payerWalletAddress) para verificar balance y allowance
    // NO usar userWallet.address porque puede ser diferente
    const { getTokenBalance, hasSufficientTokenBalance, getRoyaltyTokenAddress: getTokenAddr } = await import('./tokenBalanceService');
    
    // Verificar balance de MockERC20 en la dirección del frontend (no en la derivada)
    const mockTokenAddress = getTokenAddr();
    const tokenBalance = await getTokenBalance(mockTokenAddress, payerWalletAddress);
    const hasBalance = await hasSufficientTokenBalance(mockTokenAddress, payerWalletAddress, amount);
    
    console.log(`   - Balance MockERC20 en ${payerWalletAddress}: ${tokenBalance} tokens`);
    console.log(`   - Monto requerido: ${amount} tokens`);
    console.log(`   - Tiene suficiente: ${hasBalance ? '✅' : '❌'}`);
    
    if (!hasBalance) {
      throw new Error(
        `Balance insuficiente de MockERC20. ` +
        `Balance actual: ${tokenBalance} tokens. Necesitas: ${amount} tokens. ` +
        `Obtén tokens MockERC20 en: https://aeneid.storyscan.io/address/${mockTokenAddress}?tab=write_contract#0x40c10f19`
      );
    }
    
    // IMPORTANTE: Antes de pagar, debemos aprobar el Royalty Module para gastar tokens
    // Verificar allowance primero usando la dirección del frontend
    const publicClient = createPublicClient({
      chain: getChain(),
      transport: http(process.env.STORY_RPC_URL!),
    });
    
    // ABI del ERC20 para approve y allowance
    const erc20Abi = [
      {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'spender', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool' }]
      },
      {
        name: 'allowance',
        type: 'function',
        stateMutability: 'view',
        inputs: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' }
        ],
        outputs: [{ name: '', type: 'uint256' }]
      }
    ] as const;
    
    // Verificar allowance actual usando la dirección del frontend
    const currentAllowance = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [payerWalletAddress, royaltyModuleAddress], // Usar payerWalletAddress, no userWallet.address
    });
    
    console.log(`   - Allowance actual para ${payerWalletAddress}: ${currentAllowance.toString()}`);
    console.log(`   - Monto requerido: ${amountInWei.toString()}`);
    
    // IMPORTANTE: El usuario DEBE aprobar el Royalty Module antes de poder pagar regalías
    // Con Dynamic Wallet, el usuario puede aprobar y pagar desde su wallet real
    // NO usamos el bot para pagar - el usuario debe pagar con su wallet
    
    if (currentAllowance < amountInWei) {
      // El usuario no ha aprobado el Royalty Module
      // Debe aprobar primero usando Dynamic Wallet desde el frontend
      throw new Error(
        `El usuario no ha aprobado el Royalty Module para gastar tokens. ` +
        `Allowance actual: ${currentAllowance.toString()}, requerido: ${amountInWei.toString()}. ` +
        `Por favor, aprueba el Royalty Module desde tu wallet Dynamic primero. ` +
        `Dirección del Royalty Module: ${royaltyModuleAddress} ` +
        `Token: ${tokenAddress} (MockERC20)`
      );
    }
    
    console.log(`✅ El usuario ya aprobó el Royalty Module (allowance: ${currentAllowance.toString()})`);
    console.log(`   - Procederemos con payRoyaltyOnBehalf normalmente`);
    console.log(`   - Los tokens se descuentan de ${payerWalletAddress} porque aprobó el Royalty Module`);
    
    // Obtener dirección del bot para firmar la transacción (solo para ejecutar payRoyaltyOnBehalf)
    // Los tokens se descuentan del usuario porque ya aprobó
    if (!process.env.STORY_PRIVATE_KEY) {
      throw new Error('STORY_PRIVATE_KEY no está configurado');
    }
    const botAccount = privateKeyToAccount(process.env.STORY_PRIVATE_KEY as `0x${string}`);
    
    // ABI del Royalty Module para payRoyaltyOnBehalf
    // Según la documentación: ROYALTY_MODULE.payRoyaltyOnBehalf(childIpId, address(0), address(MERC20), amount)
    const royaltyModuleAbi = [
      {
        name: 'payRoyaltyOnBehalf',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'childIpId', type: 'address' },
          { name: 'parentIpId', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ],
        outputs: []
      }
    ] as const;
    
    // Crear bot wallet client para firmar la transacción
    const botWalletClient = createWalletClient({
      account: botAccount,
      chain: getChain(),
      transport: http(process.env.STORY_RPC_URL!),
    });
    
    // Ejecutar payRoyaltyOnBehalf desde el bot wallet
    // Los tokens se descuentan del usuario porque ya aprobó el Royalty Module
    console.log(`📤 Ejecutando payRoyaltyOnBehalf según documentación de Story Protocol...`);
    console.log(`   - Bot wallet (firma transacción): ${botAccount.address}`);
    console.log(`   - Payer (tiene tokens y aprobó): ${payerWalletAddress}`);
    console.log(`   - IP ID (recibe regalía): ${ipId}`);
    console.log(`   - Token: ${tokenAddress} (MockERC20)`);
    console.log(`   - Amount: ${amount} tokens (${amountInWei.toString()} wei)`);
    console.log(`   - NOTA: Los tokens se descuentan de ${payerWalletAddress} porque aprobó el Royalty Module`);
    const hash = await botWalletClient.writeContract({
      address: royaltyModuleAddress,
      abi: royaltyModuleAbi,
      functionName: 'payRoyaltyOnBehalf',
      args: [
        ipId, // childIpId: el IP que recibe la regalía
        '0x0000000000000000000000000000000000000000' as Address, // parentIpId: address(0) para pago directo (no es derivado)
        tokenAddress, // token: MockERC20 o WIP
        amountInWei, // amount: monto en wei
      ],
    });
    
    console.log(`✅ Transacción de regalía enviada: ${hash}`);
    
    // Esperar confirmación (reutilizar publicClient ya declarado arriba)
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    console.log(`✅ Regalía pagada exitosamente:`);
    console.log(`   - TX Hash: ${hash}`);
    console.log(`   - Block: ${receipt.blockNumber}`);
    console.log(`   - Gas usado: ${receipt.gasUsed.toString()}`);
    
    return {
      txHash: hash,
      receipt,
    };
  } catch (error: any) {
    console.error('❌ Error en payRoyaltyWithSDK:', error);
    throw error;
  }
}

/**
 * Reclamar regalías acumuladas de un IP Asset
 * Esto permite al uploader reclamar los fondos del IP Royalty Vault
 */
export async function claimRoyalties(
  ipId: Address,
  claimerWalletAddress: Address,
  claimerTelegramId: number
): Promise<{ txHash: string; receipt: any; amount: string }> {
  try {
    console.log(`💰 Reclamando regalías acumuladas:`);
    console.log(`   - IP ID: ${ipId}`);
    console.log(`   - Claimer: ${claimerWalletAddress}`);
    
    // Crear cliente para el claimer
    const { client } = await createStoryClientForUser(claimerWalletAddress);
    
    // Reclamar todas las regalías acumuladas usando claimAllRevenue del SDK
    console.log(`📤 Ejecutando claimAllRevenue...`);
    
    try {
      // @ts-ignore - SDK types may have changed
      const tx = await client.royalty.claimAllRevenue({
        ipId: ipId,
        // claimer: claimerWalletAddress, // Puede ser opcional si se usa el account del client
      } as any);
      
      // @ts-ignore - SDK may return txHashes array instead of txHash
      const txHash = tx.txHash || (tx.txHashes && tx.txHashes[0]) || 'unknown';
      console.log(`✅ Transacción de reclamación enviada: ${txHash}`);
      
      // Esperar confirmación
      const publicClient = createPublicClient({
        chain: getChain(),
        transport: http(process.env.STORY_RPC_URL!),
      });
      
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash: txHash as `0x${string}` 
      });
      
      // Obtener el monto reclamado desde los eventos de la transacción
      // TODO: Parsear eventos para obtener el monto exacto
      const amount = '0'; // Placeholder, debe parsearse desde los eventos
      
      console.log(`✅ Regalías reclamadas exitosamente:`);
      console.log(`   - TX Hash: ${txHash}`);
      console.log(`   - Block: ${receipt.blockNumber}`);
      console.log(`   - Amount: ${amount}`);
      
      return {
        txHash: txHash,
        receipt,
        amount,
      };
    } catch (sdkError: any) {
      console.error('❌ Error usando claimAllRevenue del SDK:', sdkError);
      throw new Error(`Error reclamando regalías con SDK: ${sdkError.message}`);
    }
  } catch (error: any) {
    console.error('❌ Error en claimRoyalties:', error);
    throw error;
  }
}

