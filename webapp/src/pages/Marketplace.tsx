import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './Marketplace.css';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3001/api');

interface IPAsset {
  ipId: string;
  title: string;
  year?: number;
  posterUrl?: string;
  description?: string;
  imdbId?: string;
  createdAt: string;
}

function Marketplace() {
  const [items, setItems] = useState<IPAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadMarketplace();
  }, []);

  const loadMarketplace = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/marketplace/list`);
      if (response.data.success && response.data.items) {
        setItems(response.data.items);
      }
    } catch (error: any) {
      console.error('Error cargando marketplace:', error);
      // Por ahora, mostrar mensaje informativo
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadMarketplace();
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/marketplace/search`, {
        params: { query: searchQuery },
      });
      if (response.data.success && response.data.results) {
        setItems(response.data.results);
      }
    } catch (error: any) {
      console.error('Error buscando:', error);
      alert('Error al buscar: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="marketplace">
      <h2>🎬 Marketplace de IPs</h2>
      
      <div className="marketplace-search">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Buscar película o serie..."
          className="search-input"
        />
        <button onClick={handleSearch} className="btn-primary">
          🔍 Buscar
        </button>
      </div>

      {loading ? (
        <div className="loading">Cargando...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p>📦 No hay IPs registrados aún</p>
          <p>¡Sé el primero en registrar un video!</p>
          <Link to="/upload" className="btn-primary">
            📤 Registrar IP
          </Link>
        </div>
      ) : (
        <div className="marketplace-grid">
          {items.map((item) => (
            <Link
              key={item.ipId}
              to={`/puzzle?ipId=${item.ipId}&poster=${encodeURIComponent(item.posterUrl || '')}&title=${encodeURIComponent(item.title)}&year=${item.year || ''}`}
              className="marketplace-item"
            >
              {item.posterUrl ? (
                <img src={item.posterUrl} alt={item.title} className="item-poster" />
              ) : (
                <div className="item-poster-placeholder">🎬</div>
              )}
              <div className="item-info">
                <h3>{item.title}</h3>
                {item.year && <p className="item-year">{item.year}</p>}
                {item.description && (
                  <p className="item-description">{item.description.substring(0, 100)}...</p>
                )}
                <div className="item-footer">
                  <span className="item-id">{item.ipId.substring(0, 10)}...</span>
                  <button className="btn-play">🧩 Jugar Puzzle</button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default Marketplace;

