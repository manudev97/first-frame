import axios from 'axios';
import crypto from 'crypto';

export interface IPMetadata {
  title: string;
  description: string;
  year?: number;
  image?: string; // Imagen principal del IP (póster de IMDB)
  imageHash?: string;
  media?: {
    type: string;
    url: string;
    hash?: string;
  };
  videoUrl?: string;
  videoSizeMB?: number;
  videoDurationMinutes?: number;
  videoFileName?: string;
  imdbId?: string;
  parentIpId?: string;
  creators: Array<{ name: string; address?: string; contribution?: number }>;
  createdAt: string;
}

// Metadata NFT en formato OpenSea/ERC721 estándar
export interface NFTMetadata {
  name: string;
  description: string;
  image: string; // URL del póster de IMDB
  external_url?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

export async function createIPMetadata(data: Partial<IPMetadata>): Promise<{ metadata: IPMetadata; hash: string }> {
  const metadata: IPMetadata = {
    title: data.title || 'Untitled',
    description: data.description || '',
    year: data.year,
    image: data.image, // Usar image (póster de IMDB)
    videoUrl: data.videoUrl,
    videoSizeMB: data.videoSizeMB,
    videoDurationMinutes: data.videoDurationMinutes,
    videoFileName: data.videoFileName,
    imdbId: data.imdbId,
    parentIpId: data.parentIpId,
    creators: data.creators || [],
    createdAt: new Date().toISOString(),
  };

  // Agregar media si hay video
  if (data.videoUrl) {
    metadata.media = {
      type: 'video',
      url: data.videoUrl,
    };
  }

  const metadataString = JSON.stringify(metadata);
  const hash = crypto.createHash('sha256').update(metadataString).digest('hex');

  return { metadata, hash: `0x${hash}` };
}

// Crear metadata NFT en formato OpenSea estándar
export async function createNFTMetadata(data: {
  name: string;
  description: string;
  image: string; // URL del póster de IMDB
  year?: number;
  imdbId?: string;
  external_url?: string;
}): Promise<{ metadata: NFTMetadata; hash: string }> {
  const attributes: Array<{ trait_type: string; value: string | number }> = [];
  
  if (data.year) {
    attributes.push({ trait_type: 'Year', value: data.year });
  }
  
  if (data.imdbId) {
    attributes.push({ trait_type: 'IMDB ID', value: data.imdbId });
  }

  // CRÍTICO: Asegurar que la imagen sea una URL válida y accesible
  // Si no hay imagen, usar un placeholder o fallback
  let imageUrl = data.image;
  if (!imageUrl || imageUrl === '' || imageUrl === 'N/A') {
    // Si no hay póster, usar un placeholder
    imageUrl = 'https://via.placeholder.com/300x450?text=No+Poster+Available';
    console.warn('⚠️  No hay póster disponible, usando placeholder');
  }
  
  // Asegurar que la URL sea HTTPS (los exploradores requieren HTTPS)
  if (imageUrl && imageUrl.startsWith('http://')) {
    imageUrl = imageUrl.replace('http://', 'https://');
  }

  const metadata: NFTMetadata = {
    name: data.name,
    description: data.description,
    image: imageUrl, // URL del póster de IMDB - esto es lo que muestra el explorador
    external_url: data.external_url,
    attributes,
  };
  
  // Log para debugging
  console.log('📸 NFT Metadata creado:', {
    name: metadata.name,
    image: metadata.image,
    hasImage: !!metadata.image && metadata.image !== '',
  });

  const metadataString = JSON.stringify(metadata);
  const hash = crypto.createHash('sha256').update(metadataString).digest('hex');

  return { metadata, hash: `0x${hash}` };
}

// Usar Pinata API para subir a IPFS (más confiable que ipfs-http-client)
async function uploadToIPFSViaPinata(content: string): Promise<string> {
  if (!process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_KEY) {
    throw new Error('PINATA_API_KEY y PINATA_SECRET_KEY son requeridos para subir a IPFS');
  }

  try {
    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      JSON.parse(content),
      {
        headers: {
          'Content-Type': 'application/json',
          'pinata_api_key': process.env.PINATA_API_KEY,
          'pinata_secret_api_key': process.env.PINATA_SECRET_KEY,
        },
      }
    );
    
    return `ipfs://${response.data.IpfsHash}`;
  } catch (error: any) {
    console.error('Error subiendo a Pinata:', error.response?.data || error.message);
    throw new Error('No se pudo subir a IPFS via Pinata');
  }
}

export async function uploadToIPFS(data: any): Promise<string> {
  try {
    // Si no hay Pinata configurado, retornar un URI simulado para desarrollo
    if (!process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_KEY) {
      console.warn('⚠️  Pinata no configurado. Usando URI simulado para desarrollo.');
      const hash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
      return `ipfs://simulated_${hash.substring(0, 16)}`;
    }
    
    const content = JSON.stringify(data);
    return await uploadToIPFSViaPinata(content);
  } catch (error: any) {
    console.error('Error subiendo a IPFS:', error);
    // En desarrollo, retornar URI simulado si falla
    if (process.env.NODE_ENV === 'development') {
      const hash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
      return `ipfs://dev_${hash.substring(0, 16)}`;
    }
    throw new Error('No se pudo subir a IPFS. Asegúrate de configurar PINATA_API_KEY y PINATA_SECRET_KEY');
  }
}
