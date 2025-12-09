import { Router } from 'express';
import { createPuzzle, validatePuzzleSolution } from '../services/puzzleService';
import axios from 'axios';

const router = Router();

// Crear rompecabezas desde una imagen
router.post('/create', async (req, res) => {
  try {
    const { imageUrl, difficulty = 3 } = req.body;
    
    const puzzle = await createPuzzle(imageUrl, difficulty);
    
    res.json({
      success: true,
      puzzleId: puzzle.id,
      pieces: puzzle.pieces,
      solution: puzzle.solution,
    });
  } catch (error: any) {
    console.error('Error creando puzzle:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Validar solución del puzzle
router.post('/validate', async (req, res) => {
  try {
    const { puzzleId, solution, ipId, posterUrl, telegramUserId } = req.body;
    
    // IMPORTANTE: Verificar si el usuario tiene regalías pendientes
    if (telegramUserId) {
      const { hasPendingRoyalties, getPendingRoyaltiesCount } = await import('../services/royaltyService');
      const hasPending = await hasPendingRoyalties(telegramUserId);
      const pendingCount = await getPendingRoyaltiesCount(telegramUserId);
      
      if (hasPending) {
        return res.json({
          success: false,
          message: `⚠️ Tienes ${pendingCount} regalía${pendingCount > 1 ? 's' : ''} pendiente${pendingCount > 1 ? 's' : ''}. Debes pagar tus regalías antes de resolver más puzzles.`,
          accessGranted: false,
          hasPendingRoyalties: true,
          pendingCount,
        });
      }
    }
    
    const isValid = await validatePuzzleSolution(puzzleId, solution);
    
    if (isValid) {
      // Si el puzzle está resuelto y hay un IP asociado, registrar el póster como derivado
      let derivativeIpId = null;
      let derivativeTxHash = null;
      if (ipId && posterUrl) {
        try {
          // Crear metadata del póster
          const backendUrl = `http://localhost:${process.env.PORT || 3001}`;
          const posterMetadataResponse = await axios.post(`${backendUrl}/api/ip/create-poster-metadata`, {
            posterUrl,
            parentIpId: ipId,
            title: 'Puzzle Poster',
            year: new Date().getFullYear(),
          });
          
          if (posterMetadataResponse.data.success) {
            const posterMetadata = posterMetadataResponse.data;
            
            // Registrar el póster como IP derivado
            // IMPORTANTE: Enviar userTelegramId para que el token vaya al wallet del usuario
            const derivativeResponse = await axios.post(`${backendUrl}/api/story/register-derivative`, {
              parentIpId: ipId,
              posterMetadata: {
                uri: posterMetadata.metadataUri,
                hash: posterMetadata.metadataHash,
                nftUri: posterMetadata.metadataUri,
                nftHash: posterMetadata.metadataHash,
              },
              userTelegramId: telegramUserId, // IMPORTANTE: Para enviar el token al wallet del usuario
            });
            
            if (derivativeResponse.data.success) {
              derivativeIpId = derivativeResponse.data.ipId;
              derivativeTxHash = derivativeResponse.data.txHash;
            }
          }
        } catch (derivativeError) {
          console.warn('No se pudo registrar el póster como derivado:', derivativeError);
          // No fallar el puzzle si no se puede registrar el derivado
        }
      }
      
      // Registrar completación del puzzle
      if (telegramUserId && ipId) {
        try {
          const { recordPuzzleCompletion } = await import('../services/puzzleTrackingService');
          // Obtener tiempo del puzzle (si está disponible en el request)
          const puzzleTime = req.body.puzzleTimeSeconds || 0;
          await recordPuzzleCompletion(telegramUserId, ipId, puzzleId, puzzleTime);
          console.log(`✅ Puzzle completado registrado para usuario ${telegramUserId}`);
        } catch (trackingError: any) {
          console.warn('No se pudo registrar completación del puzzle:', trackingError.message);
        }
      }
      
      // NUEVA LÓGICA: Buscar video en el canal y reenviarlo al usuario
      let videoForwarded = false;
      let royaltyCreated = false;
      let royaltyId: string | null = null;
      
      if (ipId && telegramUserId) {
        try {
          // 1. Obtener información del IP del registry
          const { getIPById } = await import('../services/ipRegistry');
          const ip = await getIPById(ipId);
          
          if (ip && ip.videoFileId) {
            // 2. Obtener instancia del bot
            const { bot } = await import('../../bot/index');
            
            // 3. Reenviar video al usuario directamente usando videoFileId
            // IMPORTANTE: Usar protect_content: true para desactivar reenvío hasta que se pague
            try {
              // Construir caption completo con toda la información del canal
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
                `⚠️ Este video está protegido. Debes pagar la regalía (0.1 IP) para poder reenviarlo.`,
                `💳 Usa el comando /profile en el bot para pagar tus regalías pendientes.`
              );
              
              const fullCaption = captionParts.join('\n');
              
              await bot.telegram.sendVideo(
                telegramUserId,
                ip.videoFileId,
                {
                  caption: fullCaption,
                  protect_content: true, // IMPORTANTE: Desactiva reenvío hasta que se pague
                }
              );
              videoForwarded = true;
              console.log(`✅ Video reenviado al usuario ${telegramUserId} para IP ${ipId} (con protección de contenido)`);
            } catch (forwardError: any) {
              console.error(`❌ Error reenviando video al usuario ${telegramUserId}:`, forwardError);
              // Continuar aunque falle el reenvío
            }
            
            // 4. Crear regalía pendiente
            if (ip.uploader) {
              const { createPendingRoyalty } = await import('../services/royaltyService');
              
              // Extraer uploaderTelegramId del formato "TelegramUser_123456"
              const uploaderMatch = ip.uploader.match(/TelegramUser_(\d+)/);
              const uploaderTelegramId = uploaderMatch ? parseInt(uploaderMatch[1]) : 0;
              
              // Usar uploaderName del registry si está disponible
              const uploaderName = ip.uploaderName;
              
              const royalty = await createPendingRoyalty(
                telegramUserId,
                ipId,
                ip.title,
                '0.1', // Monto fijo de regalía (0.1 IP)
                uploaderTelegramId,
                uploaderName, // Usar nombre del registry
                ip.tokenId,
                ip.channelMessageId,
                ip.videoFileId
              );
              
              royaltyId = royalty.id;
              royaltyCreated = true;
              console.log(`✅ Regalía pendiente creada: ${royaltyId} para usuario ${telegramUserId}`);
              console.log(`💡 El usuario debe pagar la regalía desde la mini-app para poder reenviar el video`);
            }
          } else {
            console.warn(`⚠️  No se encontró videoFileId para IP ${ipId} en el registry`);
          }
        } catch (error: any) {
          console.error('Error en nueva lógica de puzzle:', error);
          // No fallar el puzzle si hay error en el reenvío
        }
      }
      
      res.json({
        success: true,
        message: '¡Puzzle completado correctamente!',
        accessGranted: true,
        derivativeIpId: derivativeIpId,
        derivativeTxHash: derivativeTxHash,
        videoForwarded: videoForwarded,
        royaltyCreated: royaltyCreated,
        royaltyId: royaltyId,
      });
    } else {
      res.json({
        success: false,
        message: 'Solución incorrecta. Intenta de nuevo.',
        accessGranted: false,
      });
    }
  } catch (error: any) {
    console.error('Error validando puzzle:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener estadísticas del puzzle
router.get('/stats/:puzzleId', async (req, res) => {
  try {
    const { puzzleId } = req.params;
    
    // Aquí podrías obtener estadísticas de la base de datos
    res.json({
      success: true,
      stats: {
        totalAttempts: 0,
        completedCount: 0,
        fastestTime: null,
      },
    });
  } catch (error: any) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as puzzleRouter };

