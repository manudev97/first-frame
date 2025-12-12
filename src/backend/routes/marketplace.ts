import { Router } from 'express';
import { loadRegisteredIPs, searchIPs, getIPById, getIPsByUploader } from '../services/ipRegistry';
import { getAllTokensFromContract } from '../services/blockchainMarketplaceService';
import { getCachedMarketplace, setCachedMarketplace } from '../services/marketplaceCache';
import { searchVideosInChannelByCaption } from '../services/channelMessageService';

const router = Router();

// Listar todos los IPs registrados (marketplace)
router.get('/list', async (req, res) => {
  try {
    // Verificar caché primero
    const cached = getCachedMarketplace();
    if (cached) {
      console.log('✅ Usando datos del marketplace desde caché');
      return res.json({
        success: true,
        disponible: cached.disponible,
        noDisponible: cached.noDisponible,
        disponibleCount: cached.disponible.length,
        noDisponibleCount: cached.noDisponible.length,
        totalCount: cached.data.length,
        items: cached.data,
        count: cached.data.length,
        cached: true,
      });
    }
    
    // 1. Cargar IPs del registry local (más rápido)
    const registryIPs = await loadRegisteredIPs();
    console.log(`📊 Total IPs en registry local: ${registryIPs.length}`);
    
    // 2. Obtener tokens del contrato SPGNFT en paralelo (optimizado)
    let blockchainTokens: any[] = [];
    try {
      console.log('🔍 Obteniendo tokens desde blockchain (optimizado)...');
      // Usar Promise.all para obtener tokens en paralelo cuando sea posible
      blockchainTokens = await getAllTokensFromContract();
      console.log(`✅ Tokens obtenidos desde blockchain: ${blockchainTokens.length}`);
    } catch (blockchainError: any) {
      console.warn('⚠️  Error obteniendo tokens desde blockchain:', blockchainError.message);
      // Continuar solo con registry local
    }
    
    // 3. Combinar: usar blockchain como fuente de verdad, registry para detalles adicionales
    // CRÍTICO: Usar tokenId como clave única cuando todos tienen el mismo ipId (contrato)
    const allIPsMap = new Map<string, any>();
    
    // Primero agregar todos los IPs del registry
    for (const ip of registryIPs) {
      if (ip.posterUrl && ip.posterUrl.trim() !== '') {
        // CRÍTICO: Usar tokenId como clave única si existe, sino usar ipId
        const key = ip.tokenId ? `token_${ip.tokenId}`.toLowerCase() : ip.ipId.toLowerCase();
        allIPsMap.set(key, ip);
      }
    }
    
    // Luego agregar/actualizar con tokens de blockchain
    for (const token of blockchainTokens) {
      if (token.posterUrl && token.posterUrl.trim() !== '') {
        // CRÍTICO: Usar tokenId como clave única cuando todos tienen el mismo ipId
        // Formato: "token_{tokenId}" para asegurar unicidad
        const key = token.tokenId ? `token_${token.tokenId}`.toLowerCase() : (token.ipId || '').toLowerCase();
        
        if (!key) continue; // Saltar si no hay tokenId ni ipId
        
        const existing = allIPsMap.get(key);
        
        if (existing) {
          // Actualizar con información de blockchain si falta algo
          allIPsMap.set(key, {
            ...existing,
            ...token,
            // Preservar información del canal si existe
            channelMessageId: existing.channelMessageId || token.channelMessageId,
            videoFileId: existing.videoFileId || token.videoFileId,
            uploader: existing.uploader || token.uploader,
            uploaderName: existing.uploaderName || token.uploaderName,
          });
        } else {
          // CRÍTICO: Buscar si hay un video en el canal que coincida con el nombre del token
          if (token.title) {
            try {
              // Buscar en el registry local por nombre del token
              const matchingIP = registryIPs.find(ip => 
                ip.title?.toLowerCase().includes(token.title.toLowerCase()) ||
                token.title.toLowerCase().includes(ip.title?.toLowerCase() || '')
              );
              
              if (matchingIP && (matchingIP.channelMessageId || matchingIP.videoFileId)) {
                token.channelMessageId = matchingIP.channelMessageId;
                token.videoFileId = matchingIP.videoFileId;
                console.log(`✅ Video encontrado en registry para "${token.title}": messageId=${matchingIP.channelMessageId}`);
              }
            } catch (searchError: any) {
              // No crítico si falla la búsqueda
              console.warn(`⚠️  No se pudo buscar video para "${token.title}":`, searchError.message);
            }
          }
          allIPsMap.set(key, token);
        }
      }
    }
    
    console.log(`📊 Total IPs únicos después de agregar tokens de blockchain: ${allIPsMap.size}`);
    
    const allIPs = Array.from(allIPsMap.values());
    
    // Filtrar IPs con posterUrl
    const ipsWithPoster = allIPs.filter(
      (ip) => ip.posterUrl && ip.posterUrl.trim() !== ''
    );
    
    // CRÍTICO: Filtrar IPs que tienen regalías pagadas - estos NO deben estar disponibles
    // Un IP está disponible si:
    // 1. Tiene video en el canal (channelMessageId O videoFileId)
    // 2. NO tiene regalías pagadas (o todas las regalías están pendientes)
    const { loadPendingRoyalties } = await import('../services/royaltyService');
    const allRoyalties = await loadPendingRoyalties();
    
    // Crear un Set de IPs que tienen regalías pagadas
    const paidRoyaltyIPs = new Set<string>();
    for (const royalty of allRoyalties) {
      if (royalty.paid) {
        paidRoyaltyIPs.add(royalty.ipId.toLowerCase());
      }
    }
    
    console.log(`📊 IPs con regalías pagadas (no disponibles): ${paidRoyaltyIPs.size}`);
    
    // CRÍTICO: Separar en dos categorías basándose en si tienen video en el canal
    // Un IP está disponible si tiene channelMessageId O videoFileId Y no tiene regalías pagadas
    const contenidoDisponible = ipsWithPoster.filter(
      (ip) => {
        const hasChannelMessage = !!ip.channelMessageId;
        const hasVideoFileId = !!ip.videoFileId;
        const hasVideo = hasChannelMessage || hasVideoFileId;
        const hasPaidRoyalty = paidRoyaltyIPs.has(ip.ipId.toLowerCase());
        
        // Un IP está disponible si tiene video Y no tiene regalías pagadas
        const isAvailable = hasVideo && !hasPaidRoyalty;
        
        // Log detallado para debugging
        if (!isAvailable && ip.title) {
          console.log(`⚠️  IP "${ip.title}" no está disponible:`, {
            hasChannelMessage,
            hasVideoFileId,
            hasVideo,
            hasPaidRoyalty,
            ipId: ip.ipId,
          });
        }
        
        return isAvailable;
      }
    );
    
    const noDisponible = ipsWithPoster.filter(
      (ip) => {
        const hasVideo = !!ip.channelMessageId || !!ip.videoFileId;
        const hasPaidRoyalty = paidRoyaltyIPs.has(ip.ipId.toLowerCase());
        // No disponible si no tiene video O si tiene regalías pagadas
        return !hasVideo || hasPaidRoyalty;
      }
    );
    
    console.log(`📊 Contenido Disponible: ${contenidoDisponible.length}`);
    console.log(`📊 No Disponible: ${noDisponible.length}`);
    
    // Ordenar cada sección por fecha de creación (más recientes primero)
    const sortedDisponible = contenidoDisponible.sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    
    const sortedNoDisponible = noDisponible.sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    
    const allItems = [...sortedDisponible, ...sortedNoDisponible];
    
    // Guardar en caché
    setCachedMarketplace(allItems, sortedDisponible, sortedNoDisponible);
    
    res.json({
      success: true,
      disponible: sortedDisponible,
      noDisponible: sortedNoDisponible,
      disponibleCount: sortedDisponible.length,
      noDisponibleCount: sortedNoDisponible.length,
      totalCount: allItems.length,
      // Mantener compatibilidad con código anterior
      items: allItems,
      count: allItems.length,
      cached: false,
    });
  } catch (error: any) {
    console.error('Error listando IPs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Buscar IP por título
router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Query de búsqueda es requerido' 
      });
    }

    const results = await searchIPs(query);
    
    res.json({
      success: true,
      results: results,
      query: query,
      count: results.length,
    });
  } catch (error: any) {
    console.error('Error buscando IPs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener detalles de un IP por ID
router.get('/:ipId', async (req, res) => {
  try {
    const { ipId } = req.params;
    
    if (!ipId) {
      return res.status(400).json({ 
        success: false, 
        error: 'ipId es requerido' 
      });
    }

    const ip = await getIPById(ipId);
    
    if (!ip) {
      return res.status(404).json({
        success: false,
        error: 'IP no encontrado',
      });
    }
    
    res.json({
      success: true,
      item: ip,
    });
  } catch (error: any) {
    console.error('Error obteniendo IP:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener IPs registrados por un usuario
router.get('/user/:uploader', async (req, res) => {
  try {
    const { uploader } = req.params;
    
    if (!uploader) {
      return res.status(400).json({ 
        success: false, 
        error: 'uploader es requerido' 
      });
    }

    const userIPs = await getIPsByUploader(uploader);
    
    res.json({
      success: true,
      items: userIPs,
      count: userIPs.length,
    });
  } catch (error: any) {
    console.error('Error obteniendo IPs del usuario:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Buscar videos en canal por nombre del IP (búsqueda en caption)
router.get('/search-channel-videos', async (req, res) => {
  try {
    const { searchTerm } = req.query;
    
    if (!searchTerm || typeof searchTerm !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'searchTerm es requerido',
      });
    }
    
    const { bot } = await import('../../bot/index');
    const channelId = process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_CHANNEL_LINK;
    
    if (!channelId) {
      return res.status(500).json({
        success: false,
        error: 'TELEGRAM_CHANNEL_ID no está configurado',
      });
    }
    
    // Buscar videos en el canal por término de búsqueda
    const videos = await searchVideosInChannelByCaption(
      bot,
      channelId,
      decodeURIComponent(searchTerm)
    );
    
    res.json({
      success: true,
      videos,
      count: videos.length,
      searchTerm: decodeURIComponent(searchTerm),
    });
  } catch (error: any) {
    console.error('Error buscando videos en canal:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error buscando videos en canal',
    });
  }
});

// Buscar video en canal por nombre del IP
router.get('/find-video/:ipName', async (req, res) => {
  try {
    const { ipName } = req.params;
    const { ipId } = req.query;
    
    if (!ipName) {
      return res.status(400).json({
        success: false,
        error: 'ipName es requerido',
      });
    }
    
    const { bot } = await import('../../bot/index');
    const channelId = process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_CHANNEL_LINK;
    
    if (!channelId) {
      return res.status(500).json({
        success: false,
        error: 'TELEGRAM_CHANNEL_ID no está configurado',
      });
    }
    
    const { findVideoInChannelByIPName } = await import('../services/channelVideoService');
    const video = await findVideoInChannelByIPName(
      bot,
      channelId,
      decodeURIComponent(ipName),
      ipId as string | undefined
    );
    
    if (video) {
      res.json({
        success: true,
        video: {
          fileId: video.fileId,
          messageId: video.messageId,
          caption: video.caption,
          ipId: video.ipId,
        },
      });
    } else {
      res.json({
        success: false,
        message: 'Video no encontrado en el canal',
      });
    }
  } catch (error: any) {
    console.error('Error buscando video en canal:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error buscando video en canal',
    });
  }
});

export { router as marketplaceRouter };

