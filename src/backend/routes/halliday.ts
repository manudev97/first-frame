import { Router } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
const HALLIDAY_API_URL = 'https://v2.prod.halliday.xyz';

// Middleware para autenticación con Halliday API
const getAuthHeaders = () => {
  const apiKey = process.env.HALLIDAY_API_KEY;
  if (!apiKey) {
    throw new Error('HALLIDAY_API_KEY no está configurado en .env');
  }
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
};

// Obtener todos los assets soportados
router.get('/assets', async (req, res) => {
  try {
    const response = await axios.get(`${HALLIDAY_API_URL}/assets`, {
      headers: getAuthHeaders(),
    });
    res.json({ success: true, data: response.data });
  } catch (error: any) {
    console.error('Error obteniendo assets de Halliday:', error);
    res.status(500).json({
      success: false,
      error: error.response?.data?.message || error.message || 'Error obteniendo assets',
    });
  }
});

// Obtener outputs disponibles para un input
router.get('/assets/available-outputs', async (req, res) => {
  try {
    const { inputs, outputs, onramps } = req.query;
    
    const params = new URLSearchParams();
    if (inputs) {
      if (Array.isArray(inputs)) {
        inputs.forEach((input: string) => params.append('inputs[]', input));
      } else {
        params.append('inputs[]', inputs as string);
      }
    }
    if (outputs) {
      if (Array.isArray(outputs)) {
        outputs.forEach((output: string) => params.append('outputs[]', output));
      } else {
        params.append('outputs[]', outputs as string);
      }
    }
    if (onramps) {
      if (Array.isArray(onramps)) {
        onramps.forEach((onramp: string) => params.append('onramps[]', onramp));
      } else {
        params.append('onramps[]', onramps as string);
      }
    }

    const response = await axios.get(`${HALLIDAY_API_URL}/assets/available-outputs?${params.toString()}`, {
      headers: getAuthHeaders(),
    });
    res.json({ success: true, data: response.data });
  } catch (error: any) {
    console.error('Error obteniendo outputs disponibles:', error);
    res.status(500).json({
      success: false,
      error: error.response?.data?.message || error.message || 'Error obteniendo outputs',
    });
  }
});

// Obtener quotes para un pago
router.post('/quotes', async (req, res) => {
  try {
    const { request, price_currency, onramps, onramp_methods, customer_ip_address } = req.body;

    // Validar y limpiar datos antes de enviar
    const payload: any = {
      request,
      price_currency: price_currency || 'USD',
    };

    // Solo incluir campos opcionales si están presentes
    if (onramps && Array.isArray(onramps) && onramps.length > 0) {
      payload.onramps = onramps;
    }
    if (onramp_methods && Array.isArray(onramp_methods) && onramp_methods.length > 0) {
      payload.onramp_methods = onramp_methods;
    }
    
    // Obtener IP real del cliente (no usar 'auto' - Halliday requiere IP válida)
    let clientIp = customer_ip_address;
    if (!clientIp || clientIp === 'auto') {
      // Intentar obtener IP real del request
      // x-forwarded-for puede tener múltiples IPs (proxy, load balancer)
      const forwardedFor = req.headers['x-forwarded-for'];
      if (forwardedFor) {
        const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
        clientIp = ips.split(',')[0].trim();
      } else {
        clientIp = req.headers['x-real-ip']?.toString() || 
                   req.socket.remoteAddress || 
                   '8.8.8.8'; // Fallback a IP pública genérica (mejor que 0.0.0.0)
      }
    }
    payload.customer_ip_address = clientIp;

    console.log('📤 Enviando request a Halliday:', JSON.stringify(payload, null, 2));

    const response = await axios.post(
      `${HALLIDAY_API_URL}/payments/quotes`,
      payload,
      {
        headers: getAuthHeaders(),
      }
    );
    
    res.json({ success: true, data: response.data });
  } catch (error: any) {
    console.error('❌ Error obteniendo quotes de Halliday:', error.response?.data || error.message);
    
    // Proporcionar información más detallada del error
    const errorDetails = error.response?.data;
    const errorMessage = errorDetails?.errors?.[0]?.message || 
                        errorDetails?.message || 
                        error.message || 
                        'Error obteniendo quotes';

    res.status(error.response?.status || 500).json({
      success: false,
      error: errorMessage,
      details: errorDetails,
    });
  }
});

// Confirmar un pago
router.post('/confirm', async (req, res) => {
  try {
    const { payment_id, state_token, owner_address, destination_address } = req.body;

    if (!payment_id || !state_token || !owner_address || !destination_address) {
      return res.status(400).json({
        success: false,
        error: 'payment_id, state_token, owner_address y destination_address son requeridos',
      });
    }

    const response = await axios.post(
      `${HALLIDAY_API_URL}/payments/confirm`,
      {
        payment_id,
        state_token,
        owner_address,
        destination_address,
      },
      {
        headers: getAuthHeaders(),
      }
    );
    res.json({ success: true, data: response.data });
  } catch (error: any) {
    console.error('Error confirmando pago en Halliday:', error);
    res.status(500).json({
      success: false,
      error: error.response?.data?.message || error.message || 'Error confirmando pago',
    });
  }
});

// Obtener estado de un pago
router.get('/payments/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;

    const response = await axios.get(`${HALLIDAY_API_URL}/payments/${paymentId}`, {
      headers: getAuthHeaders(),
    });
    res.json({ success: true, data: response.data });
  } catch (error: any) {
    console.error('Error obteniendo estado del pago:', error);
    res.status(500).json({
      success: false,
      error: error.response?.data?.message || error.message || 'Error obteniendo estado del pago',
    });
  }
});

export { router as hallidayRouter };

