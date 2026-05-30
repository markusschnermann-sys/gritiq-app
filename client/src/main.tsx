import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "./lib/pwa";

if (!window.location.hash) {
  window.location.hash = "#/";
}

// Register PWA service worker (no-op in dev / unsupported browsers)
registerServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
