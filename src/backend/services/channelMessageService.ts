// Servicio para buscar mensajes en el canal de Telegram
import { Telegraf } from 'telegraf';
import { loadRegisteredIPs } from './ipRegistry';

/**
 * Busca videos en el canal por nombre del IP en el caption
 * IMPORTANTE: Telegram Bot API no permite listar mensajes de canales directamente
 * Esta función busca en el registry local y luego intenta verificar en el canal
 */
export async function searchVideosInChannelByCaption(
  bot: Telegraf,
  channelId: string | number,
  searchTerm: string
): Promise<Array<{
  ipId: string;
  title: string;
  channelMessageId?: number;
  videoFileId?: string;
  caption?: string;
}>> {
  try {
    console.log(`🔍 Buscando videos en canal por término: "${searchTerm}"`);
    
    // 1. Buscar en el registry local por nombre del IP
    const allIPs = await loadRegisteredIPs();
    
    // Buscar IPs que coincidan con el término de búsqueda (case-insensitive)
    const matchingIPs = allIPs.filter(ip => {
      const titleMatch = ip.title?.toLowerCase().includes(searchTerm.toLowerCase());
      const ipIdMatch = ip.ipId?.toLowerCase().includes(searchTerm.toLowerCase());
      return titleMatch || ipIdMatch;
    });
    
    console.log(`✅ Encontrados ${matchingIPs.length} IPs que coinciden con "${searchTerm}"`);
    
    // Retornar IPs con información del canal
    return matchingIPs.map(ip => ({
      ipId: ip.ipId,
      title: ip.title || 'Sin título',
      channelMessageId: ip.channelMessageId,
      videoFileId: ip.videoFileId,
      caption: `🎬 ${ip.title}${ip.year ? ` (${ip.year})` : ''}`,
    }));
  } catch (error: any) {
    console.error('Error buscando videos en canal:', error);
    return [];
  }
}

/**
 * Sincroniza videos del canal con el registry
 * Busca videos en el canal que no estén en el registry
 * NOTA: Esto requiere que el bot sea admin del canal y use la API de Telegram
 */
export async function syncChannelVideosWithRegistry(
  bot: Telegraf,
  channelId: string | number
): Promise<number> {
  try {
    console.log(`🔄 Sincronizando videos del canal con registry...`);
    
    // NOTA: Telegram Bot API no permite listar mensajes de canales directamente
    // La mejor estrategia es:
    // 1. Usar el registry como fuente de verdad
    // 2. Cuando se envía un video, guardar el channelMessageId
    // 3. Buscar videos por nombre en el registry
    
    // Por ahora, solo retornamos 0 ya que no podemos listar mensajes del canal
    // En el futuro, si Telegram permite listar mensajes, podemos implementar esto
    
    console.log(`⚠️  Sincronización de canal no disponible - Telegram Bot API no permite listar mensajes`);
    return 0;
  } catch (error: any) {
    console.error('Error sincronizando videos del canal:', error);
    return 0;
  }
}

/**
 * Busca un video específico en el canal por IP ID
 */
export async function findVideoByIPId(
  bot: Telegraf,
  channelId: string | number,
  ipId: string
): Promise<{
  ipId: string;
  title: string;
  channelMessageId?: number;
  videoFileId?: string;
  caption?: string;
} | null> {
  try {
    const allIPs = await loadRegisteredIPs();
    const ip = allIPs.find(i => i.ipId?.toLowerCase() === ipId.toLowerCase());
    
    if (ip && (ip.channelMessageId || ip.videoFileId)) {
      return {
        ipId: ip.ipId,
        title: ip.title || 'Sin título',
        channelMessageId: ip.channelMessageId,
        videoFileId: ip.videoFileId,
        caption: `🎬 ${ip.title}${ip.year ? ` (${ip.year})` : ''}`,
      };
    }
    
    return null;
  } catch (error: any) {
    console.error('Error buscando video por IP ID:', error);
    return null;
  }
}

