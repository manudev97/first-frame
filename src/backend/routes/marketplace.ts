import { Router } from 'express';
import { loadRegisteredIPs, searchIPs, getIPById, getIPsByUploader } from '../services/ipRegistry';

const router = Router();

// Listar todos los IPs registrados (marketplace)
router.get('/list', async (req, res) => {
  try {
    const ips = await loadRegisteredIPs();
    
    // Ordenar por fecha de creación (más recientes primero)
    const sortedIPs = ips.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    res.json({
      success: true,
      items: sortedIPs,
      count: sortedIPs.length,
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

export { router as marketplaceRouter };

