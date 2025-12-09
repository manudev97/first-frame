// Servicio para obtener todos los tokens del contrato SPGNFT y sus metadatos
import { createPublicClient, http } from 'viem';
import dotenv from 'dotenv';
import axios from 'axios';
import { loadRegisteredIPs, saveRegisteredIP, type RegisteredIP } from './ipRegistry';

dotenv.config();

/**
 * Obtiene el total supply del contrato ERC721
 */
async function getTotalSupply(spgNftContract: `0x${string}`): Promise<bigint> {
  const publicClient = createPublicClient({
    transport: http(process.env.STORY_RPC_URL!),
  });

  const erc721Abi = [
    {
      inputs: [],
      name: 'totalSupply',
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    },
  ] as const;

  const totalSupply = await publicClient.readContract({
    address: spgNftContract,
    abi: erc721Abi,
    functionName: 'totalSupply',
  });

  return totalSupply;
}

/**
 * Obtiene el tokenURI de un token específico
 */
async function getTokenURI(
  spgNftContract: `0x${string}`,
  tokenId: bigint
): Promise<string | null> {
  const publicClient = createPublicClient({
    transport: http(process.env.STORY_RPC_URL!),
  });

  const erc721Abi = [
    {
      inputs: [{ name: 'tokenId', type: 'uint256' }],
      name: 'tokenURI',
      outputs: [{ name: '', type: 'string' }],
      stateMutability: 'view',
      type: 'function',
    },
  ] as const;

  try {
    const tokenURI = await publicClient.readContract({
      address: spgNftContract,
      abi: erc721Abi,
      functionName: 'tokenURI',
      args: [tokenId],
    });

    return tokenURI as string;
  } catch (error: any) {
    console.warn(`⚠️  Error obteniendo tokenURI para token ${tokenId}:`, error.message);
    return null;
  }
}

/**
 * Obtiene metadatos desde IPFS
 * Intenta múltiples gateways si uno falla
 */
async function fetchMetadataFromIPFS(ipfsUri: string): Promise<any | null> {
  // Lista de gateways de IPFS a intentar
  const gateways = [
    'https://ipfs.io/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/',
  ];
  
  if (ipfsUri.startsWith('ipfs://')) {
    const ipfsHash = ipfsUri.replace('ipfs://', '');
    
    // Intentar cada gateway
    for (const gateway of gateways) {
      try {
        const url = `${gateway}${ipfsHash}`;
        const response = await axios.get(url, { 
          timeout: 10000,
          headers: {
            'Accept': 'application/json',
          },
        });
        
        if (response.data) {
          console.log(`✅ Metadatos obtenidos desde ${gateway}`);
          return response.data;
        }
      } catch (error: any) {
        // Continuar con el siguiente gateway si este falla
        continue;
      }
    }
    
    // Si todos los gateways fallan, retornar null
    console.warn(`⚠️  No se pudieron obtener metadatos desde IPFS (${ipfsUri}) después de intentar ${gateways.length} gateways`);
    return null;
  }
  
  // Si no es una URI de IPFS, intentar directamente
  try {
    const response = await axios.get(ipfsUri, { timeout: 10000 });
    return response.data;
  } catch (error: any) {
    console.warn(`⚠️  Error obteniendo metadatos desde URL (${ipfsUri}):`, error.message);
    return null;
  }
}

/**
 * Obtiene el IP ID desde eventos de registro
 * Usa el address del contrato como IP ID si no se encuentra en eventos
 */
async function getIPIdFromTokenId(
  spgNftContract: `0x${string}`,
  tokenId: bigint
): Promise<string> {
  const publicClient = createPublicClient({
    transport: http(process.env.STORY_RPC_URL!),
  });

  // Buscar eventos IPAssetRegistered que contengan este tokenId
  const ipAssetRegisteredAbi = [
    {
      anonymous: false,
      inputs: [
        { indexed: true, name: 'ipId', type: 'address' },
        { indexed: true, name: 'nftContract', type: 'address' },
        { indexed: true, name: 'tokenId', type: 'uint256' },
        { indexed: false, name: 'metadataURI', type: 'string' },
      ],
      name: 'IPAssetRegistered',
      type: 'event',
    },
  ] as const;

  try {
    const currentBlock = await publicClient.getBlockNumber();
    const fromBlock = currentBlock > 200000n ? currentBlock - 200000n : 0n;

    // Buscar en el contrato IPAssetRegistry (no en el NFT contract)
    // El evento IPAssetRegistered se emite desde el IPAssetRegistry
    // Necesitamos buscar en todos los logs, no solo del contrato NFT
    const logs = await publicClient.getLogs({
      event: ipAssetRegisteredAbi[0],
      args: {
        tokenId: tokenId,
        nftContract: spgNftContract,
      },
      fromBlock,
      toBlock: 'latest',
    });

    if (logs.length > 0) {
      const ipId = logs[0].args.ipId as string;
      console.log(`✅ IP ID encontrado para token ${tokenId}: ${ipId}`);
      return ipId;
    }
  } catch (error: any) {
    console.warn(`⚠️  Error obteniendo IP ID para token ${tokenId}:`, error.message);
  }

  // Fallback: usar el address del contrato como IP ID
  // En Story Protocol, el IP ID puede ser calculado, pero por ahora usamos el contrato
  console.log(`⚠️  Usando contrato como IP ID para token ${tokenId}`);
  return spgNftContract;
}

/**
 * Obtiene todos los tokens del contrato SPGNFT y sus metadatos
 * Solo incluye tokens que tengan posterUrl en sus metadatos
 */
