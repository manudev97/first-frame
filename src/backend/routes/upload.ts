import { Router } from 'express';
import axios from 'axios';
import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

// Instancia del bot para reenviar videos al canal
let botInstance: Telegraf | null = null;

export function setBotInstance(bot: Telegraf) {
  botInstance = bot;
}

// Función para obtener la instancia del bot
function getBotInstance(): Telegraf | null {
  // Si ya está configurado, usarlo
  if (botInstance) {
    return botInstance;
  }
  
  // Intentar obtener dinámicamente desde el módulo del bot
  try {
    const { bot } = require('../../bot/index');
    if (bot) {
      botInstance = bot;
      return bot;
    }
  } catch (error) {
    console.warn('⚠️  No se pudo obtener instancia del bot dinámicamente:', error);
  }
  
  return null;
}

// Endpoint para SOLO reenviar video al canal privado (IP ya debe estar registrado)
router.post('/forward-to-channel', async (req, res) => {
  try {
    const {
      videoFileId,
      title,
      year,
      ipId,
      tokenId, // Agregar tokenId (instancia)
      uploaderTelegramId,
      uploaderName,
    } = req.body;

    if (!videoFileId) {
      return res.status(400).json({
        success: false,
        error: 'videoFileId es requerido',
      });
    }

    if (!ipId) {
      console.error('❌ ipId no proporcionado en el request:', req.body);
      return res.status(400).json({
        success: false,
        error: 'ipId es requerido para el caption del video',
      });
    }

    // Validar que el ipId sea una dirección válida
    if (typeof ipId !== 'string' || !ipId.startsWith('0x') || ipId.length !== 42) {
      console.error('❌ ipId inválido recibido:', ipId);
      return res.status(400).json({
        success: false,
        error: 'ipId debe ser una dirección Ethereum válida (0x...)',
      });
    }

    console.log(`📤 Reenviando video al canal con IP ID: ${ipId} para "${title}"`);

    // Reenviar video al canal privado
    // PRIORIDAD: Usar TELEGRAM_CHANNEL_ID si está disponible (es más confiable)
    const channelId = process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_CHANNEL_LINK;
    let channelMessageId: number | null = null;
    let finalChannelId: string | number | null = null;

    const bot = getBotInstance();
    if (bot && channelId) {
      try {
        // IMPORTANTE: Si TELEGRAM_CHANNEL_ID está configurado, usarlo directamente
        // Si solo hay TELEGRAM_CHANNEL_LINK, intentar extraer el ID o username
        finalChannelId = channelId;
        
        // Si es un ID numérico directo (sin prefijo), verificar si necesita el prefijo -100
        if (/^-?\d+$/.test(channelId.trim())) {
          const numericId = channelId.trim();
          // Los canales privados de Telegram requieren el prefijo -100
          // Si el ID es positivo y no tiene el prefijo, agregarlo
          if (!numericId.startsWith('-')) {
            // Es un ID positivo, agregar el prefijo -100 para canales privados
            finalChannelId = `-100${numericId}`;
            console.log(`✅ ID del canal formateado para canal privado: ${finalChannelId} (original: ${numericId})`);
          } else {
            // Ya tiene el prefijo negativo, usarlo tal cual
            finalChannelId = numericId;
            console.log(`✅ Usando ID numérico del canal: ${finalChannelId}`);
          }
        } else if (channelId.includes('t.me/')) {
          // Manejar diferentes tipos de links de Telegram:
          // 1. Link público: https://t.me/channelname -> @channelname
          // 2. Link privado con +: https://t.me/+invitecode -> NO se puede usar directamente
          // 3. Link con ID: https://t.me/c/1234567890/1 -> Extraer ID numérico
          
          if (channelId.includes('/+')) {
            // Link de invitación privada - NO se puede usar directamente
            // El usuario debe proporcionar el ID numérico en TELEGRAM_CHANNEL_ID
            throw new Error(
              'Los links de invitación privada (con +) no se pueden usar directamente.\n\n' +
              '💡 Solución: Configura TELEGRAM_CHANNEL_ID en tu archivo .env con el ID numérico del canal.\n\n' +
              'Para obtener el ID numérico:\n' +
              '1. Agrega el bot @userinfobot al canal y envía cualquier mensaje\n' +
              '2. El bot te responderá con el ID del canal\n' +
              '3. O usa el link https://t.me/c/1234567890/1 y extrae el número después de /c/\n\n' +
              'Ejemplo en .env:\n' +
              'TELEGRAM_CHANNEL_ID=3362337150'
            );
          } else if (channelId.includes('/c/')) {
            // Link con ID numérico: https://t.me/c/1234567890/1
            const idMatch = channelId.match(/\/c\/(-?\d+)/);
            if (idMatch) {
              finalChannelId = idMatch[1];
              console.log(`✅ ID extraído del link: ${finalChannelId}`);
            }
          } else {
            // Link público normal: https://t.me/channelname
            const match = channelId.match(/t\.me\/([a-zA-Z0-9_]+)/);
            if (match) {
              finalChannelId = '@' + match[1];
              console.log(`✅ Username extraído del link: ${finalChannelId}`);
            }
          }
        } else if (channelId.startsWith('@')) {
          // Ya es un username
          finalChannelId = channelId;
          console.log(`✅ Usando username del canal: ${finalChannelId}`);
        }

        // Verificar que el bot esté en el canal antes de intentar enviar
        try {
          const chatInfo = await bot.telegram.getChat(finalChannelId);
          console.log(`✅ Bot verificado en el canal: ${chatInfo.type} - ${'title' in chatInfo ? chatInfo.title : finalChannelId}`);
        } catch (verifyError: any) {
          console.error('❌ Error verificando acceso al canal:', verifyError.message);
          throw new Error(
            `El bot no tiene acceso al canal ${finalChannelId}.\n\n` +
            `💡 Soluciones:\n` +
            `1. Agrega el bot al canal como administrador\n` +
            `2. Asegúrate de que el bot tenga permisos para enviar mensajes\n` +
            `3. Verifica que el ID del canal sea correcto\n\n` +
            `ID usado: ${finalChannelId}\n` +
            `ID original: ${channelId}`
          );
        }

        // Validar que el ipId sea correcto antes de usarlo en el caption
        if (!ipId || typeof ipId !== 'string' || !ipId.startsWith('0x') || ipId.length !== 42) {
          console.error('❌ IP ID inválido recibido para el caption:', ipId);
          throw new Error(`IP ID inválido: ${ipId}. Debe ser una dirección Ethereum válida (0x...42 caracteres)`);
        }

        // Construir link al explorador
        const explorerUrl = tokenId 
          ? `https://aeneid.storyscan.io/token/${ipId}/instance/${tokenId}`
          : `https://aeneid.storyscan.io/token/${ipId}`;

        // Construir caption con el IP ID correcto, instancia y link
        let captionParts = [
          `🎬 ${title}${year ? ` (${year})` : ''}`,
          ``,
          `✅ Registrado como IP en Story Protocol`,
          `🔗 IP ID: ${ipId}`,
        ];

        // Agregar instancia si está disponible
        if (tokenId) {
          captionParts.push(`📦 Instancia: ${tokenId}`);
        }

        captionParts.push(
          `🔗 Ver en Explorer: ${explorerUrl}`,
          `📤 Subido por: ${uploaderName || `Usuario ${uploaderTelegramId}`}`,
          ``,
          `🎉 Felicidades haz resuelto el Puzzle puedes compartir este video y pagar tus regalías en : @firstframe_ipbot`
        );

        const videoCaption = captionParts.join('\n');

        console.log(`📝 Caption generado para "${title}":`, {
          ipId,
          title,
          year,
          uploaderName,
          captionLength: videoCaption.length,
        });

        // Usar sendVideo con el file_id del video original
        const channelMessage = await bot.telegram.sendVideo(
          finalChannelId,
          videoFileId,
          {
            caption: videoCaption,
          }
        );
        channelMessageId = channelMessage.message_id;
        console.log(`✅ Video reenviado al canal privado ${finalChannelId}. Message ID: ${channelMessageId}`);
      } catch (forwardError: any) {
        console.error('❌ Error reenviando video al canal:', forwardError);
        console.error('Detalles del error:', forwardError.response?.data || forwardError.message);
        
        // Si el error es "chat not found" y usamos el prefijo -100, intentar sin prefijo
        if (finalChannelId && forwardError.message.includes('chat not found') && typeof finalChannelId === 'string' && finalChannelId.startsWith('-100')) {
          try {
            const idWithoutPrefix = finalChannelId.replace('-100', '');
            console.log(`🔄 Intentando con ID sin prefijo: ${idWithoutPrefix}`);
            // Construir caption con el IP ID correcto, instancia y link (mismo que arriba)
            const explorerUrl = tokenId 
              ? `https://aeneid.storyscan.io/token/${ipId}/instance/${tokenId}`
              : `https://aeneid.storyscan.io/token/${ipId}`;

            let captionParts = [
              `🎬 ${title}${year ? ` (${year})` : ''}`,
              ``,
              `✅ Registrado como IP en Story Protocol`,
              `🔗 IP ID: ${ipId}`,
            ];

            if (tokenId) {
              captionParts.push(`📦 Instancia: ${tokenId}`);
            }

            captionParts.push(
              `🔗 Ver en Explorer: ${explorerUrl}`,
              `📤 Subido por: ${uploaderName || `Usuario ${uploaderTelegramId}`}`,
              ``,
              `🎉 Felicidades haz resuelto el Puzzle puedes compartir este video y pagar tus regalías en : @firstframe_ipbot`
            );

            const videoCaption = captionParts.join('\n');

            const channelMessage = await bot.telegram.sendVideo(
              idWithoutPrefix,
              videoFileId,
              {
                caption: videoCaption,
              }
            );
            channelMessageId = channelMessage.message_id;
            console.log(`✅ Video reenviado al canal usando ID sin prefijo: ${idWithoutPrefix}. Message ID: ${channelMessageId}`);
          } catch (retryError: any) {
            console.error('❌ Error también con ID sin prefijo:', retryError.message);
            // No fallar el proceso si no se puede reenviar
          }
        } else {
          // No fallar el proceso si no se puede reenviar
        }
      }
    } else {
      if (!bot) {
        console.warn('⚠️  Bot instance no configurado. Video no fue reenviado.');
      }
      if (!channelId) {
        console.warn('⚠️  TELEGRAM_CHANNEL_ID o TELEGRAM_CHANNEL_LINK no configurado. Video no fue reenviado.');
      }
    }

            // IMPORTANTE: Guardar channelMessageId, videoFileId y uploaderName en el registry para poder reenviar después
            if (channelMessageId && videoFileId) {
              try {
                const { getIPById, saveRegisteredIP } = await import('../services/ipRegistry');
                const ip = await getIPById(ipId);
                if (ip) {
                  ip.channelMessageId = channelMessageId;
                  ip.videoFileId = videoFileId;
                  ip.uploaderName = uploaderName; // Guardar nombre del uploader
                  await saveRegisteredIP(ip);
                  console.log(`✅ Channel message ID, video file ID y uploaderName guardados para IP ${ipId}`);
                  
                  // CRÍTICO: Limpiar caché del marketplace para que el IP aparezca como disponible inmediatamente
                  try {
                    const { clearMarketplaceCache } = await import('../services/marketplaceCache');
                    clearMarketplaceCache();
                    console.log('✅ Caché del marketplace limpiado después de actualizar IP con channelMessageId');
                  } catch (cacheError) {
                    console.warn('⚠️  No se pudo limpiar caché del marketplace:', cacheError);
                  }
                } else {
                  console.warn(`⚠️  IP ${ipId} no encontrado en registry. Puede que no se haya guardado correctamente durante el registro.`);
                }
              } catch (saveError: any) {
                console.warn('⚠️  No se pudo guardar channelMessageId en registry:', saveError.message);
              }
            }

            res.json({
              success: true,
              channelMessageId: channelMessageId,
              channelLink: channelId,
              message: channelMessageId ? 'Video reenviado al canal privado exitosamente' : 'Video no pudo ser reenviado (IP registrado correctamente)',
            });
  } catch (error: any) {
    console.error('Error reenviando video al canal:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error desconocido al reenviar video',
    });
  }
});

export { router as uploadRouter };

