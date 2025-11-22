// Utilidades para integración con Halliday Payments API
// Documentación: https://docs.halliday.xyz/pages/api-quickstart

const HALLIDAY_API_URL = 'https://v2.prod.halliday.xyz';

// Obtener API key desde variables de entorno o configuración
const getHallidayApiKey = (): string | null => {
  // En producción, esto debería venir del backend para seguridad
  // Por ahora, se usa desde el backend que tiene la key en .env
  return null; // Frontend no debe tener la API key directamente
};

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3001/api');

// Obtener assets soportados (desde backend)
export async function getSupportedAssets() {
  try {
    const response = await fetch(`${API_URL}/halliday/assets`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('Error obteniendo assets soportados');
    }
    
    const data = await response.json();
    return data.success ? data.data : data;
  } catch (error) {
    console.error('Error obteniendo assets:', error);
    throw error;
  }
}

// Iniciar un pago (quote) - desde backend
export async function initiatePayment(paymentRequest: {
  request: {
    kind: 'FIXED_INPUT';
    fixed_input_amount: {
      asset: string;
      amount: string;
    };
    output_asset: string;
  };
  price_currency?: string;
  onramps?: string[];
  onramp_methods?: string[];
  customer_ip_address?: string;
}) {
  try {
    const response = await fetch(`${API_URL}/halliday/quotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentRequest),
    });
    
    if (!response.ok) {
      throw new Error('Error obteniendo quotes');
    }
    
    const data = await response.json();
    return data.success ? data.data : data;
  } catch (error) {
    console.error('Error iniciando pago:', error);
    throw error;
  }
}

// Confirmar un pago - desde backend
export async function confirmPayment(confirmation: {
  payment_id: string;
  state_token: string;
  owner_address: string;
  destination_address: string;
}) {
  try {
    const response = await fetch(`${API_URL}/halliday/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(confirmation),
    });
    
    if (!response.ok) {
      throw new Error('Error confirmando pago');
    }
    
    const data = await response.json();
    return data.success ? data.data : data;
  } catch (error) {
    console.error('Error confirmando pago:', error);
    throw error;
  }
}

// Obtener estado de un pago - desde backend
export async function getPaymentStatus(paymentId: string) {
  try {
    const response = await fetch(`${API_URL}/halliday/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('Error obteniendo estado del pago');
    }
    
    const data = await response.json();
    return data.success ? data.data : data;
  } catch (error) {
    console.error('Error obteniendo estado del pago:', error);
    throw error;
  }
}

