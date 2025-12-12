// Servicio para buscar y reenviar videos desde el canal privado
import { Telegraf } from 'telegraf';
import { getIPById, loadRegisteredIPs } from './ipRegistry';

/**
 * Busca un video en el canal por nombre del IP o IP ID
 * Retorna el file_id del video y el message_id del canal
 */
export async function findVideoInChannelByIPName(
  bot: Telegraf,
  channelId: string | number,
  ipName: string,
  ipId?: string
): Promise<{ fileId: string; messageId: number; caption?: string; ipId: string } | null> {
  try {
    console.log(`🔍 Buscando video en canal por nombre: "${ipName}"`);
    
    // 1. Buscar en el registry por nombre del IP
    const allIPs = await loadRegisteredIPs();
    
    // Buscar IPs que coincidan con el nombre (case-insensitive)
    const matchingIPs = allIPs.filter(ip => {
      const titleMatch = ip.title?.toLowerCase().includes(ipName.toLowerCase());
      const ipIdMatch = ipId && ip.ipId?.toLowerCase() === ipId.toLowerCase();
      return titleMatch || ipIdMatch;
    });
    
    if (matchingIPs.length === 0) {
      console.log(`⚠️  No se encontraron IPs con nombre "${ipName}"`);
      return null;
    }
    
    // Priorizar IPs que tengan channelMessageId o videoFileId
    const ipWithVideo = matchingIPs.find(ip => ip.channelMessageId || ip.videoFileId);
    const selectedIP = ipWithVideo || matchingIPs[0];
    
    if (selectedIP.channelMessageId && selectedIP.videoFileId) {
      console.log(`✅ Video encontrado en registry para "${ipName}":`);
      console.log(`   - IP ID: ${selectedIP.ipId}`);
      console.log(`   - Channel Message ID: ${selectedIP.channelMessageId}`);
      console.log(`   - Video File ID: ${selectedIP.videoFileId}`);
      
      return {
        fileId: selectedIP.videoFileId,
        messageId: selectedIP.channelMessageId,
        caption: `🎬 ${selectedIP.title}${selectedIP.year ? ` (${selectedIP.year})` : ''}`,
        ipId: selectedIP.ipId,
      };
    }
    
    // Si no tiene channelMessageId pero tiene videoFileId, intentar buscar en el canal
    if (selectedIP.videoFileId && !selectedIP.channelMessageId) {
      console.log(`⚠️  IP encontrado pero sin channelMessageId, intentando buscar en canal...`);
      
      // NOTA: Telegram Bot API no permite buscar mensajes en canales directamente
      // La mejor estrategia es guardar el channelMessageId cuando se envía el video
      // Por ahora, retornamos el videoFileId si está disponible
      
      return {
        fileId: selectedIP.videoFileId,
        messageId: 0, // No disponible
        caption: `🎬 ${selectedIP.title}${selectedIP.year ? ` (${selectedIP.year})` : ''}`,
        ipId: selectedIP.ipId,
      };
    }
    
    console.log(`⚠️  IP encontrado pero sin video asociado`);
    return null;
  } catch (error: any) {
    console.error('Error buscando video en canal por nombre:', error);
    return null;
  }
}

/**
 * Busca un video en el canal por tokenId o título en el caption
 * IMPORTANTE: Telegram Bot API no permite buscar mensajes directamente
 * Esta función busca en el registry y luego intenta buscar en el canal si el bot es admin
 */
