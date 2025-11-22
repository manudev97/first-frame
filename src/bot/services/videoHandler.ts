import axios from 'axios';
import { Telegraf, Context } from 'telegraf';

// Servicio para manejar videos enviados al bot
// Cuando un usuario reenvía un video, el bot debe:
// 1. Registrar el IP en Story Protocol
// 2. Reenviar el video al canal privado

const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;

interface VideoMetadata {
  fileId: string;
  fileName: string;
  fileSizeMB: string;
  durationMinutes: string;
  videoLink: string;
}

/**
 * Reenvía un video al canal privado de Telegram
 */
export async function forwardVideoToChannel(
  bot: Telegraf,
  videoFileId: string,
  channelId: string
): Promise<number | null> {
  try {
    // Reenviar el video al canal privado
    const forwardedMessage = await bot.telegram.forwardMessage(
      channelId,
      channelId, // from_chat_id (temporal, se corregirá)
      parseInt(videoFileId) // message_id (temporal)
    );
    
    // Nota: forwardMessage requiere que el bot tenga acceso al mensaje original
    // Una alternativa es usar sendVideo si tenemos el file_id
    return forwardedMessage.message_id;
  } catch (error: any) {
    console.error('Error reenviando video al canal:', error);
    
    // Si forwardMessage falla, intentar enviar el video directamente usando file_id
    try {
      const sentMessage = await bot.telegram.sendVideo(channelId, videoFileId, {
        caption: '🎬 Video registrado como IP en FirstFrame',
      });
      return sentMessage.message_id;
    } catch (sendError: any) {
      console.error('Error enviando video al canal:', sendError);
      return null;
    }
  }
}

/**
 * Registra un video como IP en Story Protocol y lo reenvía al canal privado
 */
export async function registerVideoAndForward(
  bot: Telegraf,
  ctx: Context,
  videoInfo: VideoMetadata,
  title: string,
  year: string,
  imdbData: any
): Promise<{ success: boolean; ipId?: string; channelMessageId?: number; error?: string }> {
  try {
    // 1. Obtener datos de IMDB si no están
    let movieData = imdbData;
    if (!movieData) {
      try {
        const imdbResponse = await axios.get(
          `${BACKEND_URL}/api/imdb/movie/${encodeURIComponent(title)}/${year}`
        );
        if (imdbResponse.data.success) {
          movieData = imdbResponse.data.data;
        }
      } catch (imdbError) {
        console.warn('No se pudo obtener datos de IMDB, continuando sin ellos');
      }
    }

    // 2. Crear metadata y subir a IPFS
    const metadataResponse = await axios.post(`${BACKEND_URL}/api/ip/upload-video`, {
      videoUrl: videoInfo.videoLink,
      title,
      year: parseInt(year),
      imdbData: movieData,
      videoSizeMB: videoInfo.fileSizeMB,
      videoDurationMinutes: videoInfo.durationMinutes,
      videoFileName: videoInfo.fileName,
      description: movieData?.plot || movieData?.Plot,
      posterUrl: movieData?.poster || movieData?.Poster,
      imdbId: movieData?.imdbId || movieData?.imdbID,
      uploader: `TelegramUser_${ctx.from?.id}`,
    });

    if (!metadataResponse.data.success) {
      throw new Error('No se pudo crear metadata del video');
    }

    // 3. Registrar IP en Story Protocol
    const storyResponse = await axios.post(`${BACKEND_URL}/api/story/register-ip`, {
      metadata: {
        uri: metadataResponse.data.metadataUri,
        hash: metadataResponse.data.metadataHash,
        nftUri: metadataResponse.data.nftMetadataUri || metadataResponse.data.metadataUri,
        nftHash: metadataResponse.data.nftMetadataHash || metadataResponse.data.metadataHash,
      },
      title,
      year: parseInt(year),
      posterUrl: metadataResponse.data.posterUrl,
      description: movieData?.plot || movieData?.Plot,
      imdbId: movieData?.imdbId || movieData?.imdbID,
      uploader: `TelegramUser_${ctx.from?.id}`,
    });

    if (!storyResponse.data.success) {
      throw new Error('No se pudo registrar el IP en Story Protocol');
    }

    const ipId = storyResponse.data.ipId;

    // 4. Registrar términos de licencia
    try {
      await axios.post(`${BACKEND_URL}/api/story/register-license`, {
        ipId: ipId,
        licenseTerms: {
          commercialUse: false,
          commercialRevShare: 0,
          commercialAttribution: true,
          derivativesAllowed: true,
          derivativesAttribution: true,
          mintingFee: '0',
        },
      });
    } catch (licenseError) {
      console.warn('No se pudo registrar licencia, pero el IP fue registrado:', licenseError);
    }

    // 5. Reenviar video al canal privado
    const channelId = process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_CHANNEL_LINK;
    let channelMessageId: number | null = null;

    if (channelId) {
      try {
        // Usar sendVideo con el file_id del video original
        const channelMessage = await bot.telegram.sendVideo(
          channelId,
          videoInfo.fileId,
          {
            caption: `🎬 ${title} (${year})\n\n` +
                     `✅ Registrado como IP en Story Protocol\n` +
                     `🔗 IP ID: ${ipId}\n` +
                     `📤 Subido por: ${ctx.from?.first_name || 'Usuario'}`,
          }
        );
        channelMessageId = channelMessage.message_id;
        console.log(`✅ Video reenviado al canal privado. Message ID: ${channelMessageId}`);
      } catch (forwardError: any) {
        console.error('❌ Error reenviando video al canal:', forwardError);
        // No fallar el proceso si no se puede reenviar
      }
    } else {
      console.warn('⚠️  TELEGRAM_CHANNEL_ID no configurado. Video no fue reenviado al canal.');
    }

    return {
      success: true,
      ipId: ipId,
      channelMessageId: channelMessageId || undefined,
    };
  } catch (error: any) {
    console.error('Error registrando video y reenviando:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido al registrar video',
    };
  }
}

/**
 * Maneja cuando un usuario reenvía un video al bot
 */
export async function handleVideoForward(
  bot: Telegraf,
  ctx: Context,
  video: any
): Promise<void> {
  const userId = ctx.from?.id;
  const videoInfo: VideoMetadata = {
    fileId: video.file_id,
    fileName: video.file_name || 'video.mp4',
    fileSizeMB: video.file_size ? (video.file_size / (1024 * 1024)).toFixed(2) : '',
    durationMinutes: video.duration ? (video.duration / 60).toFixed(1) : '',
    videoLink: `https://t.me/c/${ctx.chat?.id}/${ctx.message.message_id}`,
  };

  // Responder al usuario indicando que el video será procesado
  await ctx.reply(
    '📹 Video recibido!\n\n' +
    'Para registrar este video como IP, necesito:\n\n' +
    '1️⃣ Nombre de la película/serie\n' +
    '2️⃣ Año de lanzamiento\n\n' +
    'Responde a este mensaje con el formato:\n' +
    '`Nombre, Año`\n\n' +
    'Ejemplo: `The Matrix, 1999`',
    { parse_mode: 'Markdown' }
  );

  // Guardar información del video en contexto para cuando el usuario responda
  // Esto requeriría implementar un sistema de sesiones/storage
  // Por ahora, el usuario debe usar la Mini App para completar el registro
}

