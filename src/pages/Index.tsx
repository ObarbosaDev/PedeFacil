import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { trackProductEvent } from "@/lib/product-analytics";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bike,
  Check,
  Clock3,
  Crown,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Store,
  TicketPercent,
  Truck,
  User,
  WandSparkles,
} from "lucide-react";

const featureBlocks = [
  {
    icon: MessageCircle,
    title: "Pedido no WhatsApp sem bagunça",
    desc: "Cliente pede, a loja recebe tudo organizado e responde rápido.",
  },
  {
    icon: TicketPercent,
    title: "Cupons e campanhas de verdade",
    desc: "Crie oferta por período, valor mínimo e regra de uso sem planilha.",
  },
  {
    icon: BarChart3,
    title: "Painel com leitura de operação",
    desc: "Pedidos, volume do dia e gargalos da operação em uma leitura que bate o olho e resolve.",
  },
  {
    icon: Bike,
    title: "Fluxo de entregador completo",
    desc: "Despacho, aceite, saída para rota, PIN final e rastreio ao vivo.",
  },
];

const roadmap = [
  {
    step: "01",
    title: "Cliente monta o pedido",
    desc: "Cardápio com visual forte, extras e checkout objetivo.",
  },
  {
    step: "02",
    title: "Loja recebe e despacha",
    desc: "Kanban vivo e regras claras para cozinha e entrega.",
  },
  {
    step: "03",
    title: "Entregador executa rota",
    desc: "Ações rápidas de rua: mapa, ligação, ocorrência e PIN.",
  },
  {
    step: "04",
    title: "Análise e escale",
    desc: "Relatórios e automações para subir margem, ritmo e controle da operação.",
  },
];

const pricingPlans = [
  {
    slug: "essencial",
    name: "Essencial",
    price: "R$ 79/mês",
    highlight: "Entrada forte",
    perks: ["Cardápio digital", "Pedidos no WhatsApp", "Painel em tempo real"],
  },
  {
    slug: "profissional",
    name: "Profissional",
    price: "R$ 149/mês",
    highlight: "Mais escolhido",
    perks: ["Tudo do Essencial", "Cupons e campanhas", "Relatórios avançados"],
    featured: true,
  },
  {
    slug: "premium",
    name: "Premium",
    price: "R$ 249/mês",
    highlight: "Escala e performance",
    perks: ["Tudo do Profissional", "Suporte prioritário", "Acompanhamento consultivo"],
  },
];
const personaModes = [
  {
    id: "lojista",
    label: "Modo lojista",
    title: "Comando total da operação em uma tela viva.",
    desc: "Kanban, automações, cupons, entregadores e análise de performance em tempo real.",
    bullets: ["Despacho inteligente", "Automação WhatsApp", "Relatórios de repasse"],
    icon: Store,
  },
  {
    id: "cliente",
    label: "Modo cliente",
    title: "Compra rápida, visual premium e fluxo sem fricção.",
    desc: "Cardápio bonito, checkout seguro, conta personalizada e recompra sem enrolação.",
    bullets: ["Checkout organizado", "Cupons aplicados", "Histórico e favoritos"],
    icon: User,
  },
  {
    id: "entregador",
    label: "Modo entregador",
    title: "Painel de rua com ações práticas de verdade.",
    desc: "Aceite, rota, ocorrência, rastreio e PIN final para fechar a corrida do jeito certo.",
    bullets: ["Google Maps e Waze", "Registro de ocorrência", "Confirmação por PIN"],
    icon: Truck,
  },
];

