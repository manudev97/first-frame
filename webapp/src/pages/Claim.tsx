import { useState } from 'react';
import axios from 'axios';
import Navigation from '../components/Navigation';
import './Claim.css';

// CRÍTICO: En producción, VITE_API_URL DEBE estar configurado en Vercel
// En desarrollo, usa el proxy de Vite (/api)
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : '');

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
      <Navigation title="Claim Royalties" />
      
      <div className="claim-info">
        <div className="claim-amount">
          <div className="amount-label">Pending Royalties</div>
          <div className="amount-value">0 $IP</div>
        </div>
        
        <p className="claim-description">
          Your royalties are automatically distributed according to the license terms defined in Story Protocol.
        </p>
      </div>

      <button 
        onClick={handleClaim} 
        disabled={loading || success}
        className="btn-claim"
      >
        {loading ? 'Processing...' : success ? '✅ Claimed' : '💳 Claim Royalties'}
      </button>

      {success && (
        <div className="claim-success">
          <p>✅ Royalties claimed successfully</p>
        </div>
      )}
    </div>
  );
}

export default Claim;

