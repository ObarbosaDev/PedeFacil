import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, Clock3, Link2, Menu, PackageCheck, Pizza, Repeat2, ShoppingBag, X } from "lucide-react";

const pilotHref = "https://wa.me/5561984629093?text="
  + encodeURIComponent("Olá! Quero participar do piloto do Pede Fácil com a minha loja.");

const stages = [
  { name: "Pedido chegando", status: "Recebido", detail: "Itens, forma de entrega e pagamento aparecem juntos.", icon: ShoppingBag },
  { name: "Preparação", status: "Em preparação", detail: "A equipe vê o que precisa preparar e o prazo informado.", icon: Clock3 },
  { name: "Entrega", status: "Pronto para sair", detail: "A loja acompanha a saída e a confirmação da entrega.", icon: PackageCheck },
  { name: "Recompra", status: "Pedido concluído", detail: "O histórico facilita repetir a compra em outro dia.", icon: Repeat2 },
] as const;

const faq = [
  ["Preciso sair do iFood?", "Não. Seu link próprio funciona como mais um canal para clientes que já conhecem sua loja."],
  ["Existe comissão por pedido?", "A proposta comercial é uma assinatura mensal sem percentual do Pede Fácil sobre cada venda. O provedor de pagamento cobra suas próprias taxas."],
  ["Quem recebe o pagamento?", "A configuração financeira de cada loja será confirmada durante o piloto, antes de processar uma venda real."],
  ["O cliente precisa baixar aplicativo?", "Não. Ele abre o cardápio pelo navegador do celular."],
  ["Preciso ter entregador?", "Para retirada, não. Nas entregas, a loja usa sua equipe ou entregadores convidados."],
  ["Vocês montam o cardápio?", "No piloto, a implantação é guiada para colocar a primeira versão da loja no ar."],
  ["Quanto tempo leva para publicar?", "A meta é publicar em até 30 minutos com apoio, ou em até 48 horas quando nossa equipe fizer a implantação."],
] as const;

