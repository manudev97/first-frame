import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// CRÍTICO: Remover loading spinner INMEDIATAMENTE antes de renderizar React
// Esto es esencial para evitar el bucle de carga en Telegram Mini App
const rootElement = document.getElementById('root');
if (rootElement) {
  const loadingElement = rootElement.querySelector('.initial-loading');
  if (loadingElement) {
    // Remover INMEDIATAMENTE sin delay - esto es crítico para Telegram Mini App
    loadingElement.remove();
  }
}

// Renderizar inmediatamente sin StrictMode para mejor rendimiento inicial
// StrictMode puede causar doble renderizado que ralentiza la carga
ReactDOM.createRoot(rootElement!).render(
  <App />
);

