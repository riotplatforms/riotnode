import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export function useTelegram() {
  const [user, setUser] = useState<any>(null);
  const [initData, setInitData] = useState<string>('');
  const [referrer, setReferrer] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const tg = (window as any).Telegram?.WebApp;

  useEffect(() => {
    const webapp = (window as any).Telegram?.WebApp;
    if (webapp) {
      console.log('Telegram WebApp detected');
      try {
        webapp.ready();
        webapp.expand();
        webapp.setHeaderColor('#0a0a0a');
        webapp.setBackgroundColor('#0a0a0a');

        const userData = webapp.initDataUnsafe?.user;
        if (userData) {
          console.log('User data found:', userData.username);
          setUser(userData);
        }

        const startParam = webapp.initDataUnsafe?.start_param;
        if (startParam && startParam.startsWith('0x')) {
          setReferrer(startParam);
          localStorage.setItem('aimining_referrer', startParam);
        } else {
          const stored = localStorage.getItem('aimining_referrer');
          if (stored) setReferrer(stored);
        }

        setInitData(webapp.initData);
      } catch (error) {
        console.error('Error in TMA initialization:', error);
      }
    } else {
      console.warn('Telegram WebApp NOT detected - running in browser mode');
    }
  }, []);

  // Handle Telegram Back Button
  useEffect(() => {
    if (!tg) return;

    if (location.pathname === '/') {
      tg.BackButton.hide();
    } else {
      tg.BackButton.show();
    }

    const handleBack = () => {
      navigate(-1);
    };

    tg.onEvent('backButtonClicked', handleBack);
    return () => {
      tg.offEvent('backButtonClicked', handleBack);
    };
  }, [tg, location.pathname, navigate]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      // Telegram's native copy is safer in webviews
      if (tg) {
        // Unfortunately Telegram WebApp doesn't have a direct "copy" API yet, 
        // but clipboard API works in modern Telegram browsers.
        await navigator.clipboard.writeText(text);
        tg.HapticFeedback.notificationOccurred('success');
        return true;
      }
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      return false;
    }
  }, [tg]);

  const showAlert = useCallback((message: string) => {
    if (tg) {
      tg.showAlert(message);
    } else {
      alert(message);
    }
  }, [tg]);

  return {
    tg,
    user,
    initData,
    referrer,
    copyToClipboard,
    showAlert,
  };
}
