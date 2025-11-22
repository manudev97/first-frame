import { Router } from 'express';
import axios from 'axios';

const router = Router();

// Obtener información de película/serie de OMDB
router.get('/movie/:title/:year', async (req, res) => {
  try {
    const { title, year } = req.params;
    let apiKey = process.env.OMDB_API_KEY;
    
    // Limpiar la API key si viene con URL completa
    if (apiKey && apiKey.includes('http')) {
      const match = apiKey.match(/apikey=([^&]+)/);
      if (match) {
        apiKey = match[1];
      }
    }
    
    if (!apiKey || apiKey === 'your_omdb_api_key_here') {
      return res.status(400).json({ 
        success: false, 
        error: 'OMDB_API_KEY no está configurado. Obtén una API key gratuita en http://www.omdbapi.com/apikey.aspx' 
      });
    }
    
    const response = await axios.get('http://www.omdbapi.com/', {
      params: {
        apikey: apiKey,
        t: decodeURIComponent(title),
        y: year,
        plot: 'short',
      },
    });

    if (response.data.Response === 'False') {
      return res.status(404).json({ success: false, error: 'Película no encontrada' });
    }

    res.json({
      success: true,
      data: {
        title: response.data.Title,
        year: response.data.Year,
        poster: response.data.Poster,
        plot: response.data.Plot,
        imdbId: response.data.imdbID,
        genre: response.data.Genre,
        director: response.data.Director,
        actors: response.data.Actors,
      },
    });
  } catch (error: any) {
    console.error('Error obteniendo datos de IMDB:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Buscar película/serie
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    let apiKey = process.env.OMDB_API_KEY;
    
    // Limpiar la API key si viene con URL completa
    if (apiKey && apiKey.includes('http')) {
      const match = apiKey.match(/apikey=([^&]+)/);
      if (match) {
        apiKey = match[1];
      }
    }
    
    if (!apiKey || apiKey === 'your_omdb_api_key_here') {
      return res.status(400).json({ 
        success: false, 
        error: 'OMDB_API_KEY no está configurado' 
      });
    }
    
    const response = await axios.get('http://www.omdbapi.com/', {
      params: {
        apikey: apiKey,
        s: decodeURIComponent(query),
        type: 'movie',
      },
    });

    if (response.data.Response === 'False') {
      return res.status(404).json({ success: false, error: 'No se encontraron resultados' });
    }

    res.json({
      success: true,
      results: response.data.Search.map((item: any) => ({
        title: item.Title,
        year: item.Year,
        imdbId: item.imdbID,
        poster: item.Poster,
        type: item.Type,
      })),
    });
  } catch (error: any) {
    console.error('Error buscando en IMDB:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as imdbRouter };

