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
    const { puzzleId, solution, ipId, posterUrl } = req.body;
    
    const isValid = await validatePuzzleSolution(puzzleId, solution);
    
    if (isValid) {
      // Si el puzzle está resuelto y hay un IP asociado, registrar el póster como derivado
      let derivativeIpId = null;
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
            const derivativeResponse = await axios.post(`${backendUrl}/api/story/register-derivative`, {
              parentIpId: ipId,
              posterMetadata: {
                uri: posterMetadata.metadataUri,
                hash: posterMetadata.metadataHash,
                nftUri: posterMetadata.metadataUri,
                nftHash: posterMetadata.metadataHash,
              },
            });
            
            if (derivativeResponse.data.success) {
              derivativeIpId = derivativeResponse.data.ipId;
            }
          }
        } catch (derivativeError) {
          console.warn('No se pudo registrar el póster como derivado:', derivativeError);
          // No fallar el puzzle si no se puede registrar el derivado
        }
      }
      
      res.json({
        success: true,
        message: '¡Puzzle completado correctamente!',
        accessGranted: true,
        derivativeIpId: derivativeIpId,
        // En producción, aquí se otorgaría acceso al canal de Telegram
        channelLink: process.env.TELEGRAM_CHANNEL_LINK || 'https://t.me/your_channel',
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

