import { useState, useEffect } from 'react';
import { Download, WifiOff, RefreshCw, X, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePwaInstall, useSyncStatus } from '@/hooks/use-pwa';

/**
 * PwaBanner — shows three banners:
 *   1. Android/Chrome: A2HS install prompt (beforeinstallprompt)
 *   2. iOS Safari: Share → "Zum Home-Bildschirm" instruction card
 *   3. Offline indicator — sticky bar when no network
 *   4. SW update toast
 */

// ── iOS/Safari detection ──────────────────────────────────────────────────────

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
}

// ── iOS Install Banner ────────────────────────────────────────────────────────

function IosInstallBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      className="fixed left-4 right-4 md:left-auto md:right-6 md:w-[340px]
                 z-[60] rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-sm
                 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.45)] animate-in slide-in-from-bottom-4 duration-300"
      style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
      data-testid="banner-ios-install"
    >
      {/* Close */}
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        aria-label="Schließen"
      >
        <X size={14} />
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 pr-5">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Download size={18} className="text-primary" />
        </div>
        <div>
          <p className="font-display font-bold text-sm">GritIQ auf Homescreen</p>
          <p className="text-xs text-muted-foreground mt-0.5">3 einfache Schritte in Safari</p>
        </div>
      </div>

      {/* Steps */}
      <div className="mt-3 space-y-2">
        <Step n={1} icon={<Share size={13} className="text-sky-400" />}>
          Tippe auf <strong className="text-foreground">Teilen</strong>{' '}
          <span className="text-muted-foreground">(□↑ unten in Safari)</span>
        </Step>
        <Step n={2} icon={<PlusSquareIcon />}>
          Wähle <strong className="text-foreground">„Zum Home-Bildschirm"</strong>
        </Step>
        <Step n={3} icon={<span className="text-sm">✓</span>}>
          Tippe <strong className="text-foreground">„Hinzufügen"</strong> — fertig
        </Step>
      </div>

      {/* Arrow pointing down to Safari toolbar */}
      <div className="mt-3 flex justify-center">
        <div className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
          <span>↓ Safari-Toolbar unten</span>
        </div>
      </div>

      <button
        onClick={onDismiss}
        className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Nicht jetzt
      </button>
    </div>
  );
}

function Step({ n, icon, children }: { n: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-[10px] font-display font-bold text-primary">{n}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-1">
        {icon}
        <p className="text-xs text-muted-foreground leading-snug">{children}</p>
      </div>
    </div>
  );
}

function PlusSquareIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
         className="text-green-400 flex-shrink-0">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M12 8v8M8 12h8"/>
    </svg>
  );
}

// ── Main Banner Component ─────────────────────────────────────────────────────

export default function PwaBanner() {
  const { canInstall, install } = usePwaInstall();
  const { isOnline, pendingSyncs } = useSyncStatus();

  const [showInstall, setShowInstall]     = useState(false);
  const [showIos, setShowIos]             = useState(false);
  const [dismissed, setDismissed]         = useState(false);
  const [swUpdate, setSwUpdate]           = useState(false);

  // Android/Chrome: delay A2HS prompt by 30s
  useEffect(() => {
    if (!canInstall || dismissed) return;
    const t = setTimeout(() => setShowInstall(true), 30_000);
    return () => clearTimeout(t);
  }, [canInstall, dismissed]);

  // iOS Safari: show install hint after 20s if not already installed
  useEffect(() => {
    if (dismissed || isInStandaloneMode() || !isIos()) return;
    const t = setTimeout(() => setShowIos(true), 20_000);
    return () => clearTimeout(t);
  }, [dismissed]);

  // SW update available
  useEffect(() => {
    const handler = () => setSwUpdate(true);
    window.addEventListener('sw-update-available', handler);
    return () => window.removeEventListener('sw-update-available', handler);
  }, []);

  const handleAndroidInstall = async () => {
    await install();
    setShowInstall(false);
  };

  const handleUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
      });
    }
    window.location.reload();
  };

  const dismiss = () => {
    setDismissed(true);
    setShowInstall(false);
    setShowIos(false);
  };

  return (
    <>
      {/* ── Offline bar ─────────────────────────────────────────────────── */}
      {!isOnline && (
        <div
          className="fixed left-0 right-0 z-[60] flex items-center gap-3 px-4 py-3
                     bg-yellow-900/80 border-t border-yellow-500/30 backdrop-blur-sm"
          style={{ bottom: 'env(safe-area-inset-bottom, 0px)' }}
          data-testid="banner-offline"
        >
          <WifiOff size={16} className="text-yellow-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-yellow-300">Kein Internet</p>
            <p className="text-xs text-yellow-300/70 truncate">
              {pendingSyncs > 0
                ? `${pendingSyncs} Eintrag${pendingSyncs > 1 ? 'e' : ''} werden synchronisiert, sobald du wieder online bist.`
                : 'Dein Training läuft weiter. Einträge werden automatisch synchronisiert.'}
            </p>
          </div>
          {pendingSyncs > 0 && (
            <RefreshCw size={14} className="text-yellow-400 animate-spin flex-shrink-0" />
          )}
        </div>
      )}

      {/* ── iOS install hint ────────────────────────────────────────────── */}
      {showIos && !dismissed && isOnline && (
        <IosInstallBanner onDismiss={dismiss} />
      )}

      {/* ── Android/Chrome install prompt ───────────────────────────────── */}
      {showInstall && !dismissed && isOnline && !isIos() && (
        <div
          className="fixed left-4 right-4 md:left-auto md:right-6 md:w-80
                     z-[60] rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-sm
                     p-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-in slide-in-from-bottom-4 duration-300"
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
          data-testid="banner-install"
        >
          <button
            onClick={dismiss}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
            aria-label="Schließen"
          >
            <X size={14} />
          </button>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Download size={18} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0 pr-4">
              <p className="font-display font-bold text-sm">GritIQ installieren</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                App auf deinem Homescreen speichern — funktioniert auch ohne Internet.
              </p>
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs border-border"
              onClick={dismiss}
            >
              Später
            </Button>
            <Button
              size="sm"
              className="flex-1 gradient-orange text-white border-0 text-xs"
              onClick={handleAndroidInstall}
              data-testid="button-install-pwa"
            >
              Installieren
            </Button>
          </div>
        </div>
      )}

      {/* ── SW update toast ─────────────────────────────────────────────── */}
      {swUpdate && (
        <div
          className="fixed top-4 left-4 right-4 md:left-auto md:right-6 md:w-72
                     z-50 rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-sm
                     p-3 shadow-lg animate-in slide-in-from-top-4 duration-300"
          data-testid="banner-sw-update"
        >
          <div className="flex items-center gap-3">
            <RefreshCw size={16} className="text-primary flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-semibold">Update verfügbar</p>
              <p className="text-xs text-muted-foreground">Neue Version laden?</p>
            </div>
            <Button
              size="sm"
              className="gradient-orange text-white border-0 text-xs px-3"
              onClick={handleUpdate}
            >
              Neu laden
            </Button>
            <button onClick={() => setSwUpdate(false)} className="text-muted-foreground">
              <X size={12} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
