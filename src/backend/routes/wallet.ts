import { Router } from 'express';
import crypto from 'crypto';

const router = Router();

/**
 * Genera una dirección de wallet determinística basada en el ID de Telegram
 * Usa SHA-256 para generar un hash determinístico
 */
function generateDeterministicWallet(telegramUserId: number): string {
  const seed = `firstframe_telegram_${telegramUserId}_wallet_seed_v1`;
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  // Tomar los primeros 40 caracteres (20 bytes) para la dirección Ethereum
  return '0x' + hash.substring(0, 40);
}

/**
 * Obtener wallet address desde Telegram User ID
 * GET /api/wallet/address/:telegramUserId
 */
router.get('/address/:telegramUserId', async (req, res) => {
  try {
    const telegramUserId = parseInt(req.params.telegramUserId);
    
    if (isNaN(telegramUserId)) {
      return res.status(400).json({
        success: false,
        error: 'telegramUserId debe ser un número válido',
      });
    }

    const address = generateDeterministicWallet(telegramUserId);
    
    res.json({
      success: true,
      address,
      telegramUserId,
    });
  } catch (error: any) {
    console.error('Error generando wallet address:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error generando wallet address',
    });
  }
});

export { router as walletRouter };

