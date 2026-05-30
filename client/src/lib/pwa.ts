/**
 * PWA utilities:
 *  - registerServiceWorker()   — registers sw.js, handles updates
 *  - usePwaInstallPrompt()     — React hook for A2HS install banner
 *  - listenSyncComplete()      — listens for background-sync completion messages
 */

// ── Service Worker Registration ───────────────────────────────────────────────

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', {
        scope: './',
      });

      // Listen for a waiting SW (new version available)
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            // New SW installed — dispatch event so app can show "Update available" toast
            window.dispatchEvent(new CustomEvent('sw-update-available'));
          }
        });
      });

      // If a new SW is waiting, activate it immediately on page focus
      if (registration.waiting) {
        window.dispatchEvent(new CustomEvent('sw-update-available'));
      }

      console.log('[GritIQ SW] Registered:', registration.scope);
    } catch (err) {
      console.warn('[GritIQ SW] Registration failed:', err);
    }
  });
}

// ── Background Sync completion listener ──────────────────────────────────────

export function listenSyncComplete(callback: (url: string) => void) {
  if (!('serviceWorker' in navigator)) return () => {};

  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'SYNC_COMPLETE') {
      callback(event.data.url as string);
    }
  };

  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}

// ── Background Sync registration (call from mutation handlers) ────────────────

export async function requestBackgroundSync(tag = 'gritiq-workout-sync') {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      await (registration as any).sync.register(tag);
    }
  } catch (err) {
    // Background Sync not supported — SW will retry on next fetch anyway
    console.warn('[GritIQ SW] Background sync registration failed:', err);
  }
}

// ── A2HS Install Prompt ───────────────────────────────────────────────────────

let _deferredPrompt: any = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _deferredPrompt = e;
  window.dispatchEvent(new CustomEvent('pwa-installable'));
});

window.addEventListener('appinstalled', () => {
  _deferredPrompt = null;
  window.dispatchEvent(new CustomEvent('pwa-installed'));
});

export function isPwaInstallable(): boolean {
  return _deferredPrompt !== null;
}

export async function triggerPwaInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!_deferredPrompt) return 'unavailable';
  _deferredPrompt.prompt();
  const { outcome } = await _deferredPrompt.userChoice;
  _deferredPrompt = null;
  return outcome as 'accepted' | 'dismissed';
}
