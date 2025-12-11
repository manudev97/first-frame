// Componente para auto-login automático con Telegram Auto-Wallets
// Documentación: https://www.dynamic.xyz/docs/guides/integrations/telegram/telegram-auto-wallets
import { useEffect, useState } from 'react';
import { useTelegramLogin, useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { isInTelegram, getTelegramUser } from '../utils/telegram';

export function TelegramAutoLogin() {
  const inTelegram = isInTelegram();
  const { telegramSignIn, isAuthWithTelegram } = useTelegramLogin();
  const { user, isAuthenticated, primaryWallet } = useDynamicContext();
  const [hasAttemptedLogin, setHasAttemptedLogin] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Si no estamos en Telegram, no hacer nada
  if (!inTelegram) {
    return null;
  }

  useEffect(() => {
    // Esperar a que el contexto de Dynamic esté listo
    if (!telegramSignIn || !isAuthWithTelegram) {
      return;
    }

    // Solo intentar login una vez
    if (hasAttemptedLogin) {
      return;
    }

    const attemptAutoLogin = async () => {
      try {
        setIsChecking(true);
        
        // Obtener el token de la URL o del initData (necesario para enlazar)
        const urlParams = new URLSearchParams(window.location.search);
        const telegramAuthToken = urlParams.get('telegramAuthToken');
        const initData = typeof window !== 'undefined' && window.Telegram?.WebApp?.initData;
        
        // Verificar si el usuario ya está autenticado con Telegram
        const isLinkedWithTelegram = await isAuthWithTelegram();
        
        console.log('🔐 [TelegramAutoLogin] Verificando autenticación...');
        console.log('🔐 [TelegramAutoLogin] Usuario autenticado:', isAuthenticated);
        console.log('🔐 [TelegramAutoLogin] Usuario vinculado con Telegram:', isLinkedWithTelegram);
        
        // Si ya está autenticado, verificar si necesita enlazar Telegram
        if (isAuthenticated && user) {
          console.log('✅ [TelegramAutoLogin] Usuario ya autenticado:', user.email || user.username);
          
          // Si NO está vinculado con Telegram pero hay datos de Telegram, enlazar
          if (!isLinkedWithTelegram) {
            const telegramUser = getTelegramUser();
            const telegramAuthToken = urlParams.get('telegramAuthToken');
            const initData = typeof window !== 'undefined' && window.Telegram?.WebApp?.initData;
            
            if (telegramUser && (telegramAuthToken || initData)) {
              console.log('🔗 [TelegramAutoLogin] Enlazando Telegram a cuenta existente (email)...');
              try {
                // Enlazar Telegram a la cuenta existente (NO crear nueva cuenta)
                await telegramSignIn({
                  // NO usar forceCreateUser - esto enlazará a la cuenta existente
                  ...(telegramAuthToken && { authToken: telegramAuthToken })
                });
                console.log('✅ [TelegramAutoLogin] Telegram enlazado exitosamente a cuenta de email');
              } catch (linkError) {
                console.error('❌ [TelegramAutoLogin] Error enlazando Telegram:', linkError);
              }
            }
          }
          
          setIsChecking(false);
          return;
        }

        // Si está vinculado con Telegram pero no autenticado, hacer login automático
        if (isLinkedWithTelegram) {
          console.log('🔄 [TelegramAutoLogin] Usuario vinculado con Telegram, iniciando sesión automáticamente...');
          await telegramSignIn();
          setHasAttemptedLogin(true);
          setIsChecking(false);
          return;
        }

        // Si no está vinculado, intentar crear cuenta automáticamente
        console.log('🔐 [TelegramAutoLogin] Token en URL:', !!telegramAuthToken);
        console.log('🔐 [TelegramAutoLogin] initData disponible:', !!initData);
        
        if (telegramAuthToken || initData) {
          console.log('🔄 [TelegramAutoLogin] Creando cuenta automáticamente con Telegram...');
          
          // Llamar a telegramSignIn con forceCreateUser para crear cuenta automáticamente
          // El token se obtiene automáticamente de la URL o initData
          await telegramSignIn({ 
            forceCreateUser: true,
            // Si hay token en URL, pasarlo explícitamente
            ...(telegramAuthToken && { authToken: telegramAuthToken })
          });
          
          setHasAttemptedLogin(true);
          console.log('✅ [TelegramAutoLogin] Auto-login completado');
        } else {
          console.warn('⚠️ [TelegramAutoLogin] No se encontró token de Telegram. El usuario debe iniciar sesión manualmente.');
        }
        
        setIsChecking(false);
      } catch (error) {
        console.error('❌ [TelegramAutoLogin] Error en auto-login:', error);
        setIsChecking(false);
        setHasAttemptedLogin(true); // Marcar como intentado para no repetir
      }
    };

    // Esperar un poco para asegurar que Dynamic esté completamente inicializado
    const timeout = setTimeout(() => {
      attemptAutoLogin();
    }, 1000);

    return () => clearTimeout(timeout);
  }, [telegramSignIn, isAuthWithTelegram, isAuthenticated, user, hasAttemptedLogin, primaryWallet?.address]);

  // SIMPLIFICADO: Ya no necesitamos enlazar en el backend
  // Dynamic ya guarda toda la información del usuario (Telegram ID, email, wallet address)
  // El frontend siempre enviará la dirección de Dynamic directamente al backend cuando sea necesario

  // No renderizar nada, solo manejar el auto-login
  return null;
}

