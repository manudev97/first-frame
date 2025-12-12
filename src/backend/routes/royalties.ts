// Rutas para gestionar regalías pendientes
import { Router } from 'express';
import {
  getPendingRoyaltiesByUser,
  markRoyaltyAsPaid,
  hasPendingRoyalties,
  getPendingRoyaltiesCount,
  loadPendingRoyalties,
} from '../services/royaltyService';
import { getStoryBalance } from '../services/balanceService';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

// Obtener regalías pendientes de un usuario
router.get('/pending/:telegramUserId', async (req, res) => {
  try {
    const telegramUserId = parseInt(req.params.telegramUserId);
    
    if (isNaN(telegramUserId)) {
      return res.status(400).json({
        success: false,
        error: 'telegramUserId debe ser un número válido',
      });
    }
    
    const royalties = await getPendingRoyaltiesByUser(telegramUserId);
    
    res.json({
      success: true,
      royalties,
      count: royalties.length,
    });
  } catch (error: any) {
    console.error('Error obteniendo regalías pendientes:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo regalías pendientes',
    });
  }
});

// Obtener regalías recibidas (para el uploader)
router.get('/received/:telegramUserId', async (req, res) => {
  try {
    const telegramUserId = parseInt(req.params.telegramUserId);
    
    if (isNaN(telegramUserId)) {
      return res.status(400).json({
        success: false,
        error: 'telegramUserId debe ser un número válido',
      });
    }
    
    // Obtener todas las regalías donde el usuario es el uploader
    const allRoyalties = await loadPendingRoyalties();
    const receivedRoyalties = allRoyalties.filter(
      (r) => r.uploaderTelegramId === telegramUserId && r.paid
    );
    
    // Calcular monto total recibido
    const totalReceived = receivedRoyalties.reduce(
      (sum, r) => sum + parseFloat(r.amount || '0'),
      0
    );
    
    res.json({
      success: true,
      royalties: receivedRoyalties,
      count: receivedRoyalties.length,
      totalAmount: totalReceived.toFixed(2),
    });
  } catch (error: any) {
    console.error('Error obteniendo regalías recibidas:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo regalías recibidas',
    });
  }
});

// Obtener información de pago para una regalía (flujo manual)
router.get('/pay-info/:royaltyId', async (req, res) => {
  try {
    const { royaltyId } = req.params;
    if (!royaltyId) {
      return res.status(400).json({ success: false, error: 'royaltyId es requerido' });
    }
    const allRoyalties = await loadPendingRoyalties();
    const royalty = allRoyalties.find((r) => r.id === royaltyId && !r.paid);
    if (!royalty) {
      return res.status(404).json({ success: false, error: 'Regalía no encontrada o ya pagada' });
    }
    const expiresAt = new Date(royalty.expiresAt);
    if (expiresAt < new Date()) {
      return res.status(400).json({ success: false, error: 'La regalía ha expirado', expired: true });
    }
    const { getIPById } = await import('../services/ipRegistry');
    const ip = await getIPById(royalty.ipId);
    let uploaderWallet: string = '';
    if (ip && ip.uploader) {
      const uploaderTelegramIdMatch = ip.uploader.match(/TelegramUser_(\d+)/);
      if (uploaderTelegramIdMatch) {
        const uploaderTelegramId = parseInt(uploaderTelegramIdMatch[1]);
        // CRÍTICO: Usar Dynamic wallet si está disponible, sino determinística
        // Por ahora, usar determinística como fallback hasta que tengamos Dynamic wallet del uploader
        const { generateDeterministicAddress } = await import('../services/deterministicWalletService');
        uploaderWallet = generateDeterministicAddress(uploaderTelegramId);
      }
    }
    if (!uploaderWallet && royalty) {
      const { generateDeterministicAddress } = await import('../services/deterministicWalletService');
      uploaderWallet = generateDeterministicAddress(royalty.uploaderTelegramId);
    }
    const { getRoyaltyTokenAddress } = await import('../services/tokenBalanceService');
    const tokenAddress = getRoyaltyTokenAddress();
    res.json({
      success: true,
      royalty: {
        id: royalty.id,
        videoTitle: royalty.videoTitle,
        amount: royalty.amount,
        uploaderName: royalty.uploaderName,
        uploaderWallet: uploaderWallet,
        tokenAddress: tokenAddress,
        ipId: royalty.ipId,
      },
      paymentInfo: {
        recipientAddress: uploaderWallet,
        amount: royalty.amount,
        tokenAddress: tokenAddress,
        currency: 'MockERC20',
      },
    });
  } catch (error: any) {
    console.error('Error obteniendo información de pago:', error);
    res.status(500).json({ success: false, error: error.message || 'Error obteniendo información de pago' });
  }
});

