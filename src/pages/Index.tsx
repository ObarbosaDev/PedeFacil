import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingBag, MessageCircle, BarChart3, Star, ArrowRight, Store, Clock3, BadgeCheck, Sparkles } from "lucide-react";

const features = [
  {
    icon: ShoppingBag,
    title: "Cardapio que vende",
    desc: "Seu cliente escolhe, adiciona no carrinho e fecha o pedido sem complicacao.",
  },
  {
    icon: MessageCircle,
    title: "Pedido no WhatsApp",
    desc: "O pedido ja sai formatado e pronto para voce responder mais rapido.",
  },
  {
    icon: BarChart3,
    title: "Painel com visao real",
    desc: "Acompanhe pedidos, faturamento e operacao sem planilha improvisada.",
  },
  {
    icon: Star,
    title: "Clientes VIP",
    desc: "Fidelidade com pontos para trazer o cliente de volta com frequencia.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-24 right-0 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-orange-300/20 blur-3xl" />
      </div>

      <nav className="border-b bg-card/85 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-1">
            <span className="text-2xl font-extrabold text-primary">Pede</span>
            <span className="text-2xl font-extrabold">Facil</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/cliente">
              <Button variant="outline" className="rounded-full">Sou cliente</Button>
            </Link>
            <Link to="/login">
              <Button variant="ghost" className="rounded-full">Entrar</Button>
            </Link>
            <Link to="/registro">
              <Button className="rounded-full">Cadastrar loja</Button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-4 pt-16 pb-10">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium mb-5">
              <Sparkles className="h-4 w-4 text-primary" />
              Plataforma feita para negocio de comida local
            </div>

            <h1 className="text-4xl md:text-6xl font-black leading-tight">
              Seu delivery mais profissional, sem perder o jeito da sua marca.
            </h1>

            <p className="text-lg text-muted-foreground mt-5 max-w-xl">
              Crie seu cardapio digital, receba pedidos no WhatsApp e gerencie tudo em um painel bonito e pratico.
            </p>

            <div className="flex flex-wrap gap-3 mt-7">
              <Link to="/registro">
                <Button size="lg" className="h-12 px-6 text-base rounded-full">
                  Quero vender agora <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/cliente">
                <Button size="lg" variant="outline" className="h-12 px-6 text-base rounded-full">
                  Ver lojas disponiveis
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-8">
              <div className="rounded-xl border bg-card p-3">
                <p className="text-xs text-muted-foreground">Setup</p>
                <p className="text-lg font-bold">Rapido</p>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <p className="text-xs text-muted-foreground">Pedidos</p>
                <p className="text-lg font-bold">Em tempo real</p>
              </div>
              <div className="rounded-xl border bg-card p-3 col-span-2 sm:col-span-1">
                <p className="text-xs text-muted-foreground">Suporte</p>
                <p className="text-lg font-bold">Fluxo simples</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Visao do lojista</p>
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
                  <p className="text-xs text-muted-foreground">Tempo medio de atendimento</p>
                  <p className="text-xl font-bold">22 min</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-gradient-to-r from-primary to-orange-500 text-white p-5">
              <p className="text-sm opacity-90">Demo rapida</p>
              <h3 className="text-2xl font-black mt-1">Quer ver funcionando agora?</h3>
              <p className="opacity-90 mt-2">Abre uma loja teste, monta o carrinho e simula o pedido em menos de 1 minuto.</p>
              <Link to="/loja/hamburgueria-do-joao" className="inline-block mt-4">
                <Button variant="secondary" className="rounded-full">
                  Abrir demonstracao
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-14">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
          <div>
            <p className="text-sm text-muted-foreground">Recursos principais</p>
            <h2 className="text-3xl md:text-4xl font-black">Tudo para vender sem dor de cabeca</h2>
          </div>
          <Link to="/registro">
            <Button variant="outline" className="rounded-full">Comecar gratis</Button>
          </Link>
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
          <h2 className="text-3xl md:text-5xl font-black">Seu negocio pronto para vender online hoje.</h2>
          <p className="text-muted-foreground text-lg mt-4 max-w-2xl mx-auto">
            Se quiser algo simples para operar e forte para crescer, esse painel foi feito para voce.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap mt-8">
            <Link to="/registro">
              <Button size="lg" className="h-12 rounded-full px-7">
                Criar minha conta
              </Button>
            </Link>
            <Link to="/cliente">
              <Button size="lg" variant="outline" className="h-12 rounded-full px-7">
                Sou cliente
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} PedeFacil. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
