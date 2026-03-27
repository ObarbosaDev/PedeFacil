import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingBag, MessageCircle, BarChart3, Star, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1">
            <span className="text-2xl font-extrabold text-primary">Pede</span>
            <span className="text-2xl font-extrabold">Fácil</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost">Entrar</Button>
            </Link>
            <Link to="/registro">
              <Button>Começar Grátis</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-full text-sm font-medium mb-6">
          🚀 A plataforma #1 para pequenos negócios
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6">
          Venda mais com seu
          <br />
          <span className="text-primary">cardápio digital</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Crie seu cardápio online em minutos, receba pedidos via WhatsApp e gerencie tudo em um painel simples e poderoso.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link to="/registro">
            <Button size="lg" className="text-lg px-8 h-14 rounded-full">
              Criar Meu Cardápio <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Link to="/loja/hamburgueria-do-joao">
            <Button size="lg" variant="outline" className="text-lg px-8 h-14 rounded-full">
              Ver Demonstração
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Tudo que você precisa para vender online</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: ShoppingBag, title: "Cardápio Digital", desc: "Cardápio bonito e profissional, acessível por link. Seus clientes pedem com facilidade." },
            { icon: MessageCircle, title: "Pedidos via WhatsApp", desc: "Pedidos são enviados direto para o seu WhatsApp, formatados e prontos." },
            { icon: BarChart3, title: "Dashboard", desc: "Acompanhe pedidos, receita e clientes em tempo real no seu painel." },
            { icon: Star, title: "Programa de Fidelidade", desc: "Fidelize clientes com pontos automáticos a cada pedido." },
          ].map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-2xl border bg-card hover:shadow-lg transition-shadow"
            >
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-extrabold mb-4">Comece a vender hoje mesmo</h2>
          <p className="text-xl opacity-90 mb-8">Crie sua conta grátis e tenha seu cardápio digital em minutos.</p>
          <Link to="/registro">
            <Button size="lg" variant="secondary" className="text-lg px-8 h-14 rounded-full">
              Criar Conta Grátis <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} PedeFácil. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
