import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SessionProvider } from "./session";
import { AuthPage } from "@/features/auth/AuthPage";
import { LandingPage } from "@/features/landing/LandingPage";
import { MerchantPage } from "@/features/merchant/MerchantPage";
import { StorefrontPage } from "@/features/storefront/StorefrontPage";
import { TrackingPage } from "@/features/storefront/TrackingPage";

export default function App() {
  return <BrowserRouter><SessionProvider><Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/entrar" element={<AuthPage mode="login" />} />
    <Route path="/cadastro" element={<AuthPage mode="register" />} />
    <Route path="/esqueci-senha" element={<AuthPage mode="forgot" />} />
    <Route path="/redefinir-senha" element={<AuthPage mode="reset" />} />
    <Route path="/auth/confirm-email" element={<AuthPage mode="confirm" />} />
    <Route path="/painel" element={<Navigate to="/painel/visao-geral" replace />} />
    <Route path="/painel/:tab" element={<MerchantPage />} />
    <Route path="/loja/:slug" element={<StorefrontPage />} />
    <Route path="/pedido/:token" element={<TrackingPage />} />
    <Route path="*" element={<main className="not-found"><h1>Página não encontrada.</h1><a href="/">Voltar ao início</a></main>} />
  </Routes></SessionProvider></BrowserRouter>;
}
