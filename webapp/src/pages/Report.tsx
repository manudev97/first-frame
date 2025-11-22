import { useState } from 'react';
import axios from 'axios';
import Navigation from '../components/Navigation';
import './Report.css';

// Usar proxy de Vite en desarrollo, o URL configurada en producción
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3001/api');

function Report() {
  const [targetIpId, setTargetIpId] = useState('');
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/story/create-dispute`, {
        targetIpId,
        reason,
        evidence,
      });

      setSuccess(true);
      console.log('Disputa creada:', response.data);
    } catch (error: any) {
      console.error('Error creando disputa:', error);
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="report-success">
        <h2>✅ Disputa Creada</h2>
        <p>Tu reporte ha sido enviado y será revisado por los árbitros.</p>
      </div>
    );
  }

  return (
    <div className="report">
      <Navigation title="Reportar Infracción" />
      
      <form onSubmit={handleSubmit} className="report-form">
        <div className="form-group">
          <label>IP ID del Infractor</label>
          <input
            type="text"
            value={targetIpId}
            onChange={(e) => setTargetIpId(e.target.value)}
            placeholder="0x..."
            required
          />
        </div>

        <div className="form-group">
          <label>Razón de la Disputa</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          >
            <option value="">Selecciona una razón</option>
            <option value="IMPROPER_USAGE">Uso Impropio</option>
            <option value="IMPROPER_PAYMENT">Pago Impropio</option>
            <option value="CONTENT_STANDARD_VIOLATION">Violación de Estándares</option>
            <option value="PLAGIARISM">Plagio</option>
          </select>
        </div>

        <div className="form-group">
          <label>Evidencia (URL o descripción)</label>
          <textarea
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="Proporciona evidencia de la infracción..."
            rows={4}
            required
          />
        </div>

        <button type="submit" disabled={loading} className="btn-report">
          {loading ? 'Enviando...' : '📝 Enviar Reporte'}
        </button>
      </form>
    </div>
  );
}

export default Report;

