/**
 * Módulo: fachada da página inicial.
 * Data: 2026-09-23.
 * Responsável: Engenharia Pede Fácil.
 * Tela/fluxo: rota pública `/`.
 * Finalidade: preservar a rota enquanto a implementação vive no módulo de marketing.
 * Motivo: permitir migração incremental sem acoplar o roteador à estrutura interna.
 * Evolução: mover a composição de rotas para `src/app` no ciclo de arquitetura.
 */
export { default } from "@/features/marketing/pages/LandingPage";
