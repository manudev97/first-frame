import { Router } from 'express';
import { StoryClient } from '@story-protocol/core-sdk';
import { createStoryClient } from '../services/storyClient';
import { privateKeyToAccount } from 'viem/accounts';
import { saveRegisteredIP } from '../services/ipRegistry';

const router = Router();

// Registrar IP Asset
router.post('/register-ip', async (req, res) => {
  try {
    const { metadata } = req.body;
    // NO recibir licenseTerms aquí - se registrarán después para evitar el error
    // LicenseAttachmentWorkflows_NoLicenseTermsData
    
    if (!metadata || !metadata.uri || !metadata.hash) {
      return res.status(400).json({ 
        success: false, 
        error: 'Metadata con uri y hash son requeridos' 
      });
    }

    if (!process.env.STORY_SPG_NFT_CONTRACT) {
      return res.status(500).json({ 
        success: false, 
        error: 'STORY_SPG_NFT_CONTRACT no está configurado' 
      });
    }
    
    const client = await createStoryClient();
    
    // Obtener la dirección del recipient desde la private key
    if (!process.env.STORY_PRIVATE_KEY) {
      return res.status(500).json({ 
        success: false, 
        error: 'STORY_PRIVATE_KEY no está configurado' 
      });
    }
    
    const account = privateKeyToAccount(process.env.STORY_PRIVATE_KEY as `0x${string}`);
    const recipient = account.address;
    
    // Registrar IP Asset usando registerIpAsset (mint y register en una transacción)
    // IMPORTANTE: NO pasar licenseTermsData si está vacío para evitar el error
    // LicenseAttachmentWorkflows_NoLicenseTermsData
    // Los términos de licencia se registrarán después usando register-license
    const tx = await client.ipAsset.registerIpAsset({
      nft: {
        type: 'mint', // Tipo requerido: 'mint' para mint y register en una transacción
        spgNftContract: process.env.STORY_SPG_NFT_CONTRACT as `0x${string}`,
        recipient: recipient, // Dirección que recibirá el NFT
      },
      ipMetadata: {
        ipMetadataURI: metadata.uri, // Cambiado de metadataURI a ipMetadataURI (formato correcto del SDK)
        ipMetadataHash: metadata.hash as `0x${string}`, // Cambiado de metadataHash a ipMetadataHash
        nftMetadataURI: metadata.nftUri || metadata.uri,
        nftMetadataHash: metadata.nftHash || metadata.hash as `0x${string}`,
      },
      // NO pasar licenseTermsData aquí - se registrarán después
    });

    // Guardar IP en el registry para el marketplace
    // Obtener metadata del request si está disponible
    try {
      const metadataUriStr: string = typeof metadata.uri === 'string' ? metadata.uri : '';
      const nftMetadataUriStr: string = typeof metadata.nftUri === 'string' ? metadata.nftUri : metadataUriStr;
      
      if (metadataUriStr && tx.ipId && tx.txHash) {
        await saveRegisteredIP({
          ipId: tx.ipId,
          title: req.body.title || 'Untitled',
          year: req.body.year,
          posterUrl: req.body.posterUrl,
          description: req.body.description,
          imdbId: req.body.imdbId,
          metadataUri: metadataUriStr,
          nftMetadataUri: nftMetadataUriStr,
          txHash: tx.txHash,
          createdAt: new Date().toISOString(),
          uploader: req.body.uploader,
        });
      }
    } catch (saveError) {
      console.warn('No se pudo guardar IP en registry (no crítico):', saveError);
    }

    res.json({ success: true, txHash: tx.txHash, ipId: tx.ipId });
  } catch (error: any) {
    console.error('Error registrando IP:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error desconocido al registrar IP',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Registrar derivado (póster del puzzle)
router.post('/register-derivative', async (req, res) => {
  try {
    const { parentIpId, posterMetadata, licenseTokenId } = req.body;
    
    const client = await createStoryClient();
    
    // Usar registerIpAndMakeDerivative - requiere formato diferente
    const account = privateKeyToAccount(process.env.STORY_PRIVATE_KEY as `0x${string}`);
    const recipient = account.address;
    
    // TODO: Verificar el formato correcto de registerIpAndMakeDerivative
    // Por ahora, usamos registerIpAsset y luego attachamos como derivado
    const tx = await client.ipAsset.registerIpAsset({
      nft: {
        type: 'mint',
        spgNftContract: process.env.STORY_SPG_NFT_CONTRACT! as `0x${string}`,
        recipient: recipient,
      },
      ipMetadata: {
        ipMetadataURI: posterMetadata.uri,
        ipMetadataHash: posterMetadata.hash,
        nftMetadataURI: posterMetadata.nftUri,
        nftMetadataHash: posterMetadata.nftHash,
      },
    });

    // TODO: Después de registrar, necesitamos hacer attach como derivado
    // Esto requiere una llamada adicional al SDK

    res.json({ success: true, txHash: tx.txHash, ipId: tx.ipId });
  } catch (error: any) {
    console.error('Error registrando derivado:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Registrar términos de licencia
router.post('/register-license', async (req, res) => {
  try {
    const { ipId, licenseTerms } = req.body;
    
    const client = await createStoryClient();
    
    // IMPORTANTE: Si commercialRevShare > 0, se requiere royaltyPolicy con currency token
    // Si no hay currency token configurado, establecer commercialRevShare a 0 Y commercialUse a false
    // para evitar el error "Royalty policy requires currency token"
    const commercialRevShare = licenseTerms.commercialRevShare ?? 0;
    const currency = licenseTerms.currency;
    const hasValidCurrency = currency && currency !== '0x0000000000000000000000000000000000000000';
    
    // Si hay regalías comerciales (>0) pero no currency token válido, establecer a 0
    const finalCommercialRevShare = (commercialRevShare > 0 && !hasValidCurrency) ? 0 : commercialRevShare;
    
    // Si no hay regalías comerciales configuradas, no usar comercial use
    // Esto evita el error "Royalty policy requires currency token"
    const finalCommercialUse = (finalCommercialRevShare === 0) ? false : (licenseTerms.commercialUse ?? false);
    
    if (commercialRevShare > 0 && !hasValidCurrency) {
      console.warn('⚠️  commercialRevShare establecido a 0 porque no hay currency token válido configurado');
      console.warn('⚠️  commercialUse establecido a false para evitar error de royalty policy');
      console.warn('💡 Para habilitar regalías comerciales, configura un wrapped IP token address en currency');
    }
    
    // Asegurar que todos los campos numéricos tengan valores válidos (no undefined)
    // El SDK convierte algunos campos a BigInt, por lo que no pueden ser undefined
    const tx = await client.license.registerPILTerms({
      transferable: licenseTerms.transferable ?? false,
      commercialRevShare: finalCommercialRevShare, // Usar valor final (0 si no hay currency)
      commercialUse: finalCommercialUse, // Usar valor final (false si no hay regalías)
      commercialAttribution: licenseTerms.commercialAttribution ?? false,
      derivativesAllowed: licenseTerms.derivativesAllowed ?? false,
      derivativesAttribution: licenseTerms.derivativesAttribution ?? false,
      derivativesApproval: licenseTerms.derivativesApproval ?? false,
      derivativesReciprocal: licenseTerms.derivativesReciprocal ?? false,
      // Campos requeridos por el SDK
      defaultMintingFee: licenseTerms.mintingFee || '0', // String para BigInt
      expiration: 0, // 0 = sin expiración
      commercialRevCeiling: 0, // 0 = sin límite
      derivativeRevCeiling: 0, // 0 = sin límite
      commercializerChecker: '0x0000000000000000000000000000000000000000',
      commercializerCheckerData: '0x',
      currency: hasValidCurrency ? currency : '0x0000000000000000000000000000000000000000',
      uri: '', // URI opcional para términos de licencia
    });

    res.json({ success: true, txHash: tx.txHash, licenseTermsId: tx.licenseTermsId });
  } catch (error: any) {
    console.error('Error registrando licencia:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Pagar regalías
router.post('/pay-royalty', async (req, res) => {
  try {
    const { ipId, amount, currency } = req.body;
    
    const client = await createStoryClient();
    
    // TODO: Verificar la API correcta del SDK para payRoyalty
    // Por ahora, retornamos error indicando que necesita implementación
    return res.status(501).json({ 
      success: false, 
      error: 'payRoyalty endpoint necesita verificación de API del SDK' 
    });
  } catch (error: any) {
    console.error('Error pagando regalías:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reclamar regalías
router.post('/claim-royalty', async (req, res) => {
  try {
    const { ipId } = req.body;
    
    if (!ipId) {
      return res.status(400).json({ 
        success: false, 
        error: 'ipId es requerido para reclamar regalías' 
      });
    }
    
    const client = await createStoryClient();
    
    // TODO: Verificar la API correcta del SDK para claimAllRevenue
    // Por ahora, retornamos error indicando que necesita implementación
    return res.status(501).json({ 
      success: false, 
      error: 'claimAllRevenue endpoint necesita verificación de API del SDK' 
    });
  } catch (error: any) {
    console.error('Error reclamando regalías:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error desconocido al reclamar regalías' 
    });
  }
});

// Crear disputa
router.post('/create-dispute', async (req, res) => {
  try {
    const { targetIpId, reason, evidence } = req.body;
    
    const client = await createStoryClient();
    
    // TODO: Verificar la API correcta del SDK para raiseDispute
    // Por ahora, retornamos error indicando que necesita implementación
    return res.status(501).json({ 
      success: false, 
      error: 'raiseDispute endpoint necesita verificación de API del SDK' 
    });
  } catch (error: any) {
    console.error('Error creando disputa:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as storyRouter };

