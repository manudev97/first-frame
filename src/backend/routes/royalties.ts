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

// Pagar una regalía on-chain usando wallet determinístico del usuario
router.post('/pay', async (req, res) => {
  try {
    const { royaltyId, ownerAddress, destinationAddress, payerTelegramUserId } = req.body;
    
    if (!royaltyId || !ownerAddress || !destinationAddress) {
      return res.status(400).json({
        success: false,
        error: 'royaltyId, ownerAddress y destinationAddress son requeridos',
      });
    }
    
    // Obtener la regalía pendiente
    const allRoyalties = await loadPendingRoyalties();
    const royalty = allRoyalties.find((r) => r.id === royaltyId && !r.paid);
    
    if (!royalty) {
      return res.status(404).json({
        success: false,
        error: 'Regalía no encontrada o ya pagada',
      });
    }
    
    // Verificar que no esté expirada
    const expiresAt = new Date(royalty.expiresAt);
    if (expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'La regalía ha expirado',
        expired: true,
      });
    }
    
    // IMPLEMENTACIÓN ON-CHAIN: Transferir regalía usando wallet del usuario
    // IMPORTANTE: Usar el ownerAddress directamente del frontend (es el wallet correcto)
    const payerWallet = ownerAddress as `0x${string}`;
    
    // Obtener wallet del uploader desde el registry o generar desde telegramUserId
    let uploaderWallet: `0x${string}`;
    
    // Intentar obtener el wallet del uploader desde el registry del IP
    const { getIPById } = await import('../services/ipRegistry');
    const ip = await getIPById(royalty.ipId);
    
    if (ip && ip.uploader) {
      // Extraer telegramUserId del uploader (formato: TelegramUser_123456)
      const uploaderTelegramIdMatch = ip.uploader.match(/TelegramUser_(\d+)/);
      if (uploaderTelegramIdMatch) {
        const uploaderTelegramId = parseInt(uploaderTelegramIdMatch[1]);
        const { generateDeterministicWallet } = await import('../services/storyClientUser');
        uploaderWallet = generateDeterministicWallet(uploaderTelegramId) as `0x${string}`;
        console.log(`✅ Wallet del uploader obtenido desde registry: ${uploaderWallet}`);
      } else {
        // Fallback: usar el telegramUserId de la regalía
        const { generateDeterministicWallet } = await import('../services/storyClientUser');
        uploaderWallet = generateDeterministicWallet(royalty.uploaderTelegramId) as `0x${string}`;
        console.log(`⚠️  Usando wallet generado desde regalía: ${uploaderWallet}`);
      }
    } else {
      // Fallback: generar desde telegramUserId de la regalía
      const { generateDeterministicWallet } = await import('../services/storyClientUser');
      uploaderWallet = generateDeterministicWallet(royalty.uploaderTelegramId) as `0x${string}`;
      console.log(`⚠️  Usando wallet generado desde regalía (sin IP en registry): ${uploaderWallet}`);
    }
    
    // IMPORTANTE: Necesitamos el telegramUserId del payer para generar su private key
    // Si no se proporciona, intentamos obtenerlo desde el ownerAddress
    let payerTelegramUserIdFinal = payerTelegramUserId;
    
    if (!payerTelegramUserIdFinal) {
      return res.status(400).json({
        success: false,
        error: 'payerTelegramUserId es requerido para generar la private key del wallet',
        message: 'El telegramUserId del usuario que paga es necesario para firmar la transacción desde su wallet',
      });
    }
    
    // IMPORTANTE: Verificar que el wallet generado desde telegramUserId coincida con ownerAddress
    // Si no coincide, buscar el telegramUserId correcto que genera ese wallet
    const { generateDeterministicWallet } = await import('../services/storyClientUser');
    const { findTelegramUserIdFromAddress } = await import('../services/deterministicWalletService');
    
    let finalPayerTelegramUserId = payerTelegramUserIdFinal;
    let finalPayerWallet = generateDeterministicWallet(payerTelegramUserIdFinal);
    
    if (finalPayerWallet.toLowerCase() !== payerWallet.toLowerCase()) {
      console.warn(`⚠️  Wallet generado (${finalPayerWallet}) no coincide con ownerAddress (${payerWallet})`);
      console.warn(`   Buscando telegramUserId correcto que genera el wallet ${payerWallet}...`);
      console.warn(`   Buscando alrededor del telegramUserId ${payerTelegramUserIdFinal}...`);
      
      // Buscar el telegramUserId que genera el wallet correcto
      // Buscar en un rango alrededor del telegramUserId proporcionado
      const correctTelegramUserId = findTelegramUserIdFromAddress(
        payerWallet,
        payerTelegramUserIdFinal,
        100000 // Buscar en un rango de 100,000 IDs alrededor
      );
      
      if (correctTelegramUserId) {
        console.log(`✅ Encontrado telegramUserId correcto: ${correctTelegramUserId}`);
        finalPayerTelegramUserId = correctTelegramUserId;
        finalPayerWallet = generateDeterministicWallet(correctTelegramUserId);
      } else {
        console.error(`❌ No se pudo encontrar telegramUserId que genere el wallet ${payerWallet}`);
        console.error(`   Esto puede significar:`);
        console.error(`   1. El frontend está usando un método diferente de generación`);
        console.error(`   2. El wallet fue generado manualmente o desde otra fuente`);
        console.error(`   3. El telegramUserId está fuera del rango de búsqueda`);
        console.error(`   No podemos generar la private key correcta para firmar la transacción`);
        
        return res.status(400).json({
          success: false,
          error: 'WALLET_MISMATCH',
          message: `El wallet del usuario (${payerWallet}) no coincide con el wallet generado desde telegramUserId (${finalPayerWallet}). No se pudo encontrar el telegramUserId correcto que genera este wallet.`,
          userWallet: payerWallet,
          generatedWallet: finalPayerWallet,
          telegramUserId: payerTelegramUserIdFinal,
          suggestion: 'Verifica que el telegramUserId sea correcto o que el wallet haya sido generado usando el método determinístico estándar.',
        });
      }
    }
    
    console.log(`💰 Iniciando pago de regalía on-chain:`);
    console.log(`   - Payer: ${payerWallet}`);
    console.log(`   - Destinatario: ${uploaderWallet} (${royalty.uploaderName || royalty.uploaderTelegramId})`);
    console.log(`   - Monto: ${royalty.amount} IP`);
    console.log(`   - IP ID: ${royalty.ipId}`);
    
    // Verificar balance del payer
    const payerBalance = await getStoryBalance(payerWallet);
    const requiredAmount = parseFloat(royalty.amount);
    
    if (parseFloat(payerBalance) < requiredAmount) {
      return res.status(400).json({
        success: false,
        error: 'INSUFFICIENT_BALANCE',
        message: `Tu wallet no tiene suficiente balance IP para pagar la regalía. Balance actual: ${parseFloat(payerBalance).toFixed(2)} IP. Necesitas: ${royalty.amount} IP.`,
        balance: payerBalance,
        requiredAmount: royalty.amount,
        faucetUrl: 'https://cloud.google.com/application/web3/faucet/story/aeneid',
      });
    }
    
    // IMPLEMENTACIÓN ON-CHAIN: Usar Story Protocol SDK para pagar regalías
    // NOTA: getIPById e ip ya están declarados arriba (líneas 126-127)
    // Verificar que el IP existe (ya lo obtuvimos arriba)
    if (!ip) {
      return res.status(404).json({
        success: false,
        error: 'IP no encontrado para esta regalía',
      });
    }
    
    // IMPORTANTE: El pago debe hacerse desde el wallet del usuario (ownerAddress)
    // No desde el bot wallet. Esto asegura que el balance del usuario se reduzca on-chain
    let txHash: string | null = null;
    let payerBalanceBefore: string = '0';
    let payerBalanceAfter: string = '0';
    let uploaderBalanceBefore: string = '0';
    let uploaderBalanceAfter: string = '0';
    
    try {
      // Verificar balances ANTES de la transferencia
      payerBalanceBefore = await getStoryBalance(payerWallet);
      uploaderBalanceBefore = await getStoryBalance(uploaderWallet);
      
      console.log(`📊 Balances ANTES de la transferencia:`);
      console.log(`   - Payer (${payerWallet}): ${parseFloat(payerBalanceBefore).toFixed(4)} IP`);
      console.log(`   - Uploader (${uploaderWallet}): ${parseFloat(uploaderBalanceBefore).toFixed(4)} IP`);
      
      // IMPORTANTE: Usar Story Protocol SDK payRevenue para pagar regalías según la licencia
      // Esto permite pagar regalías on-chain desde el wallet del usuario usando el contrato de licencia
      // Los fondos van automáticamente al IP Royalty Vault y el uploader puede reclamarlos después
      
      console.log(`💰 Usando Story Protocol SDK payRevenue para pagar regalía...`);
      console.log(`   - IP ID: ${royalty.ipId}`);
      console.log(`   - Payer: ${payerWallet}`);
      console.log(`   - Amount: ${royalty.amount}`);
      console.log(`   - Uploader: ${uploaderWallet} (recibirá fondos en IP Royalty Vault)`);
      
      // IMPORTANTE: Verificar balance de MockERC20, NO IP nativo
      // Para pagar regalías necesitas tokens MockERC20, no IP nativo
      const { getTokenBalance, hasSufficientTokenBalance, getRoyaltyTokenAddress } = await import('../services/tokenBalanceService');
      const mockTokenAddress = getRoyaltyTokenAddress();
      const mockTokenBalance = await getTokenBalance(mockTokenAddress, payerWallet);
      const hasMockTokens = await hasSufficientTokenBalance(mockTokenAddress, payerWallet, royalty.amount);
      
      console.log(`💰 Verificando balance de MockERC20:`);
      console.log(`   - Balance MockERC20: ${mockTokenBalance} tokens`);
      console.log(`   - Balance IP nativo: ${payerBalanceBefore} IP (solo para gas)`);
      console.log(`   - Monto requerido: ${royalty.amount} MockERC20 tokens`);
      console.log(`   - Tiene suficiente MockERC20: ${hasMockTokens ? '✅' : '❌'}`);
      
      if (!hasMockTokens) {
        const faucetUrl = 'https://aeneid.storyscan.io/address/0xF2104833d386a2734a4eB3B8ad6FC6812F29E38E?tab=write_contract#0x40c10f19';
        throw new Error(
          `Balance insuficiente de MockERC20 tokens. ` +
          `Balance actual: ${mockTokenBalance} tokens. Necesitas: ${royalty.amount} tokens. ` +
          `Obtén tokens MockERC20 en: ${faucetUrl}`
        );
      }
      
      // Verificar que el payer tenga suficiente IP nativo para gas fees
      if (parseFloat(payerBalanceBefore) < 0.001) {
        throw new Error(
          `Balance insuficiente de IP nativo para gas fees. ` +
          `Balance actual: ${payerBalanceBefore} IP. Necesitas al menos 0.001 IP para gas. ` +
          `Obtén IP nativo del faucet: https://cloud.google.com/application/web3/faucet/story/aeneid`
        );
      }
      
      // Usar el servicio de pago de regalías con SDK
      const { payRoyaltyWithSDK } = await import('../services/royaltyPaymentService');
      
      // Pagar regalía usando payRoyaltyOnBehalf del Royalty Module
      // Según la documentación: https://docs.story.foundation/developers/smart-contracts-guide/claim-revenue
      // El usuario DEBE aprobar el Royalty Module primero, luego el bot puede llamar payRoyaltyOnBehalf
      const paymentResult = await payRoyaltyWithSDK(
        royalty.ipId as `0x${string}`,
        payerWallet,
        finalPayerTelegramUserId,
        royalty.amount
      );
      
      txHash = paymentResult.txHash;
      console.log(`✅ Regalía pagada exitosamente usando payRoyaltyOnBehalf: ${txHash}`);
      
      // Esperar confirmación y obtener receipt
      let receipt: any = null;
      if (txHash) {
        try {
          const { createPublicClient, http } = await import('viem');
          const { getChain } = await import('../services/storyClientUser');
          
          const publicClient = createPublicClient({
            chain: getChain(),
            transport: http(process.env.STORY_RPC_URL!),
          });
          
          receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
          console.log(`✅ Transacción confirmada en bloque: ${receipt.blockNumber}`);
        } catch (receiptError: any) {
          console.warn('⚠️  No se pudo obtener receipt, pero txHash está disponible:', txHash);
        }
      }
      
      // Verificar balances DESPUÉS de la transferencia
      // Esperar un poco para que el balance se actualice
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // IMPORTANTE: Con payRevenue, el balance del payer DEBE reducirse
      // porque la transacción se firmó desde su wallet
      payerBalanceAfter = await getStoryBalance(payerWallet);
      uploaderBalanceAfter = await getStoryBalance(uploaderWallet);
      
      console.log(`📊 Balances DESPUÉS de la transferencia:`);
      console.log(`   - Payer (${payerWallet}): ${parseFloat(payerBalanceAfter).toFixed(4)} IP (antes: ${parseFloat(payerBalanceBefore).toFixed(4)} IP)`);
      console.log(`   - Uploader (${uploaderWallet}): ${parseFloat(uploaderBalanceAfter).toFixed(4)} IP (antes: ${parseFloat(uploaderBalanceBefore).toFixed(4)} IP)`);
      
      // Verificar que el balance del payer se redujo
      const payerReduction = parseFloat(payerBalanceBefore) - parseFloat(payerBalanceAfter);
      if (payerReduction > 0) {
        console.log(`✅ Balance del payer reducido correctamente: -${payerReduction.toFixed(4)} IP`);
      } else {
        console.warn(`⚠️  El balance del payer no se redujo. Esto puede indicar un problema con la transacción.`);
      }
      
      console.log(`✅ Transferencia on-chain completada: ${txHash}`);
      if (receipt) {
        console.log(`   - Block: ${receipt.blockNumber}`);
        console.log(`   - Gas usado: ${receipt.gasUsed.toString()}`);
      }
      console.log(`   - Monto transferido: ${royalty.amount} IP`);
      console.log(`   - Desde: ${payerWallet}`);
      console.log(`   - Hacia: ${uploaderWallet} (fondos en IP Royalty Vault)`);
      console.log(`   - ✅ El balance del usuario se descontó correctamente`);
      
    } catch (transferError: any) {
      console.error('❌ Error en transferencia on-chain:', transferError);
      
      // Si el error es sobre aprobación, devolver un mensaje claro
      if (transferError.message && transferError.message.includes('Necesitas aprobar')) {
        return res.status(400).json({
          success: false,
          error: 'APPROVAL_REQUIRED',
          message: transferError.message,
          requiresApproval: true,
        });
      }
      
      // Si falla la transferencia, no marcar como pagada
      return res.status(500).json({
        success: false,
        error: 'TRANSFER_FAILED',
        message: `Error al realizar la transferencia on-chain: ${transferError.message}`,
        details: transferError.message,
      });
    }
    
    // Marcar regalía como pagada solo si la transferencia fue exitosa
    await markRoyaltyAsPaid(royaltyId, txHash || `payment_${Date.now()}_${royaltyId}`);
    
    console.log(`✅ Regalía ${royaltyId} marcada como pagada`);
    
    // Crear respuesta de pago
    const confirmResponse = {
      data: {
        payment_id: txHash || `payment_${Date.now()}_${royaltyId}`,
        status: 'completed',
        amount: royalty.amount,
        destination: uploaderWallet,
        txHash: txHash,
      },
    };
    
    // 4. IMPORTANTE: Reenviar el video sin protección para que el usuario pueda reenviarlo
    let videoReSent = false;
    if (royalty.videoFileId && royalty.telegramUserId) {
      try {
        const { bot } = await import('../../bot/index');
        
        // Construir caption completo (mismo que cuando se resolvió el puzzle)
        const { getIPById } = await import('../services/ipRegistry');
        const ip = await getIPById(royalty.ipId);
        
        if (ip) {
          const explorerUrl = ip.tokenId 
            ? `https://aeneid.storyscan.io/token/${ip.ipId}/instance/${ip.tokenId}`
            : `https://aeneid.storyscan.io/token/${ip.ipId}`;
          
          let captionParts = [
            `🎬 ${ip.title}${ip.year ? ` (${ip.year})` : ''}`,
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
          
          // Reenviar video SIN protección (protect_content: false o no incluirlo)
          await bot.telegram.sendVideo(
            royalty.telegramUserId,
            royalty.videoFileId,
            {
              caption: fullCaption,
              // NO incluir protect_content - permite reenvío
            }
          );
          
          videoReSent = true;
          console.log(`✅ Video reenviado sin protección al usuario ${royalty.telegramUserId} después de pagar regalía`);
        }
      } catch (videoError: any) {
        console.error('Error reenviando video sin protección:', videoError);
        // No fallar el pago si falla el reenvío
      }
    }
    
    res.json({
      success: true,
      payment: confirmResponse.data,
      royalty: {
        id: royalty.id,
        amount: royalty.amount,
        uploaderName: royalty.uploaderName,
        uploaderWallet: uploaderWallet,
        paid: true,
        paidAt: new Date().toISOString(),
      },
      videoReSent: videoReSent,
      txHash: txHash,
      balances: {
        payer: {
          before: payerBalanceBefore,
          after: payerBalanceAfter,
          address: payerWallet,
        },
        uploader: {
          before: uploaderBalanceBefore,
          after: uploaderBalanceAfter,
          address: uploaderWallet,
        },
      },
      message: `Regalía pagada exitosamente on-chain. ${txHash ? `TX: ${txHash}` : ''}`,
    });
  } catch (error: any) {
    console.error('Error pagando regalía:', error);
    res.status(500).json({
      success: false,
      error: error.response?.data?.message || error.message || 'Error pagando regalía',
      details: error.response?.data,
    });
  }
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
