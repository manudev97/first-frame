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
      
      // CRÍTICO: SIEMPRE ejecutar lógica de envío del video si el puzzle es válido
      // NUEVA LÓGICA: Buscar video en el canal y reenviarlo al usuario
      let videoForwarded = false;
      let royaltyCreated = false;
      let royaltyId: string | null = null;
      
      console.log(`🔍 Iniciando lógica de puzzle para IP ${ipId} y usuario ${telegramUserId}`);
      console.log(`   - ipId recibido: ${ipId} (tipo: ${typeof ipId})`);
      console.log(`   - telegramUserId recibido: ${telegramUserId} (tipo: ${typeof telegramUserId})`);
      console.log(`   - tokenId recibido: ${req.body.tokenId || 'N/A'} (tipo: ${typeof req.body.tokenId})`);
      console.log(`   - title recibido: ${req.body.title || 'N/A'} (tipo: ${typeof req.body.title})`);
      console.log(`   - Request body completo:`, JSON.stringify(req.body, null, 2));
      
      // CRÍTICO: Verificar que ipId y telegramUserId estén presentes antes de continuar
      if (!ipId || !telegramUserId) {
        console.error(`❌ ERROR CRÍTICO: ipId o telegramUserId no están presentes en el request`);
        console.error(`   - ipId: ${ipId || 'FALTANTE'}`);
        console.error(`   - telegramUserId: ${telegramUserId || 'FALTANTE'}`);
        console.error(`   Request body:`, JSON.stringify(req.body, null, 2));
        // Continuar de todas formas para intentar enviar el video si es posible
      }
      
      // CRÍTICO: Ejecutar lógica de envío del video SIEMPRE que el puzzle sea válido
      // No requiere que ipId y telegramUserId estén presentes (pueden ser undefined)
      if (ipId && telegramUserId) {
        try {
          // 1. Obtener información del IP del registry
          // CRÍTICO: PRIORIZAR búsqueda por tokenId si está disponible (más preciso que ipId)
          // El ipId puede ser el contrato SPG NFT, por lo que tokenId es la clave única correcta
          const { getIPById, loadRegisteredIPs } = await import('../services/ipRegistry');
          let ip: any = null;
          let correctIpId = ipId; // Variable para almacenar el IP ID correcto
          
          // PRIORIDAD 1: Buscar por tokenId (MÁS PRECISO - clave única)
          const tokenId = req.body.tokenId; // TokenId puede venir en el request
          const requestTitle = req.body.title; // Título del request (más confiable que el del registry)
          
          // CRÍTICO: Obtener instancia del bot ANTES de usarla
          let bot;
          try {
            const botModule = await import('../../bot/index');
            bot = botModule.bot;
            
            if (!bot) {
              throw new Error('Bot instance is null or undefined');
            }
            
            if (!bot.telegram) {
              throw new Error('Bot telegram client is not initialized');
            }
          } catch (botError: any) {
            console.error(`❌ ERROR CRÍTICO: No se pudo obtener la instancia del bot:`, botError);
            bot = null;
          }
          
          // CRÍTICO: Usar función mejorada que busca por tokenId o título
          const { findVideoInChannelByTokenIdOrTitle } = await import('../services/channelVideoService');
          const channelId = process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_CHANNEL_LINK;
          
          if ((tokenId || requestTitle) && bot) {
            console.log(`🔍 Buscando video en canal por tokenId: ${tokenId || 'N/A'}, título: ${requestTitle || 'N/A'}`);
            const videoResult = await findVideoInChannelByTokenIdOrTitle(
              bot,
              channelId || '',
              tokenId?.toString(),
              requestTitle,
              ipId
            );
            
            if (videoResult) {
              // CRÍTICO: Si encontramos el video, buscar el IP completo en el registry
              // PERO usar el tokenId del request (más preciso) para asegurar que es el IP correcto
              const { getIPByTokenId, loadRegisteredIPs } = await import('../services/ipRegistry');
              
              // PRIORIDAD: Buscar por tokenId del REQUEST (más preciso que el del video encontrado)
              if (tokenId) {
                ip = await getIPByTokenId(tokenId.toString());
                if (ip) {
                  console.log(`✅ IP encontrado por tokenId del REQUEST ${tokenId}: ${ip.title} (Token ID: ${ip.tokenId})`);
                  // CRÍTICO: Actualizar con información del video encontrado
                  if (videoResult.fileId) {
                    ip.videoFileId = videoResult.fileId;
                  }
                  if (videoResult.messageId) {
                    ip.channelMessageId = videoResult.messageId;
                  }
                  // CRÍTICO: Asegurar que el tokenId del IP coincida con el del request
                  if (ip.tokenId !== tokenId.toString()) {
                    console.warn(`⚠️  TokenId del IP (${ip.tokenId}) no coincide con el del request (${tokenId}). Actualizando...`);
                    ip.tokenId = tokenId.toString();
                  }
                  correctIpId = ip.ipId;
                }
              }
              
              // Si no encontramos por tokenId del request, buscar por ipId del video encontrado
              if (!ip && videoResult.ipId) {
                ip = await getIPById(videoResult.ipId);
                if (ip) {
                  console.log(`✅ IP encontrado por ipId del video: ${ip.title} (Token ID: ${ip.tokenId || 'N/A'})`);
                  // CRÍTICO: Actualizar tokenId si el request tiene uno más preciso
                  if (tokenId && ip.tokenId !== tokenId.toString()) {
                    console.warn(`⚠️  Actualizando tokenId del IP de ${ip.tokenId} a ${tokenId} (del request)`);
                    ip.tokenId = tokenId.toString();
                  }
                  // Actualizar con información del video
                  if (videoResult.fileId) {
                    ip.videoFileId = videoResult.fileId;
                  }
                  if (videoResult.messageId) {
                    ip.channelMessageId = videoResult.messageId;
                  }
                  correctIpId = ip.ipId;
                }
              }
              
              // Si aún no encontramos, crear un objeto IP mínimo con la información del video y el request
              if (!ip && videoResult.fileId) {
                console.log(`⚠️  IP no encontrado en registry, pero video encontrado. Creando objeto IP mínimo.`);
                ip = {
                  ipId: videoResult.ipId || ipId,
                  tokenId: tokenId?.toString(), // CRÍTICO: Usar tokenId del request
                  title: requestTitle || 'Video sin título',
                  videoFileId: videoResult.fileId,
                  channelMessageId: videoResult.messageId || undefined,
                };
                correctIpId = videoResult.ipId || ipId;
                console.log(`✅ Video encontrado en canal (IP mínimo creado): ${ip.title} (Token ID: ${ip.tokenId || 'N/A'})`);
              }
            }
          }
          
          // PRIORIDAD 2: Si aún no encontramos, buscar en el registry de forma tradicional
          if (!ip) {
            if (tokenId) {
              console.log(`🔍 Buscando IP por tokenId en registry: ${tokenId} (PRIORIDAD ALTA)`);
              const { getIPByTokenId } = await import('../services/ipRegistry');
              ip = await getIPByTokenId(tokenId.toString());
              if (ip) {
                console.log(`✅ IP encontrado por tokenId ${tokenId}: ${ip.title} (IP ID: ${ip.ipId}, Token ID: ${ip.tokenId})`);
                correctIpId = ip.ipId;
              } else {
                console.warn(`⚠️  No se encontró IP con tokenId ${tokenId} en el registry`);
              }
            }
            
            // PRIORIDAD 3: Buscar por título del REQUEST
            if (!ip && requestTitle) {
              console.log(`🔍 Buscando IP por título del REQUEST: "${requestTitle}" (PRIORIDAD ALTA)`);
              const allIPs = await loadRegisteredIPs();
              const matchingIPs = allIPs.filter((i) => {
                const titleMatch = i.title?.toLowerCase().trim() === requestTitle.toLowerCase().trim() ||
                                   i.title?.toLowerCase().trim().includes(requestTitle.toLowerCase().trim()) ||
                                   requestTitle.toLowerCase().trim().includes(i.title?.toLowerCase().trim() || '');
                return titleMatch;
              });
              
              if (matchingIPs.length > 0) {
                if (tokenId) {
                  const tokenMatch = matchingIPs.find((i) => 
                    i.tokenId === tokenId.toString() || 
                    i.tokenId === tokenId ||
                    (i.tokenId && i.tokenId.toString() === tokenId.toString())
                  );
                  if (tokenMatch) {
                    ip = tokenMatch;
                    console.log(`✅ IP encontrado por título y tokenId "${requestTitle}" (tokenId: ${tokenId}): ${ip.title}`);
                    correctIpId = ip.ipId;
                  }
                }
                if (!ip) {
                  ip = matchingIPs.find((i) => i.videoFileId || i.channelMessageId) || matchingIPs[0];
                  if (ip) {
                    console.log(`✅ IP encontrado por título "${requestTitle}": ${ip.title} (Token ID: ${ip.tokenId || 'N/A'})`);
                    correctIpId = ip.ipId;
                  }
                }
              }
            }
            
            // PRIORIDAD 4: Buscar por ipId (último recurso)
            if (!ip) {
              console.log(`🔍 Buscando IP por ipId: ${ipId} (ÚLTIMO RECURSO)`);
              ip = await getIPById(ipId);
              if (ip) {
                console.log(`✅ IP encontrado por ipId: ${ip.title} (Token ID: ${ip.tokenId || 'N/A'})`);
                correctIpId = ip.ipId;
              }
            }
          }
          
          console.log(`📊 IP obtenido del registry:`, ip ? {
            ipId: ip.ipId,
            correctIpId: correctIpId,
            title: ip.title,
            tokenId: ip.tokenId || 'N/A',
            hasVideoFileId: !!ip.videoFileId,
            hasChannelMessageId: !!ip.channelMessageId,
            uploader: ip.uploader,
            videoFileId: ip.videoFileId ? `${ip.videoFileId.substring(0, 20)}...` : 'N/A',
            channelMessageId: ip.channelMessageId || 'N/A',
          } : 'null');
          
          if (!ip) {
            console.error(`❌ ERROR CRÍTICO: IP no encontrado en el registry`);
            console.error(`   - ipId buscado: ${req.body.ipId}`);
            console.error(`   - tokenId buscado: ${req.body.tokenId || 'N/A'}`);
            console.error(`   - título buscado: ${req.body.title || 'N/A'}`);
            console.error(`   Esto significa que el IP no fue guardado correctamente durante el registro`);
            return res.json({
              success: true,
              message: '¡Puzzle completado correctamente!',
              accessGranted: true,
              videoForwarded: false,
              royaltyCreated: false,
              error: 'IP no encontrado en registry. El video no se pudo enviar.',
            });
          }
          
          // CRÍTICO: Usar el IP ID correcto para todas las operaciones posteriores
          const finalIpId = correctIpId;
          
          // CRÍTICO: Verificar que el IP tenga videoFileId O channelMessageId
          // El video debe estar guardado en el registry cuando se sube al canal
          // NO buscar en el canal - solo usar el registry
          if (ip && (ip.videoFileId || ip.channelMessageId)) {
            console.log(`✅ IP tiene video disponible (videoFileId: ${!!ip.videoFileId}, channelMessageId: ${ip.channelMessageId || 'N/A'})`);
            
            // 2. Verificar que el bot esté disponible (ya se obtuvo antes)
            if (!bot) {
              console.error(`❌ ERROR CRÍTICO: Bot no disponible para enviar video`);
              throw new Error('Bot no disponible');
            }
            
            console.log(`✅ Bot instance verificada y lista para enviar video`);
            
            // 3. Reenviar video al usuario directamente usando videoFileId o channelMessageId
            // IMPORTANTE: Usar protect_content: true para desactivar reenvío hasta que se pague
            try {
              // CRÍTICO: Usar tokenId del REQUEST si está disponible (más preciso que el del IP encontrado)
              // Esto asegura que el caption tenga los datos correctos del puzzle resuelto
              const correctTokenId = tokenId?.toString() || ip.tokenId;
              
              // Construir caption completo con toda la información CORRECTA
              const explorerUrl = correctTokenId 
                ? `https://aeneid.storyscan.io/token/${ip.ipId}/instance/${correctTokenId}`
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
              
              // CRÍTICO: Usar título del REQUEST si está disponible (más confiable)
              const correctTitle = requestTitle || ip.title;
              
              let captionParts = [
                `🎬 ${correctTitle}${ip.year ? ` (${ip.year})` : ''}`,
                ``,
                `✅ Registrado como IP en Story Protocol`,
                `🔗 IP ID: ${ip.ipId}`,
              ];
              
              if (correctTokenId) {
                captionParts.push(`📦 Instancia: ${correctTokenId}`);
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
              
              // CRÍTICO: Usar sendVideo con protect_content: true para enviar UNA SOLA VEZ sin opción de reenvío
              // Priorizar videoFileId si está disponible, sino intentar obtenerlo del canal
              if (ip.videoFileId) {
                // PRIORIDAD 1: Usar videoFileId directamente (más confiable)
                console.log(`📤 Enviando video usando videoFileId: ${ip.videoFileId.substring(0, 20)}...`);
                console.log(`   - Usuario: ${telegramUserId}`);
                console.log(`   - Token ID correcto: ${correctTokenId || 'N/A'}`);
                console.log(`   - Título correcto: ${correctTitle || 'N/A'}`);
                console.log(`   - Caption length: ${fullCaption.length} caracteres`);
                console.log(`   - protect_content: true (sin opción de reenvío)`);
                
                await bot.telegram.sendVideo(
                  telegramUserId,
                  ip.videoFileId,
                  {
                    caption: fullCaption,
                    protect_content: true, // CRÍTICO: Sin opción de reenvío hasta que se pague la regalía
                  }
                );
                
                videoForwarded = true;
                console.log(`✅ Video enviado exitosamente UNA VEZ con protect_content: true`);
              } else if (ip.channelMessageId) {
                // PRIORIDAD 2: Si solo tenemos channelMessageId, intentar obtener videoFileId del canal
                // NOTA: Telegram Bot API no permite obtener mensajes de canales directamente
                // Por lo tanto, debemos confiar en que el videoFileId esté guardado en el registry
                console.error(`❌ ERROR: IP tiene channelMessageId pero NO tiene videoFileId`);
                console.error(`   - Channel Message ID: ${ip.channelMessageId}`);
                console.error(`   - IP: ${ip.title} (Token ID: ${ip.tokenId || 'N/A'})`);
                console.error(`   💡 El videoFileId debe estar guardado en el registry cuando se sube el video al canal.`);
                console.error(`   💡 Verifica que el endpoint /upload/forward-to-channel guarde correctamente el videoFileId.`);
                throw new Error('VideoFileId no disponible. El video debe estar guardado en el registry con videoFileId.');
              } else {
                console.warn(`⚠️  No se puede enviar video: IP ${finalIpId} no tiene videoFileId ni channelMessageId`);
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
            // CRÍTICO: Si el IP no tiene uploader, no podemos crear la regalía
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
                console.log(`   - IP: ${finalIpId} (${ip.title})`);
                console.log(`   - Uploader: ${uploaderTelegramId} (${uploaderName || 'Sin nombre'})`);
                console.log(`   - VideoFileId: ${ip.videoFileId || 'N/A'}`);
                console.log(`   - ChannelMessageId: ${ip.channelMessageId || 'N/A'}`);
                
                const royalty = await createPendingRoyalty(
                  telegramUserId,
                  finalIpId, // CRÍTICO: Usar el IP ID correcto, no el del contrato
                  ip.title || 'Video sin título',
                  '0.1', // Monto fijo de regalía (0.1 IP)
                  uploaderTelegramId,
                  uploaderName, // Usar nombre del registry
                  ip.tokenId,
                  ip.channelMessageId,
                  ip.videoFileId,
                  fullCaption // CRÍTICO: Guardar caption original para reenviar después del pago
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
              console.error(`❌ ERROR CRÍTICO: No se puede crear regalía: IP ${ipId} no tiene uploader`);
              console.error(`   - IP Title: ${ip.title}`);
              console.error(`   - IP Uploader: ${ip.uploader || 'undefined'}`);
              console.error(`   - IP UploaderName: ${ip.uploaderName || 'undefined'}`);
              console.error(`   💡 El IP debe tener un uploader para poder crear regalías. Verifica que el IP se registró correctamente con el uploader.`);
            }
          } else {
            console.warn(`⚠️  No se puede enviar video: IP ${finalIpId} (Token ID: ${ip?.tokenId || tokenId || 'N/A'}, Título: ${ip?.title || requestTitle || 'N/A'}) no tiene videoFileId ni channelMessageId`);
            console.warn(`   IP encontrado:`, ip ? {
              ipId: ip.ipId,
              tokenId: ip.tokenId || 'N/A',
              title: ip.title,
              hasVideoFileId: !!ip.videoFileId,
              hasChannelMessageId: !!ip.channelMessageId,
              uploader: ip.uploader,
            } : 'null');
            console.warn(`   💡 El video debe estar guardado en el registry cuando se sube al canal. TokenId buscado: ${tokenId || 'N/A'}, Título buscado: ${requestTitle || 'N/A'}`);
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

