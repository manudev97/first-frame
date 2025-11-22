import { useEffect } from 'react';
import './HallidayButton.css';

declare global {
  interface Window {
    hallidayPayments?: {
      openHallidayPayments: (config: {
        apiKey: string;
        outputs: string[];
        windowType: 'MODAL' | 'POPUP' | 'EMBED';
      }) => void;
    };
  }
}

interface HallidayButtonProps {
  apiKey: string;
  outputs: string[];
  onSuccess?: () => void;
}

function HallidayButton({ apiKey, outputs, onSuccess }: HallidayButtonProps) {
  useEffect(() => {
    // Cargar script de Halliday si no está cargado
    if (!window.hallidayPayments) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@halliday-sdk/payments@latest/dist/paymentsWidget/index.umd.min.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const handleClick = () => {
    if (window.hallidayPayments) {
      window.hallidayPayments.openHallidayPayments({
        apiKey,
        outputs,
        windowType: 'MODAL',
      });
      
      if (onSuccess) {
        onSuccess();
      }
    }
  };

  return (
    <button className="halliday-button" onClick={handleClick}>
      <span className="halliday-icon">💳</span>
      Pagar con Halliday
    </button>
  );
}

export default HallidayButton;