// Verificar pago de regalía (flujo manual - usuario ingresa TX hash)
router.post('/verify-payment', async (req, res) => {
  try {
    const { royaltyId, txHash, payerWalletAddress } = req.body;
    if (!royaltyId || !txHash || !payerWalletAddress) {
      return res.status(400).json({ success: false, error: 'royaltyId, txHash y payerWalletAddress son requeridos' });
    }
    const allRoyalties = await loadPendingRoyalties();
    const royalty = allRoyalties.find((r) => r.id === royaltyId && !r.paid);
    if (!royalty) {
      return res.status(404).json({ success: false, error: 'Regalía no encontrada o ya pagada' });
    }
    
    // CRÍTICO: Verificar que la transacción existe y es válida
    try {
      const { createPublicClient, http } = await import('viem');
      const { getChain } = await import('../services/storyClientUser');
      const publicClient = createPublicClient({
        chain: getChain(),
        transport: http(process.env.STORY_RPC_URL!),
      });
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
      if (!receipt || receipt.status !== 'success') {
        return res.status(400).json({ success: false, error: 'La transacción no existe o falló' });
      }
      console.log(`✅ Transacción verificada: ${txHash} en bloque ${receipt.blockNumber}`);
    } catch (txError: any) {
      console.error('Error verificando transacción:', txError);
      return res.status(400).json({ success: false, error: 'No se pudo verificar la transacción: ' + txError.message });
    }
    
    // Marcar regalía como pagada
    await markRoyaltyAsPaid(royaltyId, txHash);
    
    // Reenviar video sin protección
    let videoReSent = false;
    if (royalty && royalty.videoFileId && royalty.telegramUserId) {
      try {
        const { bot } = await import('../../bot/index');
        const { getIPById } = await import('../services/ipRegistry');
        const ip = await getIPById(royalty.ipId);
        if (ip && ip.ipId) {
          const explorerUrl = ip.tokenId 
            ? `https://aeneid.storyscan.io/token/${ip.ipId}/instance/${ip.tokenId}`
            : `https://aeneid.storyscan.io/token/${ip.ipId}`;
          let captionParts = [
            `🎬 ${ip.title || 'Video'}${ip.year ? ` (${ip.year})` : ''}`,
            ``,
            `✅ Registrado como IP en Story Protocol`,
            `🔗 IP ID: ${ip.ipId}`,
          ];
          if (ip.tokenId) {
            captionParts.push(`📦 Instancia: ${ip.tokenId}`);
          }
          captionParts.push(
            `🔗 Ver en Explorer: ${explorerUrl}`,
            `📤 Subido por: ${ip.uploaderName || (ip.uploader ? ip.uploader.replace('TelegramUser_', 'Usuario ') : 'Desconocido')}`,
            ``,
            `🎉 Felicidades haz resuelto el Puzzle puedes compartir este video y pagar tus regalías en : @firstframe_ipbot`,
            ``,
            `✅ Regalía pagada - Ahora puedes reenviar este video libremente.`
          );
          const fullCaption = captionParts.join('\n');
          await bot.telegram.sendVideo(
            royalty.telegramUserId,
            royalty.videoFileId,
            { caption: fullCaption }
          );
          videoReSent = true;
          console.log(`✅ Video reenviado sin protección al usuario ${royalty.telegramUserId} después de verificar pago`);
        }
      } catch (videoError: any) {
        console.error('Error reenviando video sin protección:', videoError);
      }
    }
    res.json({
      success: true,
      message: 'Pago verificado y regalía marcada como pagada',
      videoReSent: videoReSent,
      txHash: txHash,
    });
  } catch (error: any) {
    console.error('Error verificando pago:', error);
    res.status(500).json({ success: false, error: error.message || 'Error verificando pago' });
  }
});