export async function findVideoInChannelByTokenIdOrTitle(
  bot: Telegraf,
  channelId: string | number,
  tokenId?: string,
  title?: string,
  ipId?: string
): Promise<{ fileId: string; messageId: number; caption?: string; ipId: string } | null> {
  try {
    console.log(`🔍 Buscando video en canal por tokenId: ${tokenId || 'N/A'}, título: ${title || 'N/A'}`);
    
    // 1. Buscar en el registry por tokenId (más preciso)
    const allIPs = await loadRegisteredIPs();
    
    let matchingIP: any = null;
    
    // PRIORIDAD 1: Buscar por tokenId exacto
    if (tokenId) {
      matchingIP = allIPs.find(ip => 
        ip.tokenId === tokenId || 
        ip.tokenId === tokenId.toString() ||
        (ip.tokenId && ip.tokenId.toString() === tokenId.toString())
      );
      
      if (matchingIP && (matchingIP.channelMessageId || matchingIP.videoFileId)) {
        console.log(`✅ Video encontrado en registry por tokenId ${tokenId}: ${matchingIP.title}`);
        return {
          fileId: matchingIP.videoFileId!,
          messageId: matchingIP.channelMessageId || 0,
          caption: `🎬 ${matchingIP.title}${matchingIP.year ? ` (${matchingIP.year})` : ''}`,
          ipId: matchingIP.ipId,
        };
      }
    }
    
    // PRIORIDAD 2: Buscar por título
    if (!matchingIP && title) {
      const titleMatches = allIPs.filter(ip => {
        const titleMatch = ip.title?.toLowerCase().trim() === title.toLowerCase().trim() ||
                          ip.title?.toLowerCase().trim().includes(title.toLowerCase().trim()) ||
                          title.toLowerCase().trim().includes(ip.title?.toLowerCase().trim() || '');
        return titleMatch;
      });
      
      // Priorizar IPs que tienen video y coinciden con tokenId si está disponible
      if (tokenId) {
        matchingIP = titleMatches.find(ip => 
          (ip.tokenId === tokenId || ip.tokenId === tokenId.toString()) &&
          (ip.channelMessageId || ip.videoFileId)
        );
      }
      
      // Si no encontramos por tokenId, usar el primero que tenga video
      if (!matchingIP) {
        matchingIP = titleMatches.find(ip => ip.channelMessageId || ip.videoFileId);
      }
      
      if (matchingIP && (matchingIP.channelMessageId || matchingIP.videoFileId)) {
        console.log(`✅ Video encontrado en registry por título "${title}": ${matchingIP.title} (Token ID: ${matchingIP.tokenId || 'N/A'})`);
        return {
          fileId: matchingIP.videoFileId!,
          messageId: matchingIP.channelMessageId || 0,
          caption: `🎬 ${matchingIP.title}${matchingIP.year ? ` (${matchingIP.year})` : ''}`,
          ipId: matchingIP.ipId,
        };
      }
    }
    
    // PRIORIDAD 3: Buscar por ipId (último recurso)
    if (!matchingIP && ipId) {
      matchingIP = allIPs.find(ip => 
        ip.ipId?.toLowerCase() === ipId.toLowerCase() &&
        (ip.channelMessageId || ip.videoFileId)
      );
      
      if (matchingIP && (matchingIP.channelMessageId || matchingIP.videoFileId)) {
        console.log(`✅ Video encontrado en registry por ipId ${ipId}: ${matchingIP.title} (Token ID: ${matchingIP.tokenId || 'N/A'})`);
        return {
          fileId: matchingIP.videoFileId!,
          messageId: matchingIP.channelMessageId || 0,
          caption: `🎬 ${matchingIP.title}${matchingIP.year ? ` (${matchingIP.year})` : ''}`,
          ipId: matchingIP.ipId,
        };
      }
    }
    
    console.warn(`⚠️  No se encontró video en registry para tokenId: ${tokenId || 'N/A'}, título: ${title || 'N/A'}`);
    return null;
  } catch (error: any) {
    console.error('Error buscando video en canal por tokenId/título:', error);
    return null;
  }
}

/**
 * Busca un video en el canal por IP ID o tokenId
 * Retorna el file_id del video y el message_id del canal
 */
export async function findVideoInChannel(
  bot: Telegraf,
  channelId: string | number,
  ipId: string,
  tokenId?: string
): Promise<{ fileId: string; messageId: number; caption?: string } | null> {
  try {
    // Primero, intentar obtener el IP del registry para ver si tiene channelMessageId guardado
    const ip = await getIPById(ipId);
    
    if (ip && ip.channelMessageId && ip.videoFileId) {
      console.log(`✅ Video encontrado en registry para IP ID: ${ipId}`);
      return {
        fileId: ip.videoFileId,
        messageId: ip.channelMessageId,
        caption: `🎬 ${ip.title}${ip.year ? ` (${ip.year})` : ''}`,
      };
    }
    
    // Si no está en el registry, intentar buscar por nombre
    if (ip && ip.title) {
      return await findVideoInChannelByIPName(bot, channelId, ip.title, ipId);
    }
    
    return null;
  } catch (error: any) {
    console.error('Error buscando video en canal:', error);
    return null;
  }
}

/**
 * Reenvía un video desde el canal al usuario
 */
export async function forwardVideoToUser(
  bot: Telegraf,
  channelId: string | number,
  messageId: number,
  userId: number
): Promise<boolean> {
  try {
    // Reenviar el mensaje del canal al usuario
    await bot.telegram.forwardMessage(
      userId,
      channelId,
      messageId
    );
    
    console.log(`✅ Video reenviado al usuario ${userId} desde mensaje ${messageId} del canal`);
    return true;
  } catch (error: any) {
    console.error(`❌ Error reenviando video al usuario ${userId}:`, error);
    return false;
  }
}

/**
 * Obtiene el file_id de un video desde un mensaje del canal
 */
export async function getVideoFileIdFromChannel(
  bot: Telegraf,
  channelId: string | number,
  messageId: number
): Promise<string | null> {
  try {
    // Obtener el mensaje del canal
    const message = await bot.telegram.getChat(channelId).then(async (chat) => {
      // Intentar obtener el mensaje usando forwardMessage o copiando
      // NOTA: Telegram Bot API no permite obtener mensajes de canales directamente
      // Necesitamos guardar el file_id cuando enviamos el video
      
      return null;
    });
    
    return null;
  } catch (error: any) {
    console.error('Error obteniendo file_id del video:', error);
    return null;
  }
}


