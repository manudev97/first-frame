// Integración con Halliday Payments para pagos sin fricción
// Nota: Halliday se carga desde CDN en el frontend, no como paquete npm
export interface HallidayConfig {
  apiKey: string;
  outputs: string[];
  windowType: 'MODAL' | 'POPUP' | 'EMBED';
}

export function getHallidayScript() {
  return 'https://cdn.jsdelivr.net/npm/@halliday-sdk/payments@latest/dist/paymentsWidget/index.umd.min.js';
}