const marqueeItems = [
  "Checkout com conta obrigatória",
  "Cupons por regra de negócio",
  "Rastreamento público da entrega",
  "Painel de entregador robusto",
  "Operação com SLA monitorado",
  "Automação de mensagens",
  "Design premium em todos os perfis",
];
function BrandOrbit() {
  return (
    <svg viewBox="0 0 580 420" className="w-full h-auto" aria-hidden="true">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#fb923c" />
        </linearGradient>
      </defs>

      <rect x="8" y="8" width="564" height="404" rx="36" fill="#0b101a" />
      <circle cx="290" cy="210" r="138" fill="none" stroke="#1f2937" strokeWidth="2" />
      <circle cx="290" cy="210" r="98" fill="none" stroke="#263244" strokeWidth="2" />
      <circle cx="290" cy="210" r="58" fill="none" stroke="#334155" strokeWidth="2" />

      <circle cx="290" cy="210" r="34" fill="url(#g1)" />
      <circle cx="290" cy="210" r="16" fill="#fff" opacity="0.9" />

      <g>
        <circle cx="428" cy="210" r="16" fill="url(#g2)" />
        <circle cx="242" cy="324" r="14" fill="#22c55e" />
        <circle cx="196" cy="154" r="12" fill="#38bdf8" />
        <circle cx="356" cy="116" r="10" fill="#f43f5e" />
      </g>

      <g fill="#e2e8f0" fontSize="12" fontFamily="ui-sans-serif,system-ui,sans-serif">
        <text x="448" y="214">cliente</text>
        <text x="256" y="351">entregador</text>
        <text x="156" y="154">lojista</text>
        <text x="362" y="100">automação</text>
      </g>

      <rect x="34" y="34" width="182" height="96" rx="14" fill="#111827" stroke="#374151" />
      <text x="48" y="60" fill="#f8fafc" fontSize="12">Pedidos hoje</text>
      <text x="48" y="98" fill="#fff" fontSize="34" fontWeight="700">89</text>
      <text x="132" y="98" fill="#22c55e" fontSize="12">+12%</text>

      <rect x="364" y="304" width="182" height="82" rx="14" fill="#111827" stroke="#374151" />
      <text x="378" y="332" fill="#f8fafc" fontSize="12">SLA médio</text>
      <text x="378" y="365" fill="#fff" fontSize="26" fontWeight="700">22 min</text>
    </svg>
  );
}

