import { Router } from 'express';
import { getIPsByUploader } from '../services/ipRegistry';
import { getIPCountByAddress, getIPsByAddress } from '../services/blockchainIPService';
import { getStoryBalance } from '../services/balanceService';
import crypto from 'crypto';

const router = Router();

/**
 * Genera una dirección de wallet determinística basada en el ID de Telegram
 */
function generateDeterministicWallet(telegramUserId: number): string {
  const seed = `firstframe_telegram_${telegramUserId}_wallet_seed_v1`;
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return '0x' + hash.substring(0, 40);
}

/**
 * Obtener estadísticas de un usuario
 * GET /api/user/stats/:telegramUserId?walletAddress=0x...
 * Si se proporciona walletAddress (de Dynamic), usarla. Si no, usar determinística.
 */
router.get('/stats/:telegramUserId', async (req, res) => {
  try {
    const telegramUserId = parseInt(req.params.telegramUserId);
    
    if (isNaN(telegramUserId)) {
      return res.status(400).json({
        success: false,
        error: 'telegramUserId debe ser un número válido',
      });
    }

    // Si se proporciona walletAddress (de Dynamic), usarla. Si no, usar determinística como fallback
    const providedWalletAddress = req.query.walletAddress as string | undefined;
    const userWalletAddress = (providedWalletAddress && providedWalletAddress.startsWith('0x') && providedWalletAddress.length === 42)
      ? (providedWalletAddress as `0x${string}`)
      : (generateDeterministicWallet(telegramUserId) as `0x${string}`);
    
    console.log(`📊 Obteniendo estadísticas para usuario ${telegramUserId}`);
    console.log(`📊 Usando dirección: ${userWalletAddress} ${providedWalletAddress ? '(Dynamic)' : '(Determinística)'}`);

    // Intentar obtener IPs desde blockchain (fuente de verdad)
    let ipsCount = 0;
    try {
      ipsCount = await getIPCountByAddress(userWalletAddress);
      console.log(`✅ IPs obtenidos desde blockchain para usuario ${telegramUserId}: ${ipsCount}`);
    } catch (blockchainError: any) {
      console.warn('⚠️  No se pudieron obtener IPs desde blockchain, usando registry local:', blockchainError.message);
      // Fallback: usar registry local
      const uploaderId = `TelegramUser_${telegramUserId}`;
      const userIPs = await getIPsByUploader(uploaderId);
      ipsCount = userIPs.length;
    }
    
    // Obtener puzzles completados
    let puzzlesCompleted = 0;
    try {
      const { getPuzzleCompletionsCount } = await import('../services/puzzleTrackingService');
      puzzlesCompleted = await getPuzzleCompletionsCount(telegramUserId);
    } catch (puzzleError: any) {
      console.warn('No se pudo obtener conteo de puzzles:', puzzleError.message);
    }
    
    // Obtener regalías pendientes
    let royaltiesPending = '0';
    try {
      const { getPendingRoyaltiesByUser } = await import('../services/royaltyService');
      const pendingRoyalties = await getPendingRoyaltiesByUser(telegramUserId);
      // Calcular monto total de regalías pendientes
      const totalAmount = pendingRoyalties.reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0);
      royaltiesPending = totalAmount.toFixed(2);
    } catch (royaltyError: any) {
      console.warn('No se pudo obtener regalías pendientes:', royaltyError.message);
    }
    
    // Obtener balances (IP nativo y MockERC20)
    let ipBalance = '0';
    let mockTokenBalance = '0';
    try {
      ipBalance = await getStoryBalance(userWalletAddress);
      const { getTokenBalance, getRoyaltyTokenAddress } = await import('../services/tokenBalanceService');
      const tokenAddress = getRoyaltyTokenAddress();
      mockTokenBalance = await getTokenBalance(tokenAddress, userWalletAddress);
    } catch (balanceError: any) {
      console.warn('No se pudo obtener balances:', balanceError.message);
    }
    
    const stats = {
      ipsRegistered: ipsCount,
      puzzlesCompleted: puzzlesCompleted,
      royaltiesPending: royaltiesPending,
      balances: {
        ip: parseFloat(ipBalance).toFixed(2),
        mockToken: parseFloat(mockTokenBalance).toFixed(2),
      },
    };

    res.json({
      success: true,
      telegramUserId,
      stats,
      walletAddress: userWalletAddress, // CRÍTICO: Devolver wallet address usada
      walletType: providedWalletAddress ? 'dynamic' : 'deterministic', // CRÍTICO: Tipo de wallet
    });
  } catch (error: any) {
    console.error('Error obteniendo estadísticas del usuario:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo estadísticas',
    });
  }
});

/**
 * Obtener IPs registrados por un usuario
 * GET /api/user/ips/:telegramUserId
 * Combina registry local (detalles) con blockchain (verificación de ownership)
 */
