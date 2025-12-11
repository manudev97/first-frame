import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Navigation from '../components/Navigation';
import './Marketplace.css';

// CRÍTICO: En producción, VITE_API_URL DEBE estar configurado en Vercel
// En desarrollo, usa el proxy de Vite (/api)
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : '');

interface IPAsset {
  ipId: string;
  title: string;
  year?: number;
  posterUrl?: string;
  description?: string;
  imdbId?: string;
  createdAt: string;
  channelMessageId?: string;
  videoFileId?: string;
}

function Marketplace() {
  const [disponible, setDisponible] = useState<IPAsset[]>([]);
  const [noDisponible, setNoDisponible] = useState<IPAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'disponible' | 'noDisponible'>('disponible');

  useEffect(() => {
    loadMarketplace();
  }, []);

  const loadMarketplace = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/marketplace/list`);
      
      if (response.data.success) {
        // Usar las nuevas secciones si están disponibles
        if (response.data.disponible && response.data.noDisponible) {
          setDisponible(response.data.disponible);
          setNoDisponible(response.data.noDisponible);
        } else if (response.data.items) {
          // Fallback: separar manualmente si la API no devuelve las secciones
          const items = response.data.items as IPAsset[];
          const disponibleItems = items.filter(item => item.channelMessageId || item.videoFileId);
          const noDisponibleItems = items.filter(item => !item.channelMessageId && !item.videoFileId);
          setDisponible(disponibleItems);
          setNoDisponible(noDisponibleItems);
        }
      }
    } catch (error: any) {
      console.error('Error cargando marketplace:', error);
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
        const results = response.data.results as IPAsset[];
        const disponibleItems = results.filter(item => item.channelMessageId || item.videoFileId);
        const noDisponibleItems = results.filter(item => !item.channelMessageId && !item.videoFileId);
        setDisponible(disponibleItems);
        setNoDisponible(noDisponibleItems);
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
      <Navigation title="Marketplace" />
      
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

      {/* Tabs para Contenido Disponible y No Disponible */}
      <div className="marketplace-tabs" style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid var(--border-color)' }}>
        <button
          className={`tab-button ${activeTab === 'disponible' ? 'active' : ''}`}
          onClick={() => setActiveTab('disponible')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: activeTab === 'disponible' ? 'var(--primary-color)' : 'transparent',
            color: activeTab === 'disponible' ? 'white' : 'var(--text-primary)',
            cursor: 'pointer',
            borderBottom: activeTab === 'disponible' ? '3px solid var(--primary-color)' : '3px solid transparent',
            fontWeight: activeTab === 'disponible' ? 'bold' : 'normal',
          }}
        >
          ✅ Contenido Disponible ({disponible.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'noDisponible' ? 'active' : ''}`}
          onClick={() => setActiveTab('noDisponible')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: activeTab === 'noDisponible' ? 'var(--primary-color)' : 'transparent',
            color: activeTab === 'noDisponible' ? 'white' : 'var(--text-primary)',
            cursor: 'pointer',
            borderBottom: activeTab === 'noDisponible' ? '3px solid var(--primary-color)' : '3px solid transparent',
            fontWeight: activeTab === 'noDisponible' ? 'bold' : 'normal',
          }}
        >
          ⏳ No Disponible ({noDisponible.length})
        </button>
      </div>

      {loading ? (
        <div className="loading">Cargando...</div>
      ) : (activeTab === 'disponible' ? disponible : noDisponible).length === 0 ? (
        <div className="empty-state">
          <p>📦 No hay {activeTab === 'disponible' ? 'contenido disponible' : 'contenido no disponible'} aún</p>
          {activeTab === 'noDisponible' && (
            <p>Estos IPs están registrados pero aún no tienen video en el canal</p>
          )}
        </div>
      ) : (
        <div className="marketplace-grid">
          {(activeTab === 'disponible' ? disponible : noDisponible).map((item) => (
            <Link
              key={item.ipId}
              to={`/puzzle?ipId=${item.ipId}&poster=${encodeURIComponent(item.posterUrl || '')}&title=${encodeURIComponent(item.title)}&year=${item.year || ''}`}
              className="marketplace-item"
            >
              {item.posterUrl && item.posterUrl.trim() !== '' ? (
                <img src={item.posterUrl} alt={item.title} className="item-poster" />
              ) : (
                <div className="item-poster-placeholder">
                  <div className="placeholder-icon">🎬</div>
                  <div className="placeholder-text">{item.title}</div>
                </div>
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

