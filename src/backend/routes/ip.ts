import { Router } from 'express';
import { uploadToIPFS, createIPMetadata, createNFTMetadata } from '../services/ipfsService';

const router = Router();

// Obtener metadatos de video desde Telegram
router.post('/get-telegram-video-info', async (req, res) => {
  try {
    const { telegramVideoUrl } = req.body;
    
    if (!telegramVideoUrl) {
      return res.status(400).json({ 
        success: false, 
        error: 'telegramVideoUrl es requerido' 
      });
    }

    // Extraer file_id o file_unique_id del link de Telegram
    // Los links de Telegram tienen formato: https://t.me/c/CHAT_ID/MESSAGE_ID
    // O podemos usar la API de Telegram para obtener info del video
    // Por ahora, retornamos estructura básica - el usuario puede proporcionar los metadatos
    
    res.json({
      success: true,
      message: 'Usa la API de Telegram Bot para obtener metadatos del video',
      // En producción, aquí usarías la API de Telegram para obtener:
      // - file_name
      // - file_size (en bytes, convertir a MB)
      // - duration (en segundos, convertir a minutos)
    });
  } catch (error: any) {
    console.error('Error obteniendo info de video:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Subir video y crear metadata (ahora con metadatos de Telegram)
router.post('/upload-video', async (req, res) => {
  try {
    const { videoUrl, title, year, imdbData, videoSizeMB, videoDurationMinutes, videoFileName } = req.body;
    
    // Obtener URL del póster de IMDB
    const posterUrl = imdbData?.poster || imdbData?.Poster;
    
    // Crear metadata del IP con información del video de Telegram
    const ipMetadata = await createIPMetadata({
      title,
      year,
      image: posterUrl, // Incluir póster de IMDB como imagen del IP
      videoUrl,
      videoSizeMB: videoSizeMB ? parseFloat(videoSizeMB) : undefined,
      videoDurationMinutes: videoDurationMinutes ? parseFloat(videoDurationMinutes) : undefined,
      videoFileName: videoFileName,
      imdbId: imdbData?.imdbId || imdbData?.imdbID,
      description: imdbData?.plot || imdbData?.Plot,
      creators: [{ name: req.body.uploaderName || 'Anonymous', contribution: 100 }],
    });

    // Crear metadata NFT en formato OpenSea estándar (para que se muestre en exploradores)
    const nftMetadata = await createNFTMetadata({
      name: `${title}${year ? ` (${year})` : ''}`,
      description: imdbData?.plot || imdbData?.Plot || `Video IP: ${title}`,
      image: posterUrl || '', // URL del póster de IMDB - CRÍTICO para mostrar en exploradores
      year: year ? parseInt(year) : undefined,
      imdbId: imdbData?.imdbId || imdbData?.imdbID,
    });

    // Subir ambas metadata a IPFS
    const ipMetadataUri = await uploadToIPFS(ipMetadata.metadata);
    const nftMetadataUri = await uploadToIPFS(nftMetadata.metadata);

    res.json({
      success: true,
      metadataUri: ipMetadataUri,
      metadataHash: ipMetadata.hash,
      nftMetadataUri: nftMetadataUri,
      nftMetadataHash: nftMetadata.hash,
      posterUrl: posterUrl, // Devolver también para uso en frontend
    });
  } catch (error: any) {
    console.error('Error subiendo video:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Crear metadata para póster (derivado)
router.post('/create-poster-metadata', async (req, res) => {
  try {
    const { posterUrl, parentIpId, title, year } = req.body;
    
    const metadata = await createIPMetadata({
      title: `${title} - Poster`,
      year,
      image: posterUrl, // Usar 'image' en lugar de 'imageUrl'
      parentIpId,
      description: `Póster oficial de ${title} (${year})`,
      creators: [{ name: 'FirstFrame Puzzle Solver' }],
    });

    const metadataUri = await uploadToIPFS(metadata);

    res.json({
      success: true,
      metadataUri,
      metadataHash: metadata.hash,
    });
  } catch (error: any) {
    console.error('Error creando metadata de póster:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as ipRouter };

