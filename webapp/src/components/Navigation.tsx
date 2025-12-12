import { useNavigate, useLocation } from 'react-router-dom';
import './Navigation.css';

interface NavigationProps {
  title?: string;
  showBack?: boolean;
}

function Navigation({ title, showBack = true }: NavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // No mostrar botón de atrás en la página principal
  const shouldShowBack = showBack && location.pathname !== '/';

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <nav className="app-navigation">
      {shouldShowBack && (
          <button className="nav-back-btn" onClick={handleBack} aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
      )}
      {title && <h1 className="nav-title">{title}</h1>}
      <div className="nav-logo">
        <img src="/logo.png" alt="FirstFrame" onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
        }} />
      </div>
    </nav>
  );
}

export default Navigation;

