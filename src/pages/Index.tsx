import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  ShoppingBag,
  MessageCircle,
  BarChart3,
  Star,
  ArrowRight,
  Store,
  Clock3,
  BadgeCheck,
  Sparkles,
  Check,
} from "lucide-react";

const features = [
  {
    icon: ShoppingBag,
    title: "Cardápio que vende",
    desc: "Seu cliente escolhe, monta o carrinho e fecha o pedido sem dor de cabeça.",
  },
  {
    icon: MessageCircle,
    title: "Pedido no WhatsApp",
    desc: "O pedido já chega formatado para você responder rápido, sem bagunça.",
  },
  {
    icon: BarChart3,
    title: "Painel com visão real",
    desc: "Acompanhe pedidos, faturamento e operação em tempo real.",
  },
  {
    icon: Star,
    title: "Clientes VIP",
    desc: "Programa de pontos para o cliente voltar e pedir de novo.",
  },
];

const pricingPlans = [
  {
    name: "Essencial",
    price: "R$ 79/mês",
    highlight: "Para começar",
    perks: ["Cardápio digital completo", "Pedidos no WhatsApp", "Painel de pedidos em tempo real"],
  },
  {
    name: "Profissional",
    price: "R$ 149/mês",
    highlight: "Mais escolhido",
    perks: ["Tudo do Essencial", "Cupons e campanhas", "Ranking e relatórios avançados"],
  },
  {
    name: "Premium",
    price: "R$ 249/mês",
    highlight: "Escala com suporte",
    perks: ["Tudo do Profissional", "Atendimento prioritário", "Acompanhamento de performance"],
  },
];

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
  const scrollToPlans = () => {
    document.getElementById("planos")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[9999] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md"
      >
        Ir para o conteúdo principal
      </a>
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-24 right-0 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-orange-300/20 blur-3xl" />
      </div>

      <nav className="border-b bg-card/85 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-1">
            <span className="text-2xl font-extrabold text-primary">Pede</span>
            <span className="text-2xl font-extrabold">Fácil</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/cliente">
              <Button variant="outline" className="rounded-full">Sou cliente</Button>
            </Link>
            <Link to="/login">
              <Button variant="ghost" className="rounded-full">Entrar</Button>
            </Link>
            <Button className="rounded-full" onClick={scrollToPlans}>Ver planos lojista</Button>
          </div>
        </div>
      </nav>

      <section id="conteudo-principal" className="max-w-6xl mx-auto px-4 pt-16 pb-10">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium mb-5">
              <Sparkles className="h-4 w-4 text-primary" />
              Plataforma feita para negócios locais de comida
            </div>

            <h1 className="text-4xl md:text-6xl font-black leading-tight">
              Seu delivery profissional, sem perder a cara da sua marca.
            </h1>

            <p className="text-lg text-muted-foreground mt-5 max-w-xl">
              Crie seu cardápio digital, receba pedidos no WhatsApp e gerencie tudo em um painel bonito e prático.
            </p>

            <div className="flex flex-wrap gap-3 mt-7">
              <Button size="lg" className="h-12 px-6 text-base rounded-full" onClick={scrollToPlans}>
                Ver planos para lojista <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Link to="/cliente">
                <Button size="lg" variant="outline" className="h-12 px-6 text-base rounded-full">
                  Ver lojas abertas
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-8">
              <div className="rounded-xl border bg-card p-3">
                <p className="text-xs text-muted-foreground">Setup</p>
                <p className="text-lg font-bold">Rápido</p>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <p className="text-xs text-muted-foreground">Pedidos</p>
                <p className="text-lg font-bold">Em tempo real</p>
              </div>
              <div className="rounded-xl border bg-card p-3 col-span-2 sm:col-span-1">
                <p className="text-xs text-muted-foreground">Operação</p>
                <p className="text-lg font-bold">Sem enrolação</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mt-4">
              Cliente compra de graça. Plano pago é só para lojista/comerciante.
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Visão do lojista</p>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="rounded-lg border p-3">
                  <Store className="h-4 w-4 text-primary mb-1" />
                  <p className="text-xs text-muted-foreground">Lojas ativas</p>
                  <p className="text-xl font-bold">+120</p>
                </div>
                <div className="rounded-lg border p-3">
                  <BadgeCheck className="h-4 w-4 text-emerald-600 mb-1" />
                  <p className="text-xs text-muted-foreground">Pedidos hoje</p>
                  <p className="text-xl font-bold">+890</p>
                </div>
                <div className="rounded-lg border p-3 col-span-2">
                  <Clock3 className="h-4 w-4 text-orange-500 mb-1" />
                  <p className="text-xs text-muted-foreground">Tempo médio de atendimento</p>
                  <p className="text-xl font-bold">22 min</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-gradient-to-r from-primary to-orange-500 text-white p-5">
              <p className="text-sm opacity-90">Demo ao vivo</p>
              <h3 className="text-2xl font-black mt-1">Quer ver funcionando agora?</h3>
              <p className="opacity-90 mt-2">
                Abre uma loja real de teste, monta o carrinho e simula um pedido em menos de 1 minuto.
              </p>
              <Link to={demoHref} className="inline-block mt-4">
                <Button variant="secondary" className="rounded-full">
                  {demoStore ? `Abrir demo da ${demoStore.name}` : "Explorar lojas agora"}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="planos" className="max-w-6xl mx-auto px-4 py-14 scroll-mt-24">
        <div className="rounded-2xl border bg-card p-6 md:p-8 mb-6">
          <p className="text-sm text-muted-foreground">Planos e valores</p>
          <h2 className="text-3xl md:text-4xl font-black mt-1">Cliente entra grátis. Comerciante assina plano.</h2>
          <p className="text-muted-foreground mt-2">
            O acesso de cliente é livre para comprar. Para usar o painel de lojista, escolha um plano.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {pricingPlans.map((plan, index) => (
            <div
              key={plan.name}
              className={`rounded-2xl border bg-card p-6 ${index === 1 ? "border-primary shadow-md" : ""}`}
            >
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{plan.highlight}</p>
              <h3 className="text-2xl font-black mt-1">{plan.name}</h3>
              <p className="text-3xl font-black text-primary mt-4">{plan.price}</p>

              <div className="space-y-2 mt-5">
                {plan.perks.map((perk) => (
                  <p key={perk} className="text-sm flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                    <span>{perk}</span>
                  </p>
                ))}
              </div>

              <Link to="/registro" className="block mt-6">
                <Button className="w-full rounded-full">
                  Quero esse plano
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-14">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
          <div>
            <p className="text-sm text-muted-foreground">Recursos principais</p>
            <h2 className="text-3xl md:text-4xl font-black">Tudo para vender sem dor de cabeça</h2>
          </div>
          <Button variant="outline" className="rounded-full" onClick={scrollToPlans}>Comparar planos</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-2xl border bg-card p-5 hover:shadow-md transition-shadow">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-bold text-lg">{feature.title}</h3>
              <p className="text-sm text-muted-foreground mt-2">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-16">
        <div className="rounded-3xl border bg-card p-8 md:p-12 text-center">
          <h2 className="text-3xl md:text-5xl font-black">Sua loja pronta para vender online hoje.</h2>
          <p className="text-muted-foreground text-lg mt-4 max-w-2xl mx-auto">
            Se você quer algo simples para operar e forte para crescer, esse painel foi feito para você.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap mt-8">
            <Button size="lg" className="h-12 rounded-full px-7" onClick={scrollToPlans}>
              Ver planos de lojista
            </Button>
            <Link to="/cliente">
              <Button size="lg" variant="outline" className="h-12 rounded-full px-7">
                Sou cliente
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} PedeFácil. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}

