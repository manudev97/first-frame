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
      console.error('❌ OMDB_API_KEY no está configurado en el backend');
      console.error('   Verifica que OMDB_API_KEY esté en tu archivo .env del proyecto raíz');
      console.error('   Obtén una API key gratuita en: http://www.omdbapi.com/apikey.aspx');
      return res.status(400).json({ 
        success: false, 
        error: 'OMDB_API_KEY no está configurado. Verifica que esté en tu archivo .env del proyecto raíz. Obtén una API key gratuita en http://www.omdbapi.com/apikey.aspx' 
      });
    }
    
    console.log('✅ OMDB_API_KEY encontrado (longitud:', apiKey.length, 'caracteres)');
    
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

    // Obtener URL del póster en máxima calidad
    // OMDB devuelve URLs como "http://img.omdbapi.com/?apikey=xxx&i=tt..."
    // o URLs directas a imágenes que pueden ser pequeñas
    let posterUrl = response.data.Poster;
    
    // Si tenemos imdbID, intentar obtener imagen de mayor calidad de IMDB directamente
    if (response.data.imdbID && posterUrl && posterUrl !== 'N/A') {
      // OMDB a veces devuelve URLs pequeñas, intentar obtener de TMDb o IMDB directamente
      // Para mejor calidad, intentar obtener desde TMDb que tiene mejores imágenes
      try {
        // Intentar usar el ID de IMDB para obtener imagen de mayor calidad
        // Las imágenes de IMDB están en formato: https://www.imdb.com/title/tt1234567/mediaviewer/...
        // Pero es más fácil usar TMDb API si está disponible, o simplemente mejorar la URL de OMDB
        
        // Si la URL contiene parámetros de OMDB, intentar obtener la imagen directa
        if (posterUrl.includes('omdbapi.com')) {
          // OMDB puede devolver URLs de baja calidad, intentar extraer mejor URL
          // Por ahora, usar la URL tal cual pero asegurar que sea HTTPS
          posterUrl = posterUrl.replace('http://', 'https://');
        } else if (posterUrl.includes('m.media-amazon.com') || posterUrl.includes('ia.media-imdb.com')) {
          // Estas son URLs de Amazon/IMDB - ya son de buena calidad
          // Asegurar HTTPS
          posterUrl = posterUrl.replace('http://', 'https://');
          // Intentar aumentar calidad cambiando parámetros de URL si existen
          // Las URLs de IMDB suelen tener tamaños definidos en el path
          // Reemplazar tamaños pequeños por originales o grandes
          posterUrl = posterUrl
            .replace(/_V1_SX300\./g, '_V1_SX1000.') // De 300px a 1000px
            .replace(/_V1_SX150\./g, '_V1_SX1000.')
            .replace(/_V1_UX182\./g, '_V1_SX1000.')
            .replace(/_V1_UX300\./g, '_V1_SX1000.')
            .replace(/\._V1_/g, '._V1_SX1000.'); // Si no tiene tamaño, agregar SX1000
        }
      } catch (error) {
        console.warn('No se pudo mejorar la calidad de la imagen, usando URL original');
      }
    }

    res.json({
      success: true,
      data: {
        title: response.data.Title,
        year: response.data.Year,
        poster: posterUrl !== 'N/A' ? posterUrl : null,
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

