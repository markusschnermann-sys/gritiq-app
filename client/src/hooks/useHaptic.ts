/**
 * useHaptic — Vibration-Feedback via Web Vibration API.
 *
 * ANDROID CHROME: Vollständig unterstützt seit Chrome 32. Funktioniert in PWA und Browser.
 * IOS SAFARI: navigator.vibrate() ist NICHT implementiert — kein Feedback auf iOS.
 * WEBVIEW: Funktioniert in Android WebView; schlägt in iOS WKWebView fehl.
 *
 * Patterns sind auf iOS UIImpactFeedbackGenerator angelehnt (für künftige
 * native Bridge-Integration), haben aber auf iOS selbst keinen Effekt.
 *
 *   light:   [10]              → UIImpactFeedbackGenerator(.light)
 *   medium:  [15]              → UIImpactFeedbackGenerator(.medium)
 *   heavy:   [25]              → UIImpactFeedbackGenerator(.heavy)
 *   success: [10, 60, 20]      → UINotificationFeedbackGenerator(.success)
 *   warning: [10, 40, 10, 40, 20] → UINotificationFeedbackGenerator(.warning)
 *   error:   [30, 50, 30]      → UINotificationFeedbackGenerator(.error)
 *   select:  [8]               → UISelectionFeedbackGenerator
 */

type HapticPattern = "light" | "medium" | "heavy" | "success" | "warning" | "error" | "select";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light:   [10],
  medium:  [15],
  heavy:   [25],
  success: [10, 60, 20],
  warning: [10, 40, 10, 40, 20],
  error:   [30, 50, 30],
  select:  [8],
};

export function useHaptic() {
  const vibrate = (pattern: HapticPattern) => {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(PATTERNS[pattern]);
      }
    } catch {
      // Silently ignore — not all browsers support vibration
    }
  };

  return { vibrate };
}
