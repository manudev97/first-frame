import { useState } from 'react';
import axios from 'axios';
import './Claim.css';

// Usar proxy de Vite en desarrollo, o URL configurada en producción
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3001/api');

function Claim() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleClaim = async () => {
    setLoading(true);
    try {
      // Aquí se reclamarían las regalías desde Story Protocol
      const response = await axios.post(`${API_URL}/story/claim-royalty`, {
        ipId: '0x...', // IP ID del usuario
      });
      
      setSuccess(true);
    } catch (error: any) {
      console.error('Error reclamando regalías:', error);
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="claim">
      <h2>💰 Reclamar Regalías</h2>
      
      <div className="claim-info">
        <div className="claim-amount">
          <div className="amount-label">Regalías Pendientes</div>
          <div className="amount-value">0 $IP</div>
        </div>
        
        <p className="claim-description">
          Tus regalías se distribuyen automáticamente según los términos de licencia definidos en Story Protocol.
        </p>
      </div>

      <button 
        onClick={handleClaim} 
        disabled={loading || success}
        className="btn-claim"
      >
        {loading ? 'Procesando...' : success ? '✅ Reclamado' : '💳 Reclamar Regalías'}
      </button>

      {success && (
        <div className="claim-success">
          <p>✅ Regalías reclamadas exitosamente</p>
        </div>
      )}
    </div>
  );
}

export default Claim;

