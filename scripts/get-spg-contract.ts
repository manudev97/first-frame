/**
 * Script para obtener o crear el contrato SPG NFT
 * 
 * Uso:
 *   npm run get-spg-contract
 * 
 * Este script crea un nuevo contrato SPG NFT para tu colección
 */

import { createStoryClient } from '../src/backend/services/storyClient';
import { zeroAddress } from 'viem';
import dotenv from 'dotenv';

dotenv.config();

async function getOrCreateSPGContract() {
  try {
    console.log('🔍 Inicializando cliente de Story Protocol...\n');
    const client = await createStoryClient();
    
    console.log('📝 Creando nueva colección SPG NFT...');
    console.log('   (Esto creará tu propia colección NFT)\n');
    
    // Verificar que el cliente tenga nftClient
    if (!client.nftClient) {
      throw new Error('El cliente no tiene nftClient disponible. Verifica la versión del SDK.');
    }

    const newCollection = await client.nftClient.createNFTCollection({
      name: 'FirstFrame IP Collection',
      symbol: 'FFIP',
      isPublicMinting: true,
      mintOpen: true,
      mintFeeRecipient: zeroAddress,
      contractURI: '',
    });
    
    console.log('✅ Colección creada exitosamente!\n');
    console.log('📋 Información del contrato:');
    console.log('   Transaction Hash:', newCollection.txHash);
    console.log('   Contract Address:', newCollection.spgNftContract);
    console.log('\n💡 Agrega esta dirección a tu archivo .env:');
    console.log(`   STORY_SPG_NFT_CONTRACT=${newCollection.spgNftContract}\n`);
    
    return newCollection.spgNftContract;
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('private key') || error.message.includes('STORY_PRIVATE_KEY')) {
      console.error('\n⚠️  Asegúrate de tener configurado STORY_PRIVATE_KEY en tu .env');
      console.error('   Formato: 0x + 64 caracteres hexadecimales');
    }
    
    if (error.message.includes('RPC') || error.message.includes('STORY_RPC_URL')) {
      console.error('\n⚠️  Verifica que STORY_RPC_URL esté correctamente configurado');
      console.error('   Para testnet: https://aeneid.storyrpc.io');
    }

    if (error.message.includes('nftClient')) {
      console.error('\n⚠️  El SDK puede no tener nftClient. Verifica la versión del SDK.');
    }
    
    console.error('\n📚 Para más ayuda, consulta: docs/SPG_NFT_CONTRACT.md');
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  getOrCreateSPGContract()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { getOrCreateSPGContract };
