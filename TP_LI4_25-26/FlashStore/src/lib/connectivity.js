import { useCallback, useEffect, useState } from 'react';

const API_ROOT = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const HEALTH_URL = API_ROOT ? `${API_ROOT}/api/health` : '/api/health';

const CHECK_INTERVAL_MS = 12_000;
const FETCH_TIMEOUT_MS = 3_500;

export function isElectronApp() {
  return Boolean(typeof window !== 'undefined' && window.flashstore?.isElectron);
}

async function pingApi() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(HEALTH_URL, { signal: controller.signal, cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Verifica rede do SO + API central */
export async function checkOnline() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  return pingApi();
}

/**
 * Estado de ligação para PDV Electron / web.
 * @returns {{ isOnline: boolean, checking: boolean, refresh: () => Promise<boolean> }}
 */
export function useConnectivity() {
  const [isOnline, setIsOnline] = useState(true);
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async () => {
    setChecking(true);
    const online = await checkOnline();
    setIsOnline(online);
    setChecking(false);
    return online;
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, CHECK_INTERVAL_MS);
    const onOnline = () => refresh();
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      clearInterval(id);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refresh]);

  return { isOnline, checking, refresh };
}