export function LandingPage() {
  const [stage, setStage] = useState(0);
  const [mobileMenu, setMobileMenu] = useState(false);
  const StageIcon = stages[stage].icon;
  return (
    <div className="landing">
      <a className="skip-link" href="#conteudo">Ir para o conteúdo</a>
      <header className="landing-header">
        <Link className="brand" to="/" aria-label="Pede Fácil, início">
          <img src="/favicon.png" alt="" />Pede<span>Fácil</span>
        </Link>
        <nav className={mobileMenu ? "nav-links open" : "nav-links"} aria-label="Navegação principal">
          <a href="#produto" onClick={() => setMobileMenu(false)}>Produto</a>
          <a href="#como-funciona" onClick={() => setMobileMenu(false)}>Como funciona</a>
          <a href="#resultados" onClick={() => setMobileMenu(false)}>Resultados</a>
          <a href="#precos" onClick={() => setMobileMenu(false)}>Preços</a>
        </nav>
        <div className="nav-actions">
          <Link className="nav-login" to="/entrar">Entrar</Link>
          <a className="button button-primary nav-cta" href={pilotHref} target="_blank" rel="noopener noreferrer">Quero vender direto <ArrowRight size={17} /></a>
          <button className="menu-toggle" type="button" aria-label={mobileMenu ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileMenu} onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      <main id="conteudo">
        <section className="hero section-wrap">
          <div className="hero-copy">
            <span className="eyebrow eyebrow-pill"><span /> Seu canal próprio, sem comissão por pedido</span>
            <h1>Venda direto.<br />Faça o cliente <em>voltar.</em></h1>
            <p>Cardápio, pedidos, pagamentos e recompra em um só lugar. Sua loja vende pelo próprio link e mantém o relacionamento com cada cliente.</p>
            <div className="hero-actions">
              <a className="button button-primary button-large" href={pilotHref} target="_blank" rel="noopener noreferrer">
                Quero colocar minha loja no ar <ArrowRight size={19} />
              </a>
              <a className="button button-ghost button-large" href="#demonstracao">Ver um pedido acontecendo</a>
            </div>
            <p className="hero-note">Implantação guiada <span>·</span> Atendimento humano <span>·</span> Piloto para restaurantes independentes</p>
          </div>
          <div className="hero-visual" aria-label="Demonstração ilustrativa do fluxo de pedidos">
            <div className="visual-glow" />
            <div className="demo-window">
              <div className="demo-topbar"><span className="demo-dots"><i /><i /><i /></span><span>Painel da loja · demonstração</span><span className="demo-live">● Operação</span></div>
              <div className="demo-body">
                <div className="demo-sidebar"><img src="/favicon.png" alt="" /><span className="active">Pedidos</span><span>Cardápio</span><span>Clientes</span></div>
                <div className="demo-main">
                  <span className="eyebrow">Fila de pedidos</span>
                  <h2>Uma ação por vez.<br />Tudo no lugar.</h2>
                  <div className="demo-card">
                    <div className="demo-card-head"><span>Pedido de exemplo</span><strong>{stages[stage].status}</strong></div>
                    <div className="demo-item"><span className="demo-food"><Pizza size={25} strokeWidth={1.8} /></span><div><b>Pizza da casa</b><small>1 unidade · sem cebola</small></div></div>
                    <div className="demo-card-foot"><span><StageIcon size={16} /> {stages[stage].detail}</span></div>
                  </div>
                  <div className="demo-progress">{stages.map((item, index) => (
                    <button key={item.name} type="button" aria-label={`Mostrar ${item.name}`}
                      aria-pressed={stage === index} className={stage === index ? "on" : ""}
                      onClick={() => setStage(index)}>{index + 1}</button>
                  ))}</div>
                </div>
              </div>
            </div>
            <div className="floating-note"><span className="floating-icon"><Check size={18} /></span><div><b>Do cardápio à entrega</b><small>Um fluxo que sua equipe entende.</small></div></div>
          </div>
        </section>

        <section id="resultados" className="statement section-wrap">
          <span className="eyebrow">O ponto de partida</span>
          <h2>O problema não é só receber pedidos.<br /><em>É perder o cliente depois da primeira compra.</em></h2>
          <div className="outcome-grid">
            <span>Pedidos organizados</span><span>Cliente identificado</span><span>Canal direto</span><span>Recompra mensurável</span>
          </div>
        </section>

        <section id="produto" className="product-section section-wrap">
          <div className="section-heading"><span className="eyebrow">Um produto, quatro resultados</span><h2>Menos atrito para vender.<br /><em>Mais clareza para operar.</em></h2></div>
          <div className="feature-grid">
            <article><span className="feature-icon"><Link2 size={25} /></span><small>01 / Venda</small><h3>Seu link. Sua marca.</h3><p>Um cardápio rápido para o cliente comprar pelo celular sem baixar aplicativo ou criar senha.</p></article>
            <article><span className="feature-icon"><ShoppingBag size={25} /></span><small>02 / Opere</small><h3>Pedidos em ordem.</h3><p>Uma fila clara, da confirmação ao preparo, com a próxima ação sempre visível.</p></article>
            <article><span className="feature-icon"><PackageCheck size={25} /></span><small>03 / Entregue</small><h3>Entrega sob controle.</h3><p>Atribua cada pedido aos entregadores da loja e acompanhe a conclusão.</p></article>
            <article><span className="feature-icon"><Repeat2 size={25} /></span><small>04 / Relacione</small><h3>Faça voltar.</h3><p>Histórico e cupons ajudam a transformar uma compra em uma relação contínua.</p></article>
          </div>
        </section>

        <section id="como-funciona" className="steps-section">
          <div className="section-wrap"><div className="section-heading"><span className="eyebrow">Da primeira conversa ao primeiro pedido</span><h2>Simples de publicar.<br /><em>Claro de usar.</em></h2></div>
            <div className="steps-grid">
              {[
                ["01", "Montamos sua loja", "Configuramos horários, entrega e cardápio junto com você."],
                ["02", "Você divulga o link", "Coloque no Instagram, WhatsApp, embalagem e balcão."],
                ["03", "Os pedidos chegam", "Sua equipe confirma, prepara e entrega em uma fila única."],
                ["04", "O cliente volta", "O histórico abre caminho para uma nova compra direta."],
              ].map(([number, title, detail]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{detail}</p></article>)}
            </div>
          </div>
        </section>

        <section id="demonstracao" className="demo-section section-wrap">
          <div className="section-heading"><span className="eyebrow">Demonstração do fluxo</span><h2>Veja como um pedido <em>anda.</em></h2><p>Exemplo interativo para conhecer as etapas. Nenhum pedido ou resultado exibido é dado de cliente.</p></div>
          <div className="demo-tabs" role="tablist" aria-label="Etapas do pedido">
            {stages.map((item, index) => <button key={item.name} role="tab" aria-selected={stage === index} className={stage === index ? "selected" : ""}
              onClick={() => setStage(index)} type="button">{item.name}</button>)}
          </div>
          <div className="demo-detail"><StageIcon size={36} /><div><span className="eyebrow">Etapa {stage + 1} de 4</span><h3>{stages[stage].status}</h3><p>{stages[stage].detail}</p></div></div>
        </section>

        <section id="precos" className="pricing-section">
          <div className="section-wrap"><div className="section-heading"><span className="eyebrow">Planos previstos para o piloto</span><h2>Preço claro para <em>vender direto.</em></h2><p>Os recursos serão confirmados com cada loja antes da contratação.</p></div>
            <div className="pricing-grid">
              <article><span className="plan-name">Direto</span><div className="plan-price">R$ 129 <small>/ mês</small></div><p>Para publicar seu canal próprio e organizar a operação.</p>
                <ul><li><Check size={17} /> Cardápio e link da loja</li><li><Check size={17} /> Pedidos e clientes</li><li><Check size={17} /> Cupons e relatório essencial</li></ul>
                <a className="button button-outline" href={pilotHref} target="_blank" rel="noopener noreferrer">Conversar sobre o piloto <ArrowRight size={17} /></a></article>
              <article className="featured"><span className="plan-name">Crescimento</span><div className="plan-price">R$ 249 <small>/ mês</small></div><p>Para trabalhar a base de clientes e acompanhar recompra.</p>
                <ul><li><Check size={17} /> Tudo do Direto</li><li><Check size={17} /> Campanhas e automações</li><li><Check size={17} /> Relatórios de recompra</li></ul>
                <a className="button button-primary" href={pilotHref} target="_blank" rel="noopener noreferrer">Quero participar do piloto <ArrowRight size={17} /></a></article>
            </div>
          </div>
        </section>

        <section className="faq-section section-wrap"><div className="section-heading"><span className="eyebrow">Perguntas frequentes</span><h2>Sem letra pequena.<br /><em>Respostas diretas.</em></h2></div>
          <div className="faq-list">{faq.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={19} /></summary><p>{answer}</p></details>)}</div>
        </section>
        <section className="closing-section section-wrap"><span className="eyebrow">Seu próximo canal de vendas</span><h2>Deixe a próxima compra<br />acontecer <em>na sua loja.</em></h2><a className="button button-primary button-large" href={pilotHref} target="_blank" rel="noopener noreferrer">Quero conversar sobre o piloto <ArrowRight size={19} /></a></section>
      </main>
      <footer className="landing-footer section-wrap"><Link className="brand" to="/"><img src="/favicon.png" alt="" />Pede<span>Fácil</span></Link><p>Pedidos diretos para restaurantes independentes.</p><div><a href={pilotHref} target="_blank" rel="noopener noreferrer">WhatsApp</a><Link to="/entrar">Entrar</Link></div><small>© {new Date().getFullYear()} Pede Fácil. Produto em fase de piloto.</small></footer>
    </div>
  );
}
