import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

createRoot(document.getElementById("root")!).render(<App />);

// PWA: auto-update — when a new version is available, reload immediately
// so the user never has to clear cache to get latest changes.
if ("serviceWorker" in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Activate new SW and reload as soon as new content is detected
      updateSW(true);
    },
    onRegisteredSW(_swUrl, registration) {
      // Poll for updates every 30 seconds while the tab is open
      if (registration) {
        setInterval(() => {
          registration.update().catch(() => {});
        }, 30_000);
      }
    },
  });
}
