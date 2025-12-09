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
    const allIPsMap = new Map<string, any>();
    
    // Primero agregar todos los IPs del registry
    for (const ip of registryIPs) {
      if (ip.posterUrl && ip.posterUrl.trim() !== '') {
        allIPsMap.set(ip.tokenId || ip.ipId, ip);
      }
    }
    
    // Luego agregar/actualizar con tokens de blockchain
    for (const token of blockchainTokens) {
      if (token.posterUrl && token.posterUrl.trim() !== '') {
        const key = token.tokenId || token.ipId;
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
          allIPsMap.set(key, token);
        }
      }
    }
    
    const allIPs = Array.from(allIPsMap.values());
    
    // Filtrar IPs con posterUrl
    const ipsWithPoster = allIPs.filter(
      (ip) => ip.posterUrl && ip.posterUrl.trim() !== ''
    );
    
    // Separar en dos categorías:
    // 1. Contenido Disponible: IPs que tienen video en el canal (channelMessageId o videoFileId)
    // 2. No Disponible: IPs que no tienen video en el canal
    const contenidoDisponible = ipsWithPoster.filter(
      (ip) => ip.channelMessageId || ip.videoFileId
    );
    
    const noDisponible = ipsWithPoster.filter(
      (ip) => !ip.channelMessageId && !ip.videoFileId
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

