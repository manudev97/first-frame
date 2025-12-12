import { useState } from 'react';
import axios from 'axios';
import Navigation from '../components/Navigation';
import './Report.css';

// CRÍTICO: En producción, VITE_API_URL DEBE estar configurado en Vercel
// En desarrollo, usa el proxy de Vite (/api)
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : '');

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
        <h2>✅ Dispute Created</h2>
        <p>Your report has been sent and will be reviewed by arbitrators.</p>
      </div>
    );
  }

  return (
    <div className="report">
      <Navigation title="Report Infringement" />
      
      <form onSubmit={handleSubmit} className="report-form">
        <div className="form-group">
          <label>Infringer IP ID</label>
          <input
            type="text"
            value={targetIpId}
            onChange={(e) => setTargetIpId(e.target.value)}
            placeholder="0x..."
            required
          />
        </div>

        <div className="form-group">
          <label>Dispute Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          >
            <option value="">Select a reason</option>
            <option value="IMPROPER_USAGE">Improper Usage</option>
            <option value="IMPROPER_PAYMENT">Improper Payment</option>
            <option value="CONTENT_STANDARD_VIOLATION">Content Standard Violation</option>
            <option value="PLAGIARISM">Plagiarism</option>
          </select>
        </div>

        <div className="form-group">
          <label>Evidence (URL or description)</label>
          <textarea
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="Provide evidence of the infringement..."
            rows={4}
            required
          />
        </div>

        <button type="submit" disabled={loading} className="btn-report">
          {loading ? 'Sending...' : '📝 Send Report'}
        </button>
      </form>
    </div>
  );
}

export default Report;

