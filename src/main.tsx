/**
 * Módulo: inicialização do frontend.
 * Data: 2026-09-23.
 * Responsável: Engenharia Pede Fácil.
 * Tela/fluxo: todas as rotas web.
 * Finalidade: carregar fontes locais, estilos e providers da aplicação.
 * Motivo: evitar dependência de fontes remotas e manter renderização consistente.
 * Evolução: mover bootstrap e providers para `src/app`.
 */
import "@fontsource/inter/latin-ext-400.css";
import "@fontsource/inter/latin-ext-500.css";
import "@fontsource/inter/latin-ext-600.css";
import "@fontsource/inter/latin-ext-700.css";
import "@fontsource/instrument-serif/latin-ext-400.css";
import "@fontsource/instrument-serif/latin-ext-400-italic.css";
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