export default function LandingPage() {
  const { data: demoStore } = useQuery({
    queryKey: ["landing-demo-store"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("establishments")
        .select("slug, name")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;
      return data?.[0] || null;
    },
  });

  const demoHref = demoStore ? `/loja/${demoStore.slug}` : "/cliente";
  const [activePersona, setActivePersona] = useState(personaModes[0].id);
  const currentPersona = personaModes.find((mode) => mode.id === activePersona) || personaModes[0];
  const personaButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    void trackProductEvent("funnel_plans_view", {
      source: "home",
      section: "landing",
    });
  }, []);

  const handleHomeCtaClick = (target: string, metadata?: Record<string, unknown>) => {
    void trackProductEvent("funnel_home_cta_click", {
      target,
      ...metadata,
    });
  };

  return (
    <div
      className="min-h-screen text-zinc-900"
      style={{
        backgroundColor: "var(--landing-bg)",
        ["--landing-bg" as string]: "#f6f4ef",
        ["--surface" as string]: "#ffffff",
        ["--stroke" as string]: "#e5e7eb",
        ["--ink" as string]: "#111827",
        ["--muted" as string]: "#6b7280",
        ["--brand" as string]: "#f97316",
      }}
    >
      <style>{`
        @keyframes riseIn {
          from { opacity: 0; transform: translateY(18px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .reveal { opacity: 0; animation: riseIn .65s ease-out forwards; }
        .d1 { animation-delay: .08s; }
        .d2 { animation-delay: .16s; }
        .d3 { animation-delay: .24s; }
        .d4 { animation-delay: .32s; }
        @keyframes marqueeX {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .marquee-track {
          width: max-content;
          animation: marqueeX 24s linear infinite;
        }
        @keyframes glowPulse {
          0%, 100% { opacity: .45; transform: scale(1); }
          50% { opacity: .7; transform: scale(1.04); }
        }
        .hero-glow {
          animation: glowPulse 6s ease-in-out infinite;
        }
      `}</style>

      <a
        href="#conteúdo-principal"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[9999] focus:bg-zinc-900 focus:text-zinc-100 focus:px-4 focus:py-2 focus:rounded-md"
      >
        Ir para o conteúdo principal
      </a>

      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -left-24 h-[26rem] w-[26rem] rounded-full bg-orange-300/25 blur-3xl hero-glow" />
        <div className="absolute -bottom-20 right-0 h-[28rem] w-[28rem] rounded-full bg-emerald-300/20 blur-3xl hero-glow" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(251,191,36,0.16),transparent_42%),radial-gradient(circle_at_80%_30%,rgba(16,185,129,0.14),transparent_35%)]" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,#111827_1px,transparent_1px),linear-gradient(to_bottom,#111827_1px,transparent_1px)] [background-size:42px_42px]" />
      </div>

      <nav className="sticky top-0 z-50 border-b border-zinc-200/70 bg-[#f6f4ef]/88 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center reveal d1" aria-label="Voltar para a página inicial">
            <img src="/logo.png" alt="Logo Pede Fácil" className="h-10 w-auto object-contain" />
          </Link>

          <div className="flex items-center gap-2 flex-wrap justify-end reveal d2">
            <Link to="/cliente">
              <Button variant="outline" className="rounded-full border-zinc-300 bg-white/80" onClick={() => handleHomeCtaClick("/cliente", { label: "Sou cliente", area: "topbar" })}>Sou cliente</Button>
            </Link>
            <Link to="/entregador/login">
              <Button variant="outline" className="rounded-full border-zinc-300 bg-white/80" onClick={() => handleHomeCtaClick("/entregador/login", { label: "Sou entregador", area: "topbar" })}>Sou entregador</Button>
            </Link>
            <Link to="/login">
              <Button variant="ghost" className="rounded-full text-zinc-700" onClick={() => handleHomeCtaClick("/login", { label: "Entrar", area: "topbar" })}>Entrar</Button>
            </Link>
            <Link to="/planos">
              <Button className="rounded-full bg-zinc-900 text-zinc-100 hover:bg-zinc-800" onClick={() => handleHomeCtaClick("/planos", { label: "Ver planos", area: "topbar" })}>
                Ver planos
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main id="conteúdo-principal" className="max-w-7xl mx-auto px-4 pt-12 pb-12">
        <section className="grid xl:grid-cols-[1.07fr_0.93fr] gap-8 xl:gap-10 items-stretch">
          <div className="rounded-3xl border border-zinc-200 bg-white/90 backdrop-blur p-6 sm:p-8 md:p-10 shadow-[0_30px_120px_-60px_rgba(0,0,0,0.5)] reveal d1 relative overflow-hidden">
            <div className="absolute -right-14 -top-14 h-52 w-52 rounded-full bg-orange-200/45 blur-3xl pointer-events-none" />
            <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-emerald-200/35 blur-3xl pointer-events-none" />
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-semibold tracking-wide text-zinc-700">
              <Sparkles className="h-3.5 w-3.5 text-orange-500" />
              Plataforma para quem quer operar no nível profissional
            </div>

            <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.02] tracking-tight text-[color:var(--ink)]">
              Delivery com cara de marca grande, sem virar sistema engessado.
            </h1>

            <p className="mt-5 text-zinc-600 text-base sm:text-lg max-w-2xl">
              Loja, cliente e entregador em um ecossistema único. Bonito, rápido e feito para escalar com consistência.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/planos">
                <Button
                  size="lg"
                  className="h-12 px-6 rounded-full bg-zinc-900 text-zinc-100 hover:bg-zinc-800 shadow-[0_10px_30px_-14px_rgba(17,24,39,0.7)]"
                  onClick={() => handleHomeCtaClick("/planos", { label: "Quero o plano ideal", area: "hero" })}
                >
                  Quero o plano ideal
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Link to={demoHref}>
                <Button
                  size="lg"
                  className="h-12 px-6 rounded-full bg-orange-500 text-white hover:bg-orange-600 shadow-[0_10px_30px_-14px_rgba(249,115,22,0.85)]"
                  onClick={() => handleHomeCtaClick(demoHref, { label: "Abrir demo", area: "hero" })}
                >
                  Abrir demo
                </Button>
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 reveal d1">
                <p className="text-xs text-zinc-500">Setup</p>
                <p className="text-xl font-black mt-1">15 min</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 reveal d2">
                <p className="text-xs text-zinc-500">Fluxo de pedido</p>
                <p className="text-xl font-black mt-1">Tempo real</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 reveal d3">
                <p className="text-xs text-zinc-500">Entrega</p>
                <p className="text-xl font-black mt-1">Rastreio + PIN</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 reveal d4">
                <p className="text-xs text-zinc-500">Segurança</p>
                <p className="text-xl font-black mt-1">Conta obrigatória</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 reveal d2">
            <div className="rounded-3xl p-5 md:p-6 border border-zinc-200 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-100 shadow-[0_24px_90px_-60px_rgba(0,0,0,0.8)] relative overflow-hidden">
              <div className="absolute -right-12 -top-10 h-40 w-40 rounded-full bg-orange-400/20 blur-3xl pointer-events-none" />
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-300">Identidade visual proprietária</p>
              <h2 className="text-2xl font-black mt-2">Ecossistema da operação em um olhar</h2>
              <div className="mt-4 rounded-2xl border border-zinc-700 bg-zinc-900/50 p-2">
                <BrandOrbit />
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Acessos rápidos</p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Link to="/cliente" className="block rounded-2xl border border-zinc-200 bg-zinc-50 p-4 hover:bg-zinc-100 hover:border-zinc-300 hover:-translate-y-0.5 transition-all">
                  <User className="h-5 w-5 text-zinc-700" />
                  <p className="font-semibold mt-2">Cliente</p>
                  <p className="text-xs text-zinc-500 mt-1">Comprar e acompanhar pedido.</p>
                </Link>
                <Link to="/login" className="block rounded-2xl border border-zinc-200 bg-zinc-50 p-4 hover:bg-zinc-100 hover:border-zinc-300 hover:-translate-y-0.5 transition-all">
                  <Store className="h-5 w-5 text-zinc-700" />
                  <p className="font-semibold mt-2">Lojista</p>
                  <p className="text-xs text-zinc-500 mt-1">Gerir cardápio e operação.</p>
                </Link>
                <Link to="/entregador/login" className="block rounded-2xl border border-zinc-200 bg-zinc-50 p-4 hover:bg-zinc-100 hover:border-zinc-300 hover:-translate-y-0.5 transition-all">
                  <Bike className="h-5 w-5 text-zinc-700" />
                  <p className="font-semibold mt-2">Entregador</p>
                  <p className="text-xs text-zinc-500 mt-1">Executar rota com controle.</p>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <section className="max-w-7xl mx-auto px-4 pb-4">
        <div className="rounded-2xl border border-zinc-200 bg-white/75 backdrop-blur py-3 overflow-hidden reveal d3">
          <div className="marquee-track flex items-center gap-2 px-4">
            {[...marqueeItems, ...marqueeItems].map((item, idx) => (
              <span
                key={`${item}-${idx}`}
                className="inline-flex items-center gap-2 text-xs sm:text-sm rounded-full px-3 py-1 border border-zinc-200 bg-zinc-50 text-zinc-700 whitespace-nowrap"
              >
                <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 md:p-8 reveal d2">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm text-zinc-500">Experiência por perfil</p>
              <h2 className="text-3xl md:text-4xl font-black mt-1">Um produto, três jornadas lapidadas</h2>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[0.45fr_0.55fr] gap-5">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 space-y-2">
              {personaModes.map((mode) => {
                const Icon = mode.icon;
                const selected = mode.id === activePersona;
                const currentIndex = personaModes.findIndex((item) => item.id === mode.id);
                return (
                  <button
                    key={mode.id}
                    ref={(element) => {
                      personaButtonRefs.current[currentIndex] = element;
                    }}
                    type="button"
                    onClick={() => {
                      setActivePersona(mode.id);
                      void trackProductEvent("funnel_home_cta_click", {
                        target: "persona_mode",
                        persona: mode.id,
                      });
                    }}
                    onKeyDown={(event) => {
                      if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
                      event.preventDefault();
                      const maxIndex = personaModes.length - 1;
                      const nextIndex =
                        event.key === "ArrowDown" || event.key === "ArrowRight"
                          ? currentIndex === maxIndex
                            ? 0
                            : currentIndex + 1
                          : currentIndex === 0
                          ? maxIndex
                          : currentIndex - 1;
                      const nextPersona = personaModes[nextIndex];
                      setActivePersona(nextPersona.id);
                      personaButtonRefs.current[nextIndex]?.focus();
                    }}
                    aria-pressed={selected}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
                      selected
                        ? "border-zinc-900 bg-zinc-900 text-zinc-100"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 font-semibold">
                      <Icon className="h-4 w-4" />
                      {mode.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-100 p-6 relative overflow-hidden">
              <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl pointer-events-none" />
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-300">{currentPersona.label}</p>
              <h3 className="text-2xl md:text-3xl font-black mt-2">{currentPersona.title}</h3>
              <p className="text-zinc-300 mt-3">{currentPersona.desc}</p>
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {currentPersona.bullets.map((bullet) => (
                  <div key={bullet} className="rounded-xl border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm">
                    {bullet}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="rounded-3xl border border-zinc-200 bg-white/80 backdrop-blur p-6 md:p-8 reveal d1">
          <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
            <div>
              <p className="text-sm text-zinc-500">Diferenciais do produto</p>
              <h2 className="text-3xl md:text-4xl font-black mt-1">Funcionalidade forte com visual premium</h2>
            </div>
            <Link to="/planos">
              <Button variant="outline" className="rounded-full border-zinc-300 bg-white">
                Ver planos
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {featureBlocks.map((item, idx) => (
              <div key={item.title} className={`rounded-2xl border border-zinc-200 bg-zinc-50 p-5 hover:-translate-y-0.5 hover:shadow-md transition-all reveal d${(idx % 4) + 1}`}>
                <div className="h-11 w-11 rounded-xl bg-zinc-900 text-zinc-100 flex items-center justify-center">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="font-black text-lg mt-4">{item.title}</h3>
                <p className="text-sm text-zinc-600 mt-2">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="rounded-3xl border border-zinc-200 bg-gradient-to-r from-orange-50 via-white to-emerald-50 p-6 md:p-8 reveal d2">
          <div className="flex items-center gap-2 text-sm text-zinc-600">
            <WandSparkles className="h-4 w-4 text-orange-600" />
            Jornada completa da plataforma
          </div>
          <h2 className="text-3xl md:text-4xl font-black mt-2">Um fluxo único para vender, entregar e fidelizar</h2>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {roadmap.map((item, idx) => (
              <div key={item.step} className={`rounded-2xl border border-zinc-200 bg-white p-5 reveal d${(idx % 4) + 1}`}>
                <p className="text-xs font-bold tracking-wider text-orange-600">{item.step}</p>
                <h3 className="font-black text-lg mt-2">{item.title}</h3>
                <p className="text-sm text-zinc-600 mt-2">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 md:p-8 reveal d3">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm text-zinc-500">Posicionamento de produto</p>
              <h2 className="text-3xl md:text-4xl font-black mt-1">Não é só sistema. É vantagem competitiva.</h2>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left border-b border-zinc-200">
                  <th className="py-3 pr-4 font-semibold text-zinc-600">Critério</th>
                  <th className="py-3 px-4 font-semibold text-zinc-900">PedeFácil</th>
                  <th className="py-3 px-4 font-semibold text-zinc-500">Solução genérica</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-zinc-100">
                  <td className="py-3 pr-4">Experiência por perfil</td>
                  <td className="py-3 px-4 text-emerald-700 font-medium">Cliente, lojista e entregador com fluxos dedicados</td>
                  <td className="py-3 px-4 text-zinc-500">Uma tela igual para todo mundo</td>
                </tr>
                <tr className="border-b border-zinc-100">
                  <td className="py-3 pr-4">Operação de entrega</td>
                  <td className="py-3 px-4 text-emerald-700 font-medium">Despacho, aceite, ocorrência, rastreio e PIN</td>
                  <td className="py-3 px-4 text-zinc-500">Controle parcial e manual</td>
                </tr>
                <tr className="border-b border-zinc-100">
                  <td className="py-3 pr-4">Automação comercial</td>
                  <td className="py-3 px-4 text-emerald-700 font-medium">Eventos WhatsApp por etapa da jornada</td>
                  <td className="py-3 px-4 text-zinc-500">Mensagens sem contexto</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4">Visual e percepção de marca</td>
                  <td className="py-3 px-4 text-emerald-700 font-medium">Interface premium com linguagem consistente</td>
                  <td className="py-3 px-4 text-zinc-500">Layout padrão sem identidade</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="planos" className="max-w-7xl mx-auto px-4 py-10 scroll-mt-24">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 md:p-8 reveal d3">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm text-zinc-500">Planos e valores</p>
              <h2 className="text-3xl md:text-4xl font-black mt-1">Cliente compra grátis. Comerciante assina plano.</h2>
              <p className="text-zinc-600 mt-2 max-w-2xl">
                O acesso do cliente e do entregador existe para fazer a operação fluir. Plano pago é para lojista.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold rounded-full px-3 py-2 border border-zinc-300 text-zinc-700">
              <Clock3 className="h-3.5 w-3.5" />
              Ativação rápida
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-7">
            {pricingPlans.map((plan, idx) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-6 reveal d${(idx % 4) + 1} ${
                  plan.featured
                    ? "border-zinc-900 bg-zinc-900 text-zinc-100 shadow-[0_24px_80px_-60px_rgba(0,0,0,0.9)]"
                    : "border-zinc-200 bg-zinc-50"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className={`text-xs uppercase tracking-wider ${plan.featured ? "text-zinc-300" : "text-zinc-500"}`}>
                    {plan.highlight}
                  </p>
                  {plan.featured && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-1 bg-zinc-100 text-zinc-900">
                      <Crown className="h-3.5 w-3.5" />
                      Destaque
                    </span>
                  )}
                </div>

                <h3 className="text-2xl font-black mt-2">{plan.name}</h3>
                <p className={`text-3xl font-black mt-4 ${plan.featured ? "text-orange-300" : "text-zinc-900"}`}>
                  {plan.price}
                </p>

                <div className="space-y-2 mt-5">
                  {plan.perks.map((perk) => (
                    <p key={perk} className={`text-sm flex items-start gap-2 ${plan.featured ? "text-zinc-100" : "text-zinc-700"}`}>
                      <Check className={`h-4 w-4 mt-0.5 shrink-0 ${plan.featured ? "text-emerald-300" : "text-emerald-600"}`} />
                      <span>{perk}</span>
                    </p>
                  ))}
                </div>

                <Link to={`/planos/checkout?plano=${plan.slug}&billing=monthly`} className="block mt-6">
                  <Button
                    className={`w-full rounded-full ${
                      plan.featured
                        ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                        : "bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                    }`}
                    onClick={() =>
                      void trackProductEvent("funnel_plan_selected", {
                        source: "home_pricing",
                        plan: plan.slug,
                        billing: "monthly",
                      })
                    }
                  >
                    Quero esse plano
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 pb-16">
        <div className="rounded-3xl border border-zinc-200 bg-zinc-900 text-zinc-100 p-8 md:p-12 text-center relative overflow-hidden reveal d4">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-56 w-56 rounded-full bg-orange-400/20 blur-3xl pointer-events-none" />
          <div className="absolute inset-0 opacity-[0.16] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.25)_1px,transparent_0)] [background-size:18px_18px]" />
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-300 relative">Produto para negócio sério</p>
          <h2 className="text-3xl md:text-5xl font-black mt-3 relative">
            Sua operação de delivery com nível de empresa grande.
          </h2>
          <p className="text-zinc-300 text-lg mt-4 max-w-2xl mx-auto relative">
            Se a meta é crescer com consistência, esse ecossistema foi desenhado para aguentar escala.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap mt-8 relative">
            <Link to="/planos">
              <Button
                size="lg"
                className="h-12 rounded-full px-7 bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                onClick={() => handleHomeCtaClick("/planos", { label: "Ver planos de lojista", area: "footer_cta" })}
              >
                Ver planos de lojista
              </Button>
            </Link>
            <Link to={demoHref}>
              <Button
                size="lg"
                className="h-12 rounded-full px-7 bg-orange-500 text-white hover:bg-orange-600 shadow-[0_12px_32px_-16px_rgba(249,115,22,0.85)]"
                onClick={() => handleHomeCtaClick(demoHref, { label: "Abrir demo", area: "footer_cta" })}
              >
                Abrir demo
              </Button>
            </Link>
          </div>

          <div className="mt-8 flex items-center justify-center gap-5 flex-wrap text-xs text-zinc-300 relative">
            <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Login seguro</span>
            <span className="inline-flex items-center gap-1"><BadgeCheck className="h-3.5 w-3.5" /> Fluxo validado</span>
            <span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" /> Visual premium</span>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-200 py-8 text-center text-sm text-zinc-500">
        <p>© {new Date().getFullYear()} PedeFácil. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}












