import { Router } from 'express';
import { getStoryBalance, hasSufficientBalance } from '../services/balanceService';
import { getTokenBalance, getRoyaltyTokenAddress } from '../services/tokenBalanceService';

const router = Router();

/**
 * Obtener balance de una dirección en Story Testnet
 * GET /api/balance/:address
 */
router.get('/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address || !address.startsWith('0x') || address.length !== 42) {
      return res.status(400).json({
        success: false,
        error: 'Dirección inválida. Debe ser una dirección Ethereum válida (0x...)',
      });
    }

    const balance = await getStoryBalance(address as `0x${string}`);
    
    res.json({
      success: true,
      balance,
      address,
      chain: 'Aeneid (Story Testnet)',
    });
  } catch (error: any) {
    console.error('Error obteniendo balance:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo balance',
    });
  }
});

/**
 * Verificar si una dirección tiene suficiente balance
 * GET /api/balance/:address/sufficient?min=0.001
 */
router.get('/:address/sufficient', async (req, res) => {
  try {
    const { address } = req.params;
    const minBalance = req.query.min as string || '0.001';
    
    if (!address || !address.startsWith('0x') || address.length !== 42) {
      return res.status(400).json({
        success: false,
        error: 'Dirección inválida',
      });
    }

    const sufficient = await hasSufficientBalance(address as `0x${string}`, minBalance);
    const balance = await getStoryBalance(address as `0x${string}`);
    
    res.json({
      success: true,
      sufficient,
      balance,
      minBalance,
      address,
    });
  } catch (error: any) {
    console.error('Error verificando balance:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error verificando balance',
    });
  }
});

/**
 * Obtener balance de MockERC20 para una dirección
 * GET /api/balance/:address/token
 */
router.get('/:address/token', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address || !address.startsWith('0x') || address.length !== 42) {
      return res.status(400).json({
        success: false,
        error: 'Dirección inválida. Debe ser una dirección Ethereum válida (0x...)',
      });
    }

    const tokenAddress = getRoyaltyTokenAddress();
    const balance = await getTokenBalance(tokenAddress, address as `0x${string}`);
    
    res.json({
      success: true,
      balance,
      address,
      tokenAddress,
      tokenSymbol: 'MockERC20',
      chain: 'Aeneid (Story Testnet)',
    });
  } catch (error: any) {
    console.error('Error obteniendo balance de token:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo balance de token',
    });
  }
});

export { router as balanceRouter };

