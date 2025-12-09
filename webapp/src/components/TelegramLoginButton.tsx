// Componente para login automático con Telegram usando Dynamic Auto-Wallets
// Basado en: https://github.com/dynamic-labs/telegram-miniapp-dynamic
// Documentación: https://www.dynamic.xyz/docs/guides/integrations/telegram/telegram-auto-wallets
import { useEffect, useState } from 'react';
import { DynamicWidget } from '@dynamic-labs/sdk-react-core';
import { useTelegramLogin } from '@dynamic-labs/sdk-react-core';
import { isInTelegram, getTelegramInitData } from '../utils/telegram';

export function TelegramLoginButton() {
  const inTelegram = isInTelegram();
  const { telegramSignIn, isAuthWithTelegram } = useTelegramLogin();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Obtener el token de la URL (query parameter)
    // El bot genera el token y lo pasa como ?telegramAuthToken=...
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('telegramAuthToken');
    
    if (tokenFromUrl) {
      console.log('✅ Token de Telegram encontrado en URL');
      console.log('📱 Token length:', tokenFromUrl.length);
      setAuthToken(tokenFromUrl);
    } else {
      console.log('ℹ️ No se encontró token en URL, usando initData de Telegram');
      // Fallback: usar initData de Telegram
      const initData = getTelegramInitData();
      if (initData) {
        console.log('📱 Usando initData de Telegram');
        setAuthToken(initData);
      } else {
        console.warn('⚠️ No se encontró token ni initData');
      }
    }
    
    setIsChecking(false);
  }, []);

  // CRÍTICO: DESHABILITAR auto-login automático
  // El auto-login está causando ciclos infinitos en el sandbox de Dynamic
  // Especialmente cuando se cambia entre dispositivos (Desktop -> Android -> Desktop)
  // Según la documentación de Dynamic, es mejor dejar que el usuario haga clic manualmente
  // en "Continuar con Email" en lugar de intentar auto-login
  // https://www.dynamic.xyz/docs/guides/integrations/telegram/telegram-mini-app
  useEffect(() => {
    // Solo verificar el token, pero NO intentar auto-login
    // Esto evita ciclos infinitos en el sandbox
    if (authToken) {
      console.log('✅ Token de Telegram disponible');
      console.log('ℹ️ El usuario puede hacer clic en "Continuar con Email" para autenticarse');
    }
    setIsChecking(false);
  }, [authToken]);
  
  // COMENTADO: Auto-login que causaba ciclos infinitos
  // useEffect(() => {
  //   const checkTelegramConnection = async () => {
  //     // ... código de auto-login ...
  //   };
  // }, [inTelegram, authToken, isAuthWithTelegram, telegramSignIn]);

  // Si no estamos en Telegram, no mostrar nada
  if (!inTelegram) {
    return null;
  }

  // CRÍTICO: No mostrar placeholder que bloquee el render
  // En Telegram Mini App, mostrar DynamicWidget inmediatamente
  // El auto-login se hará en background sin bloquear la UI
  // Solo mostrar placeholder si realmente está verificando Y no hay token
  if (isChecking && !authToken) {
    return (
      <div style={{
        padding: '0.75rem 1.5rem',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        borderRadius: '8px',
        textAlign: 'center',
        minHeight: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        Verificando Telegram...
      </div>
    );
  }
  
  // Si hay token, mostrar DynamicWidget inmediatamente
  // El auto-login se hará en background
  if (isChecking && authToken) {
    return <DynamicWidget />;
  }

  // Mostrar error si hay problema, pero también mostrar DynamicWidget para que puedan usar email
  if (error && !authToken) {
    return (
      <div>
        <div style={{
          padding: '0.75rem 1.5rem',
          background: '#ffa500',
          color: 'white',
          borderRadius: '8px',
          textAlign: 'center',
          fontSize: '0.875rem',
          marginBottom: '0.5rem',
        }}>
          ⚠️ Telegram Auto-Wallets no disponible temporalmente
          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
            Usa tu correo electrónico para crear tu wallet
          </div>
        </div>
        <DynamicWidget />
      </div>
    );
  }

  // Si hay error pero tenemos token, mostrar DynamicWidget para que puedan intentar manualmente
  if (error) {
    return (
      <div>
        <div style={{
          padding: '0.5rem 1rem',
          background: '#ffa500',
          color: 'white',
          borderRadius: '8px',
          textAlign: 'center',
          fontSize: '0.75rem',
          marginBottom: '0.5rem',
        }}>
          ⚠️ Error con Telegram. Puedes usar tu correo electrónico como alternativa.
        </div>
        <DynamicWidget />
      </div>
    );
  }

  // Renderizar DynamicWidget
  // DynamicWidget maneja el flujo de autenticación automáticamente
  // Si el auto-login falló, el usuario puede usar el botón en DynamicWidget
  // Con email habilitado, DynamicWidget mostrará la opción de email
  return <DynamicWidget />;
}

