import { Router } from 'express';
import { getIPsByUploader } from '../services/ipRegistry';
import axios from 'axios';

const router = Router();

/**
 * Obtener estadísticas de un usuario
 * GET /api/user/stats/:telegramUserId
 */
router.get('/stats/:telegramUserId', async (req, res) => {
  try {
    const telegramUserId = parseInt(req.params.telegramUserId);
    
    if (isNaN(telegramUserId)) {
      return res.status(400).json({
        success: false,
        error: 'telegramUserId debe ser un número válido',
      });
    }

    const uploaderId = `TelegramUser_${telegramUserId}`;
    
    // Obtener IPs registrados por el usuario
    const userIPs = await getIPsByUploader(uploaderId);
    
    // TODO: Implementar tracking de puzzles completados y regalías
    // Por ahora, retornamos valores por defecto
    const stats = {
      ipsRegistered: userIPs.length,
      puzzlesCompleted: 0, // TODO: Implementar tracking
      royaltiesPending: '0', // TODO: Implementar cálculo de regalías
    };

    res.json({
      success: true,
      telegramUserId,
      stats,
    });
  } catch (error: any) {
    console.error('Error obteniendo estadísticas del usuario:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo estadísticas',
    });
  }
});

export { router as userRouter };

