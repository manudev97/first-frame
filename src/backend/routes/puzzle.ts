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
    
    // CRÍTICO: Validar que los parámetros requeridos estén presentes
    console.log(`🔍 Validando puzzle - Request body:`, {
      puzzleId: puzzleId ? 'presente' : 'faltante',
      hasSolution: !!solution,
      ipId: ipId || 'FALTANTE',
      telegramUserId: telegramUserId || 'FALTANTE',
      posterUrl: posterUrl ? 'presente' : 'faltante',
    });
    
    if (!ipId) {
      console.error(`❌ ERROR CRÍTICO: ipId no está presente en el request`);
      console.error(`   Request completo:`, JSON.stringify(req.body, null, 2));
      return res.status(400).json({
        success: false,
        error: 'ipId es requerido para resolver el puzzle',
        accessGranted: false,
      });
    }
    
    if (!telegramUserId) {
      console.error(`❌ ERROR CRÍTICO: telegramUserId no está presente en el request`);
      console.error(`   Request completo:`, JSON.stringify(req.body, null, 2));
      return res.status(400).json({
        success: false,
        error: 'telegramUserId es requerido para resolver el puzzle',
        accessGranted: false,
      });
    }
    
    // IMPORTANTE: Verificar si el usuario tiene regalías pendientes
    if (telegramUserId) {
      const { hasPendingRoyalties, getPendingRoyaltiesCount } = await import('../services/royaltyService');
      const hasPending = await hasPendingRoyalties(telegramUserId);
      const pendingCount = await getPendingRoyaltiesCount(telegramUserId);
      
      if (hasPending) {
        console.log(`⚠️  Usuario ${telegramUserId} tiene ${pendingCount} regalía(s) pendiente(s). Bloqueando puzzle.`);
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
    
    console.log(`🔍 Validación del puzzle: ${isValid ? '✅ VÁLIDA' : '❌ INVÁLIDA'}`);
    
    if (isValid) {
      // Si el puzzle está resuelto y hay un IP asociado, registrar el póster como derivado
      let derivativeIpId = null;
      let derivativeTxHash = null;
      if (ipId && posterUrl) {
        try {
          // Crear metadata del póster
          // CRÍTICO: Usar API_URL de env o construir desde PORT
          const backendUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
          const posterMetadataResponse = await axios.post(`${backendUrl}/api/ip/create-poster-metadata`, {
            posterUrl,
            parentIpId: ipId,
            title: 'Puzzle Poster',
            year: new Date().getFullYear(),
          });
          
          if (posterMetadataResponse.data.success) {
            const posterMetadata = posterMetadataResponse.data;
            
            // Registrar el póster como IP derivado
            // CRÍTICO: Usar SOLO userDynamicAddress - ya no usar wallet determinística
            const userDynamicAddress = req.body.userDynamicAddress; // Address de Dynamic del usuario
            if (!userDynamicAddress) {
              throw new Error('userDynamicAddress es requerido. Conecta tu wallet de Dynamic primero.');
            }
            
            const derivativeResponse = await axios.post(`${backendUrl}/api/story/register-derivative`, {
              parentIpId: ipId,
              posterMetadata: {
                uri: posterMetadata.metadataUri,
                hash: posterMetadata.metadataHash,
                nftUri: posterMetadata.metadataUri,
                nftHash: posterMetadata.metadataHash,
              },
              userDynamicAddress: userDynamicAddress, // CRÍTICO: SOLO usar Dynamic wallet
            });
            
            if (derivativeResponse.data.success) {
              derivativeIpId = derivativeResponse.data.ipId;
              derivativeTxHash = derivativeResponse.data.txHash;
              // CRÍTICO: También obtener tokenId y contractAddress para construir URL correcta
              const derivativeTokenId = derivativeResponse.data.tokenId;
              const contractAddress = derivativeResponse.data.contractAddress || process.env.STORY_SPG_NFT_CONTRACT;
              console.log(`✅ IP derivado registrado: ${derivativeIpId}${derivativeTokenId ? ` (Token ID: ${derivativeTokenId})` : ''}${contractAddress ? ` (Contract: ${contractAddress})` : ''}`);
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
      
      console.log(`🔍 Iniciando lógica de puzzle para IP ${ipId} y usuario ${telegramUserId}`);
      console.log(`   - ipId recibido: ${ipId} (tipo: ${typeof ipId})`);
      console.log(`   - telegramUserId recibido: ${telegramUserId} (tipo: ${typeof telegramUserId})`);
      
      if (!ipId) {
        console.error(`❌ ERROR CRÍTICO: ipId no está presente en el request`);
        console.error(`   Request body:`, JSON.stringify(req.body, null, 2));
      }
      
      if (!telegramUserId) {
        console.error(`❌ ERROR CRÍTICO: telegramUserId no está presente en el request`);
        console.error(`   Request body:`, JSON.stringify(req.body, null, 2));
      }
      
      if (ipId && telegramUserId) {
        try {
          // 1. Obtener información del IP del registry
          const { getIPById } = await import('../services/ipRegistry');
          const ip = await getIPById(ipId);
          
          console.log(`📊 IP obtenido del registry:`, ip ? {
            ipId: ip.ipId,
            title: ip.title,
            hasVideoFileId: !!ip.videoFileId,
            hasChannelMessageId: !!ip.channelMessageId,
            uploader: ip.uploader,
            videoFileId: ip.videoFileId ? `${ip.videoFileId.substring(0, 20)}...` : 'N/A',
            channelMessageId: ip.channelMessageId || 'N/A',
          } : 'null');
          
          if (!ip) {
            console.error(`❌ ERROR CRÍTICO: IP ${ipId} no encontrado en el registry`);
            console.error(`   Esto significa que el IP no fue guardado correctamente durante el registro`);
          }
          
          // CRÍTICO: Verificar que el IP tenga videoFileId O channelMessageId
          // Si no tiene videoFileId, intentar obtenerlo del canal usando el caption
          if (ip && (ip.videoFileId || ip.channelMessageId)) {
            console.log(`✅ IP tiene video disponible (videoFileId: ${!!ip.videoFileId}, channelMessageId: ${ip.channelMessageId || 'N/A'})`);
            
            // 2. Obtener instancia del bot - CRÍTICO: Verificar que esté disponible
            let bot;
            try {
              const botModule = await import('../../bot/index');
              bot = botModule.bot;
              
              if (!bot) {
                throw new Error('Bot instance is null or undefined');
              }
              
              // Verificar que el bot esté inicializado
              if (!bot.telegram) {
                throw new Error('Bot telegram client is not initialized');
              }
              
              console.log(`✅ Bot instance obtenida y verificada`);
            } catch (botError: any) {
              console.error(`❌ ERROR CRÍTICO: No se pudo obtener o verificar la instancia del bot:`, botError);
              console.error(`   Esto puede significar que el bot no está inicializado correctamente`);
              throw new Error(`Bot no disponible: ${botError.message}`);
            }
            
            // 3. Reenviar video al usuario directamente usando videoFileId o channelMessageId
            // IMPORTANTE: Usar protect_content: true para desactivar reenvío hasta que se pague
            try {
              // Construir caption completo con toda la información del canal
              const explorerUrl = ip.tokenId 
                ? `https://aeneid.storyscan.io/token/${ip.ipId}/instance/${ip.tokenId}`
                : `https://aeneid.storyscan.io/token/${ip.ipId}`;
              
              // CRÍTICO: Obtener address del dueño para mostrar en el caption
              // Intentar obtener desde Dynamic si está disponible, sino usar wallet determinístico
              let ownerAddress = '';
              try {
                const uploaderMatch = ip.uploader?.match(/TelegramUser_(\d+)/);
                if (uploaderMatch) {
                  const uploaderTelegramId = parseInt(uploaderMatch[1]);
                  
                  // TODO: Intentar obtener address desde Dynamic si el uploader tiene wallet conectada
                  // Por ahora, usar wallet determinístico como fallback
                  const { generateDeterministicAddress } = await import('../services/deterministicWalletService');
                  ownerAddress = generateDeterministicAddress(uploaderTelegramId);
                  console.log(`✅ Address del dueño obtenida: ${ownerAddress.substring(0, 8)}...${ownerAddress.substring(36)}`);
                }
              } catch (addressError) {
                console.warn('No se pudo obtener address del dueño:', addressError);
              }
              
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
                `💳 Regalía pendiente: 0.1 IP`,
              );
              
              // CRÍTICO: Agregar address del dueño si está disponible
              if (ownerAddress) {
                captionParts.push(`👤 Dueño: ${ownerAddress.substring(0, 8)}...${ownerAddress.substring(36)}`);
                captionParts.push(`💼 Paga con Dynamic usando esta address`);
              }
              
              captionParts.push(`💳 Usa el comando /profile en el bot para pagar tus regalías pendientes.`);
              
              const fullCaption = captionParts.join('\n');
              
              // CRÍTICO: Usar videoFileId si está disponible, sino usar channelMessageId para reenviar
              if (ip.videoFileId) {
                try {
                  console.log(`📤 Intentando enviar video usando videoFileId: ${ip.videoFileId.substring(0, 20)}...`);
                  console.log(`   - Usuario: ${telegramUserId}`);
                  console.log(`   - Caption length: ${fullCaption.length} caracteres`);
                  
                  await bot.telegram.sendVideo(
                    telegramUserId,
                    ip.videoFileId,
                    {
                      caption: fullCaption,
                      protect_content: true, // IMPORTANTE: Desactiva reenvío hasta que se pague
                    }
                  );
                  
                  videoForwarded = true;
                  console.log(`✅ Video enviado exitosamente al usuario ${telegramUserId} para IP ${ipId} usando videoFileId (con protección de contenido)`);
                } catch (sendError: any) {
                  console.error(`❌ Error enviando video con videoFileId:`, sendError);
                  console.error(`   - Error code: ${sendError.response?.error_code || 'N/A'}`);
                  console.error(`   - Error message: ${sendError.message || 'N/A'}`);
                  console.error(`   - Intentando método alternativo con channelMessageId...`);
                  
                  // Intentar método alternativo si falla sendVideo
                  if (ip.channelMessageId) {
                    throw sendError; // Re-lanzar para que se maneje en el bloque else if
                  } else {
                    throw new Error(`No se pudo enviar video: ${sendError.message}. No hay channelMessageId como alternativa.`);
                  }
                }
              } else if (ip.channelMessageId) {
                // CRÍTICO: Reenviar desde el canal usando channelMessageId
                const channelId = process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_CHANNEL_LINK;
                // Formatear channelId correctamente si es necesario (declarar fuera del try para usar en catch)
                let finalChannelId: string | number = channelId || '';
                if (channelId) {
                  try {
                    // Formatear channelId correctamente si es necesario
                    finalChannelId = channelId;
                    if (/^-?\d+$/.test(channelId.trim())) {
                      const numericId = channelId.trim();
                      if (!numericId.startsWith('-')) {
                        finalChannelId = `-100${numericId}`;
                        console.log(`✅ Channel ID formateado: ${finalChannelId}`);
                      } else {
                        finalChannelId = numericId;
                      }
                    }
                    
                    console.log(`📤 Intentando reenviar video desde canal usando forwardMessage`);
                    console.log(`   - Channel ID: ${finalChannelId}`);
                    console.log(`   - Message ID: ${ip.channelMessageId}`);
                    console.log(`   - Usuario: ${telegramUserId}`);
                    
                    // CRÍTICO: Intentar obtener el video del mensaje del canal primero
                    // Si tenemos channelMessageId, podemos usar copyMessage o forwardMessage
                    // forwardMessage es más confiable para mantener el video original
                    await bot.telegram.forwardMessage(
                      telegramUserId,
                      finalChannelId,
                      ip.channelMessageId
                    );
                    
                    console.log(`✅ Video reenviado exitosamente desde canal`);
                    
                    // CRÍTICO: Enviar mensaje con información de regalía y caption completo
                    const infoMessage = fullCaption + `\n\n⚠️ Este video está protegido. Debes pagar la regalía (0.1 IP) para poder reenviarlo.\n\n💳 Usa el comando /profile en el bot para pagar tus regalías pendientes.`;
                    
                    console.log(`📤 Enviando mensaje informativo sobre regalía`);
                    await bot.telegram.sendMessage(
                      telegramUserId,
                      infoMessage
                    );
                    
                    videoForwarded = true;
                    console.log(`✅ Video y mensaje enviados exitosamente al usuario ${telegramUserId} para IP ${ipId} desde canal (messageId: ${ip.channelMessageId})`);
                  } catch (forwardError: any) {
                    console.error(`❌ Error reenviando desde canal:`, forwardError);
                    console.error(`   Detalles del error:`, {
                      channelId: finalChannelId,
                      messageId: ip.channelMessageId,
                      userId: telegramUserId,
                      errorMessage: forwardError.message,
                      errorCode: forwardError.response?.error_code,
                      errorDescription: forwardError.response?.description,
                    });
                    
                    // CRÍTICO: Si forwardMessage falla, intentar obtener el videoFileId del mensaje del canal
                    // y usar sendVideo como último recurso
                    try {
                      console.log(`🔄 Intentando método alternativo: obtener videoFileId del mensaje del canal...`);
                      const channelMessage = await bot.telegram.getChat(finalChannelId);
                      // NOTA: Telegram Bot API no permite obtener mensajes de canales directamente
                      // Por lo tanto, debemos confiar en que el videoFileId esté guardado en el registry
                      console.warn(`⚠️  No se puede obtener videoFileId del canal directamente. El videoFileId debe estar guardado en el registry.`);
                      throw forwardError; // Re-lanzar el error original
                    } catch (altError: any) {
                      console.error(`❌ Método alternativo también falló:`, altError.message);
                      // No fallar el puzzle completamente, pero indicar que el video no se pudo enviar
                      console.error(`⚠️  El puzzle se completó pero el video NO se pudo enviar. El usuario debe contactar al soporte.`);
                    }
                  }
                } else {
                  console.error(`❌ ERROR CRÍTICO: TELEGRAM_CHANNEL_ID no configurado`);
                  console.error(`   No se puede reenviar video sin el ID del canal`);
                  console.error(`   Variables de entorno disponibles:`, {
                    hasChannelId: !!process.env.TELEGRAM_CHANNEL_ID,
                    hasChannelLink: !!process.env.TELEGRAM_CHANNEL_LINK,
                  });
                }
              } else {
                console.warn(`⚠️  No se puede reenviar video: IP ${ipId} no tiene videoFileId ni channelMessageId`);
              }
            } catch (forwardError: any) {
              console.error(`❌ Error reenviando video al usuario ${telegramUserId}:`, forwardError);
              console.error(`   Detalles:`, {
                hasVideoFileId: !!ip.videoFileId,
                hasChannelMessageId: !!ip.channelMessageId,
                errorMessage: forwardError.message,
              });
              // Continuar aunque falle el reenvío
            }
            
            // 4. Crear regalía pendiente (SIEMPRE después de enviar el video)
            if (ip.uploader) {
              try {
                const { createPendingRoyalty } = await import('../services/royaltyService');
                
                // Extraer uploaderTelegramId del formato "TelegramUser_123456"
                const uploaderMatch = ip.uploader.match(/TelegramUser_(\d+)/);
                const uploaderTelegramId = uploaderMatch ? parseInt(uploaderMatch[1]) : 0;
                
                if (!uploaderTelegramId) {
                  console.warn(`⚠️  No se pudo extraer uploaderTelegramId de: ${ip.uploader}`);
                }
                
                // Usar uploaderName del registry si está disponible
                const uploaderName = ip.uploaderName;
                
                console.log(`💰 Creando regalía pendiente de 0.1 IP para usuario ${telegramUserId}`);
                console.log(`   - IP: ${ipId} (${ip.title})`);
                console.log(`   - Uploader: ${uploaderTelegramId} (${uploaderName || 'Sin nombre'})`);
                console.log(`   - VideoFileId: ${ip.videoFileId || 'N/A'}`);
                console.log(`   - ChannelMessageId: ${ip.channelMessageId || 'N/A'}`);
                
                const royalty = await createPendingRoyalty(
                  telegramUserId,
                  ipId,
                  ip.title || 'Video sin título',
                  '0.1', // Monto fijo de regalía (0.1 IP)
                  uploaderTelegramId,
                  uploaderName, // Usar nombre del registry
                  ip.tokenId,
                  ip.channelMessageId,
                  ip.videoFileId
                );
                
                royaltyId = royalty.id;
                royaltyCreated = true;
                console.log(`✅ Regalía pendiente creada exitosamente: ${royaltyId} para usuario ${telegramUserId}`);
                console.log(`💡 El usuario debe pagar la regalía de 0.1 IP desde la mini-app para poder reenviar el video`);
              } catch (royaltyError: any) {
                console.error(`❌ Error creando regalía pendiente:`, royaltyError);
                console.error(`   Detalles:`, {
                  telegramUserId,
                  ipId,
                  uploader: ip.uploader,
                  error: royaltyError.message,
                });
                // No fallar el puzzle si falla la creación de regalía, pero loguear el error
              }
            } else {
              console.warn(`⚠️  No se puede crear regalía: IP ${ipId} no tiene uploader`);
            }
          } else {
            console.warn(`⚠️  No se puede enviar video: IP ${ipId} no tiene videoFileId ni channelMessageId`);
            console.warn(`   IP encontrado:`, ip ? {
              ipId: ip.ipId,
              title: ip.title,
              hasVideoFileId: !!ip.videoFileId,
              hasChannelMessageId: !!ip.channelMessageId,
              uploader: ip.uploader,
            } : 'null');
            console.warn(`   💡 Asegúrate de que el video fue reenviado al canal después del registro del IP`);
          }
        } catch (error: any) {
          console.error('❌ Error en lógica de puzzle (envío de video y regalía):', error);
          console.error('   Detalles:', {
            ipId,
            telegramUserId,
            errorMessage: error.message,
            stack: error.stack,
          });
          // No fallar el puzzle si hay error en el reenvío, pero loguear el error
        }
      } else {
        console.warn(`⚠️  No se puede procesar puzzle: falta ipId (${ipId}) o telegramUserId (${telegramUserId})`);
      }
      
      // CRÍTICO: Obtener tokenId y contractAddress del derivado para construir URL correcta
      let derivativeTokenId: string | null = null;
      let contractAddress: string | null = null;
      if (derivativeIpId) {
        try {
          // Intentar obtener tokenId desde la transacción del derivado
          const { getIPDetailsFromTransaction } = await import('../services/txParser');
          if (derivativeTxHash) {
            const spgNftContract = process.env.STORY_SPG_NFT_CONTRACT as `0x${string}`;
            contractAddress = spgNftContract; // CRÍTICO: Usar contract address para la URL
            const ipDetails = await getIPDetailsFromTransaction(
              derivativeTxHash as `0x${string}`,
              spgNftContract
            );
            if (ipDetails && ipDetails.tokenId) {
              derivativeTokenId = ipDetails.tokenId.toString();
              console.log(`✅ Token ID del derivado obtenido: ${derivativeTokenId}`);
              console.log(`✅ Contract Address: ${contractAddress}`);
            }
          }
        } catch (tokenError) {
          console.warn('No se pudo obtener tokenId del derivado:', tokenError);
        }
      }
      
      res.json({
        success: true,
        message: '¡Puzzle completado correctamente!',
        accessGranted: true,
        derivativeIpId: derivativeIpId,
        derivativeTokenId: derivativeTokenId, // CRÍTICO: Token ID para construir URL
        derivativeContractAddress: contractAddress, // CRÍTICO: Contract address para construir URL
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

