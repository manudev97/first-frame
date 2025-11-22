import { Link } from 'react-router-dom';
import './Home.css';

function Home() {
  return (
    <div className="home">
      <div className="hero">
        <div className="logo-container">
          <img 
            src="/logo.png" 
            alt="FirstFrame Logo" 
            className="logo"
            onError={(e) => {
              // Si el logo no existe, ocultar la imagen silenciosamente
              const target = e.target as HTMLImageElement;
              if (target.parentElement) {
                target.parentElement.style.display = 'none';
              }
            }}
          />
        </div>
        <h1>🎬 FirstFrame</h1>
        <p>Protege tu contenido audiovisual con blockchain</p>
      </div>

      <div className="actions">
        <Link to="/upload" className="action-card purple">
          <div className="icon">📤</div>
          <h3>Subir Video</h3>
          <p>Registra tu contenido como IP</p>
        </Link>

        <Link to="/marketplace" className="action-card green-lila">
          <div className="icon">🛒</div>
          <h3>Marketplace</h3>
          <p>Explorar IPs registrados</p>
        </Link>

        <Link to="/puzzle" className="action-card green-lila">
          <div className="icon">🧩</div>
          <h3>Resolver Puzzle</h3>
          <p>Gana acceso exclusivo</p>
        </Link>

        <Link to="/profile" className="action-card purple-light">
          <div className="icon">👤</div>
          <h3>Mi Perfil</h3>
          <p>Ver mis IPs y regalías</p>
        </Link>

        <Link to="/claim" className="action-card purple">
          <div className="icon">💰</div>
          <h3>Reclamar</h3>
          <p>Obtener mis regalías</p>
        </Link>
      </div>
    </div>
  );
}

export default Home;