router.get('/ips/:telegramUserId', async (req, res) => {
  try {
    const telegramUserId = parseInt(req.params.telegramUserId);
    
    if (isNaN(telegramUserId)) {
      return res.status(400).json({
        success: false,
        error: 'telegramUserId debe ser un número válido',
      });
    }

    const uploaderId = `TelegramUser_${telegramUserId}`;
    
    // Si se proporciona walletAddress (de Dynamic), usarla. Si no, usar determinística como fallback
    const providedWalletAddress = req.query.walletAddress as string | undefined;
    const userWalletAddress = (providedWalletAddress && providedWalletAddress.startsWith('0x') && providedWalletAddress.length === 42)
      ? (providedWalletAddress as `0x${string}`)
      : (generateDeterministicWallet(telegramUserId) as `0x${string}`);
    
    console.log(`📊 Obteniendo IPs para usuario ${telegramUserId}`);
    console.log(`📊 Usando dirección: ${userWalletAddress} ${providedWalletAddress ? '(Dynamic)' : '(Determinística)'}`);

    // 1. Obtener IPs desde registry local por uploader
    const registryIPsByUploader = await getIPsByUploader(uploaderId);
    console.log(`📊 IPs encontrados en registry por uploader (${uploaderId}): ${registryIPsByUploader.length}`);

    // 2. Intentar obtener IPs desde blockchain para verificar ownership
    let blockchainIPs: Array<{
      ipId: string;
      tokenId: string;
      txHash: string;
      blockNumber: bigint;
    }> = [];
    
    try {
      blockchainIPs = await getIPsByAddress(userWalletAddress);
      console.log(`📊 IPs encontrados en blockchain para wallet ${userWalletAddress}: ${blockchainIPs.length}`);
    } catch (blockchainError: any) {
      console.warn('⚠️  No se pudieron obtener IPs desde blockchain:', blockchainError.message);
    }

    // 3. Combinar: usar registry local como fuente de detalles, blockchain para verificar
    // Si hay IPs en blockchain, usar esos IP IDs/token IDs para buscar en el registry
    const finalIPs: Array<{
      ipId: string;
      tokenId?: string;
      txHash: string;
      title: string;
      year?: number;
      posterUrl?: string;
      description?: string;
      imdbId?: string;
      createdAt: string;
    }> = [];

    if (blockchainIPs.length > 0) {
      // Si tenemos IPs desde blockchain, buscar sus detalles en el registry
      const { loadRegisteredIPs } = await import('../services/ipRegistry');
      const allRegistryIPs = await loadRegisteredIPs();
      
      console.log(`🔍 Buscando detalles en registry para ${blockchainIPs.length} IPs de blockchain...`);
      console.log(`📋 IPs de blockchain:`, blockchainIPs.map(ip => ({
        tokenId: ip.tokenId,
        txHash: ip.txHash,
        ipId: ip.ipId,
      })));
      console.log(`📋 Total IPs en registry: ${allRegistryIPs.length}`);
      console.log(`📋 Primeros 3 IPs del registry:`, allRegistryIPs.slice(0, 3).map(ip => ({
        tokenId: ip.tokenId,
        txHash: ip.txHash,
        ipId: ip.ipId,
        title: ip.title,
      })));
      
      for (const blockchainIP of blockchainIPs) {
        console.log(`\n🔍 Buscando detalles para IP de blockchain:`, {
          tokenId: blockchainIP.tokenId,
          txHash: blockchainIP.txHash,
          ipId: blockchainIP.ipId,
        });
        
        // Buscar en el registry por:
        // 1. Token ID (más confiable - siempre está disponible)
        // 2. TX Hash (segunda opción - también confiable)
        // 3. IP ID (si no es placeholder)
        const isPlaceholderIP = blockchainIP.ipId.startsWith('PLACEHOLDER_') || 
                                blockchainIP.ipId === '0x0000000000000000000000000000000000000000';
        
        let registryIP: typeof allRegistryIPs[0] | undefined = undefined;
        
        // PRIORIDAD 1: Buscar por Token ID (más confiable)
        if (blockchainIP.tokenId) {
          registryIP = allRegistryIPs.find((r) => {
            const match = r.tokenId && r.tokenId.toString() === blockchainIP.tokenId.toString();
            if (match) {
              console.log(`✅ Match por Token ID: ${r.tokenId} === ${blockchainIP.tokenId}`);
            }
            return match;
          });
          if (registryIP) {
            console.log(`✅ Encontrado por Token ID ${blockchainIP.tokenId}: ${registryIP.title}`);
          } else {
            console.log(`❌ No encontrado por Token ID ${blockchainIP.tokenId}`);
          }
        }
        
        // PRIORIDAD 2: Si no encontramos por Token ID, buscar por TX Hash
        if (!registryIP) {
          registryIP = allRegistryIPs.find((r) => {
            const match = r.txHash && r.txHash.toLowerCase() === blockchainIP.txHash.toLowerCase();
            if (match) {
              console.log(`✅ Match por TX Hash: ${r.txHash} === ${blockchainIP.txHash}`);
            }
            return match;
          });
          if (registryIP) {
            console.log(`✅ Encontrado por TX Hash ${blockchainIP.txHash}: ${registryIP.title}`);
          } else {
            console.log(`❌ No encontrado por TX Hash ${blockchainIP.txHash}`);
          }
        }
        
        // PRIORIDAD 3: Si no es placeholder, buscar por IP ID
        if (!registryIP && !isPlaceholderIP) {
          registryIP = allRegistryIPs.find((r) => {
            const match = r.ipId && r.ipId.toLowerCase() === blockchainIP.ipId.toLowerCase();
            if (match) {
              console.log(`✅ Match por IP ID: ${r.ipId} === ${blockchainIP.ipId}`);
            }
            return match;
          });
          if (registryIP) {
            console.log(`✅ Encontrado por IP ID ${blockchainIP.ipId}: ${registryIP.title}`);
          } else {
            console.log(`❌ No encontrado por IP ID ${blockchainIP.ipId}`);
          }
        }

        if (registryIP) {
          // Usar datos del registry (tiene todos los detalles)
          console.log(`✅ Encontrado en registry: ${registryIP.title} (IP ID: ${registryIP.ipId}, Token ID: ${registryIP.tokenId || blockchainIP.tokenId})`);
          finalIPs.push({
            ipId: registryIP.ipId || blockchainIP.ipId, // Usar el IP ID del registry (más confiable)
            tokenId: registryIP.tokenId || blockchainIP.tokenId?.toString(),
            txHash: registryIP.txHash || blockchainIP.txHash,
            title: registryIP.title,
            year: registryIP.year,
            posterUrl: registryIP.posterUrl,
            description: registryIP.description,
            imdbId: registryIP.imdbId,
            createdAt: registryIP.createdAt,
          });
        } else {
          // IP en blockchain pero no en registry (sin detalles, pero mostrarlo de todos modos)
          console.warn(`⚠️  IP en blockchain pero no en registry: Token ID ${blockchainIP.tokenId}, TX ${blockchainIP.txHash}`);
          console.warn(`💡 Este IP existe en blockchain pero no tiene detalles en el registry local.`);
          console.warn(`💡 Token IDs en registry:`, allRegistryIPs.map(r => r.tokenId).filter(Boolean));
          console.warn(`💡 TX Hashes en registry:`, allRegistryIPs.map(r => r.txHash).slice(0, 5));
          
          // IMPORTANTE: Mostrar el IP de todos modos, aunque no tenga detalles
          // El usuario debe ver que tiene 2 IPs registrados
          finalIPs.push({
            ipId: isPlaceholderIP ? `IP_${blockchainIP.tokenId}` : blockchainIP.ipId, // Usar placeholder si no tenemos IP ID real
            tokenId: blockchainIP.tokenId,
            txHash: blockchainIP.txHash,
            title: `IP Registrado #${blockchainIP.tokenId}`, // Título genérico pero informativo
            year: undefined,
            posterUrl: undefined,
            description: `IP registrado en blockchain. Token ID: ${blockchainIP.tokenId}`,
            imdbId: undefined,
            createdAt: new Date().toISOString(),
          });
          
          console.log(`✅ IP agregado sin detalles del registry: Token ID ${blockchainIP.tokenId}`);
        }
      }
    } else if (registryIPsByUploader.length > 0) {
      // Si no hay IPs en blockchain pero sí en registry por uploader, usar esos
      console.log(`📋 Usando IPs del registry por uploader: ${registryIPsByUploader.length}`);
      finalIPs.push(...registryIPsByUploader.map((ip) => ({
        ipId: ip.ipId,
        tokenId: ip.tokenId || undefined,
        txHash: ip.txHash,
        title: ip.title,
        year: ip.year,
        posterUrl: ip.posterUrl,
        description: ip.description,
        imdbId: ip.imdbId,
        createdAt: ip.createdAt,
      })));
    }

    console.log(`✅ IPs finales para usuario ${telegramUserId}: ${finalIPs.length}`);
    
    res.json({
      success: true,
      telegramUserId,
      items: finalIPs,
      count: finalIPs.length,
    });
  } catch (error: any) {
    console.error('Error obteniendo IPs del usuario:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo IPs',
    });
  }
});

// REMOVIDO: Endpoint /link-wallet
// Ya no es necesario - Dynamic guarda toda la información del usuario
// El frontend siempre enviará la dirección de Dynamic directamente al backend cuando sea necesario

export { router as userRouter };

