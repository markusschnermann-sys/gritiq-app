import { useState, useEffect } from 'react';
import { isPwaInstallable, triggerPwaInstall, listenSyncComplete } from '@/lib/pwa';
import { queryClient } from '@/lib/queryClient';

/**
 * usePwaInstall — tracks A2HS availability and exposes a trigger function.
 */
export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(isPwaInstallable());
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const onInstallable = () => setCanInstall(true);
    const onInstalled = () => { setCanInstall(false); setIsInstalled(true); };

    window.addEventListener('pwa-installable', onInstallable);
    window.addEventListener('pwa-installed', onInstalled);

    // Also detect standalone mode (already installed)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('pwa-installable', onInstallable);
      window.removeEventListener('pwa-installed', onInstalled);
    };
  }, []);

  const install = () => triggerPwaInstall();

  return { canInstall, isInstalled, install };
}

/**
 * useSyncStatus — tracks offline state and background-sync completions.
 * When a queued mutation syncs, it invalidates relevant query caches.
 */
export function useSyncStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncs, setPendingSyncs] = useState(0);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // When SW drains the queue, refresh caches
    const unsub = listenSyncComplete((url) => {
      setPendingSyncs((n) => Math.max(0, n - 1));
      // Invalidate affected queries
      if (url.includes('/api/sessions')) {
        queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      }
      if (url.includes('/api/sets')) {
        queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      }
      if (url.includes('/api/user')) {
        queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      }
    });

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      unsub();
    };
  }, []);

  return { isOnline, pendingSyncs };
}