export async function getAllTokensFromContract(): Promise<RegisteredIP[]> {
  try {
    if (!process.env.STORY_RPC_URL) {
      throw new Error('STORY_RPC_URL no está configurado');
    }

    if (!process.env.STORY_SPG_NFT_CONTRACT) {
      throw new Error('STORY_SPG_NFT_CONTRACT no está configurado');
    }

    const spgNftContract = process.env.STORY_SPG_NFT_CONTRACT as `0x${string}`;
    const publicClient = createPublicClient({
      transport: http(process.env.STORY_RPC_URL),
    });

    console.log('🔍 Obteniendo total supply del contrato SPGNFT...');
    const totalSupply = await getTotalSupply(spgNftContract);
    console.log(`✅ Total supply: ${totalSupply.toString()}`);

    const allTokens: RegisteredIP[] = [];
    const registryIPs = await loadRegisteredIPs();
    
    // Crear un mapa de tokens del registry para búsqueda rápida
    const registryMap = new Map<string, RegisteredIP>();
    registryIPs.forEach(ip => {
      if (ip.tokenId) {
        registryMap.set(ip.tokenId, ip);
      }
    });

    // OPTIMIZACIÓN: Procesar tokens en lotes para mejorar rendimiento
    const BATCH_SIZE = 10; // Procesar 10 tokens a la vez
    const totalSupplyNum = Number(totalSupply);
    
    console.log(`🚀 Procesando ${totalSupplyNum} tokens en lotes de ${BATCH_SIZE}...`);

    // Primero, agregar todos los tokens que ya están en el registry
    for (const ip of registryIPs) {
      if (ip.posterUrl && ip.tokenId) {
        allTokens.push(ip);
      }
    }
    
    console.log(`✅ ${allTokens.length} tokens ya en registry`);

    // OPTIMIZACIÓN: Solo procesar tokens que no están en el registry o que necesitan actualización
    // Esto reduce significativamente el tiempo de carga
    const tokensToProcess: bigint[] = [];
    for (let i = 1; i <= totalSupplyNum; i++) {
      const tokenId = BigInt(i);
      const tokenIdStr = tokenId.toString();
      
      // Solo procesar si no está en el registry o no tiene poster
      const existingIP = registryMap.get(tokenIdStr);
      if (!existingIP || !existingIP.posterUrl) {
        tokensToProcess.push(tokenId);
      }
    }
    
    console.log(`🔍 Procesando ${tokensToProcess.length} tokens nuevos desde blockchain...`);
    
    // Si hay muchos tokens, procesar solo los primeros 50 para optimizar
    const MAX_TOKENS_TO_PROCESS = 50;
    const tokensToProcessLimited = tokensToProcess.slice(0, MAX_TOKENS_TO_PROCESS);
    
    if (tokensToProcess.length > MAX_TOKENS_TO_PROCESS) {
      console.log(`⚠️  Limitando procesamiento a ${MAX_TOKENS_TO_PROCESS} tokens para optimizar rendimiento`);
      console.log(`💡 Los tokens restantes se procesarán en cargas posteriores`);
    }

    // Procesar en lotes
    for (let i = 0; i < tokensToProcessLimited.length; i += BATCH_SIZE) {
      const batch = tokensToProcessLimited.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (tokenId) => {
        try {
          const tokenIdNum = Number(tokenId);
          const existingIP = registryMap.get(tokenId.toString());

          // Obtener tokenURI
          const tokenURI = await getTokenURI(spgNftContract, tokenId);
          if (!tokenURI) {
            return null;
          }

          // Obtener metadatos desde IPFS
          const metadata = await fetchMetadataFromIPFS(tokenURI);
          if (!metadata) {
            return null;
          }

          // Verificar que tenga imagen (posterUrl)
          const imageUrl = metadata.image || metadata.posterUrl;
          if (!imageUrl) {
            return null;
          }

          // Obtener IP ID
          const ipId = await getIPIdFromTokenId(spgNftContract, tokenId);

          // Crear objeto RegisteredIP
          const registeredIP: RegisteredIP = {
            ipId: ipId,
            tokenId: tokenId.toString(),
            title: metadata.name || metadata.title || `Token #${tokenIdNum}`,
            year: metadata.year,
            posterUrl: imageUrl,
            description: metadata.description,
            imdbId: metadata.imdbId,
            metadataUri: tokenURI,
            nftMetadataUri: tokenURI,
            txHash: existingIP?.txHash || '',
            createdAt: existingIP?.createdAt || new Date().toISOString(),
          };

          // Preservar información del canal si existe
          if (existingIP) {
            registeredIP.uploader = existingIP.uploader;
            registeredIP.uploaderName = existingIP.uploaderName;
            registeredIP.channelMessageId = existingIP.channelMessageId;
            registeredIP.videoFileId = existingIP.videoFileId;
          }

          // Guardar en registry si no existe
          if (!existingIP) {
            await saveRegisteredIP(registeredIP);
          }

          return registeredIP;
        } catch (error: any) {
          console.warn(`⚠️  Error procesando token ${tokenId}:`, error.message);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      const validResults = batchResults.filter((ip): ip is RegisteredIP => ip !== null);
      allTokens.push(...validResults);
      
      console.log(`✅ Lote ${Math.floor(i / BATCH_SIZE) + 1} completado: ${validResults.length} tokens agregados`);
    }

    console.log(`\n✅ Total tokens procesados: ${allTokens.length}`);
    return allTokens;
  } catch (error: any) {
    console.error('❌ Error obteniendo tokens del contrato:', error);
    throw error;
  }
}

