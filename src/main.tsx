import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initClientErrorMonitoring } from "@/lib/observability";

initClientErrorMonitoring();

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // fallback silencioso
    });
  });
}