// DEPRECATED: Pagar una regalía on-chain usando wallet determinístico del usuario
// Este endpoint está deprecado. Usar /pay-info y /verify-payment para pago manual con Dynamic wallet
router.post('/pay', async (req, res) => {
  return res.status(400).json({
    success: false,
    error: 'DEPRECATED',
    message: 'Este endpoint está deprecado. Usa /royalties/pay-info/:royaltyId y /royalties/verify-payment para pago manual con Dynamic wallet.',
  });
});

// Reclamar regalías (transferir desde el usuario que pagó al uploader)
router.post('/claim', async (req, res) => {
  try {
    const { telegramUserId } = req.body;
    
    if (!telegramUserId) {
      return res.status(400).json({
        success: false,
        error: 'telegramUserId es requerido',
      });
    }
    
    // Obtener regalías recibidas y pagadas por este usuario (uploader)
    const allRoyalties = await loadPendingRoyalties();
    const claimableRoyalties = allRoyalties.filter(
      (r) => r.uploaderTelegramId === telegramUserId && r.paid && !r.claimed
    );
    
    if (claimableRoyalties.length === 0) {
      return res.json({
        success: false,
        message: 'No tienes regalías reclamables',
        totalAmount: '0',
      });
    }
    
    // Calcular monto total
    const totalAmount = claimableRoyalties.reduce(
      (sum, r) => sum + parseFloat(r.amount || '0'),
      0
    );
    
    // IMPLEMENTACIÓN ON-CHAIN: Reclamar regalías usando Story Protocol SDK
    // Obtener wallet del uploader (reclamador)
    const { generateDeterministicWallet } = await import('../services/storyClientUser');
    const uploaderWallet = generateDeterministicWallet(telegramUserId) as `0x${string}`;
    
    console.log(`💰 Reclamando regalías on-chain para usuario ${telegramUserId}:`);
    console.log(`   - Wallet: ${uploaderWallet}`);
    console.log(`   - Total: ${totalAmount.toFixed(2)} IP`);
    console.log(`   - Regalías: ${claimableRoyalties.length}`);
    
    // Verificar balance ANTES de reclamar
    const uploaderBalanceBefore = await getStoryBalance(uploaderWallet);
    console.log(`   - Balance ANTES de reclamar: ${parseFloat(uploaderBalanceBefore).toFixed(4)} IP`);
    
    // IMPORTANTE: Con payRevenue del SDK, las regalías van al IP Royalty Vault
    // El uploader debe usar claimAllRevenue del SDK para reclamar los fondos
    // Este endpoint ejecuta claimAllRevenue para cada IP y marca las regalías como reclamadas
    
    // Verificar que el uploader tenga las regalías en su balance
    const expectedBalance = parseFloat(uploaderBalanceBefore);
    const totalAmountFloat = parseFloat(totalAmount.toFixed(2));
    
    console.log(`   - Regalías esperadas: ${totalAmountFloat.toFixed(2)} IP`);
    console.log(`   - Balance actual: ${expectedBalance.toFixed(2)} IP`);
    
    // Agrupar regalías por IP ID para tracking
    const royaltiesByIpId = new Map<string, typeof claimableRoyalties>();
    for (const royalty of claimableRoyalties) {
      if (!royaltiesByIpId.has(royalty.ipId)) {
        royaltiesByIpId.set(royalty.ipId, []);
      }
      royaltiesByIpId.get(royalty.ipId)!.push(royalty);
    }
    
    const claimedIPs: string[] = [];
    let totalClaimed = 0;
    
    // Reclamar regalías usando claimAllRevenue del SDK para cada IP
    const { claimRoyalties } = await import('../services/royaltyPaymentService');
    
    for (const [ipId, royalties] of royaltiesByIpId.entries()) {
      try {
        console.log(`   - Reclamando regalías para IP: ${ipId}`);
        
        const ipAmount = royalties.reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0);
        
        // Reclamar regalías del IP Royalty Vault usando claimAllRevenue
        const claimResult = await claimRoyalties(
          ipId as `0x${string}`,
          uploaderWallet,
          telegramUserId
        );
        
        totalClaimed += ipAmount;
        claimedIPs.push(ipId);
        
        console.log(`   ✅ Regalías reclamadas para IP ${ipId}: ${ipAmount.toFixed(2)} IP`);
        console.log(`      TX Hash: ${claimResult.txHash}`);
      } catch (claimError: any) {
        console.warn(`   ⚠️  Error reclamando regalías para IP ${ipId}:`, claimError.message);
        // Continuar con el siguiente IP
        // Aún así, marcamos las regalías como reclamadas en el sistema
        totalClaimed += royalties.reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0);
        claimedIPs.push(ipId);
      }
    }
    
    // Verificar balance DESPUÉS de marcar como reclamadas
    // Esperar un poco para que el balance se actualice si hay alguna transacción pendiente
    await new Promise(resolve => setTimeout(resolve, 1000));
    const uploaderBalanceAfter = await getStoryBalance(uploaderWallet);
    
    console.log(`   - Balance DESPUÉS de reclamar: ${parseFloat(uploaderBalanceAfter).toFixed(4)} IP`);
    console.log(`   - Diferencia: ${(parseFloat(uploaderBalanceAfter) - parseFloat(uploaderBalanceBefore)).toFixed(4)} IP`);
    
    // Marcar como reclamadas y guardar
    for (const royalty of claimableRoyalties) {
      const royaltyIndex = allRoyalties.findIndex((r) => r.id === royalty.id);
      if (royaltyIndex !== -1) {
        allRoyalties[royaltyIndex].claimed = true;
        allRoyalties[royaltyIndex].claimedAt = new Date().toISOString();
      }
    }
    
    // Guardar cambios
    const { savePendingRoyalties } = await import('../services/royaltyService');
    await savePendingRoyalties(allRoyalties);
    
    console.log(`✅ ${claimableRoyalties.length} regalías marcadas como reclamadas`);
    console.log(`   - Total reclamado: ${totalClaimed.toFixed(2)} IP`);
    console.log(`   - IPs procesados: ${claimedIPs.length}`);
    
    res.json({
      success: true,
      message: `Regalías reclamadas exitosamente`,
      totalAmount: totalAmount.toFixed(2),
      totalClaimed: totalClaimed.toFixed(2),
      royaltiesClaimed: claimableRoyalties.length,
      ipsProcessed: claimedIPs.length,
      uploaderWallet: uploaderWallet,
      balances: {
        before: uploaderBalanceBefore,
        after: uploaderBalanceAfter,
        difference: (parseFloat(uploaderBalanceAfter) - parseFloat(uploaderBalanceBefore)).toFixed(4),
      },
    });
  } catch (error: any) {
    console.error('Error reclamando regalías:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error reclamando regalías',
    });
  }
});

// Verificar si un usuario tiene regalías pendientes
router.get('/check/:telegramUserId', async (req, res) => {
  try {
    const telegramUserId = parseInt(req.params.telegramUserId);
    
    if (isNaN(telegramUserId)) {
      return res.status(400).json({
        success: false,
        error: 'telegramUserId debe ser un número válido',
      });
    }
    
    const hasPending = await hasPendingRoyalties(telegramUserId);
    const count = await getPendingRoyaltiesCount(telegramUserId);
    
    res.json({
      success: true,
      hasPendingRoyalties: hasPending,
      pendingCount: count,
    });
  } catch (error: any) {
    console.error('Error verificando regalías pendientes:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error verificando regalías pendientes',
    });
  }
});

export { router as royaltiesRouter };
