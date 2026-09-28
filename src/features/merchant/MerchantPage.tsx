import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowRight, Check, ClipboardList, Clock3, LayoutDashboard, LogOut, Package, Plus, RefreshCw, Settings2, Store as StoreIcon, Users } from "lucide-react";
import { api, money } from "@/app/api";
import { useSession } from "@/app/session";

type Store = {
  id: string; slug: string; name: string; segment: string; phone: string | null;
  street: string | null; number: string | null; neighborhood: string | null;
  city: string | null; state: string | null; zip_code: string | null;
  operation_status: "open" | "closed" | "preorder";
  accepts_preorders: boolean; published_at: string | null;
  business_hours: { weekday: number; opens_at: string; closes_at: string }[];
  delivery_zones: { id: string; name: string; zip_prefix: string; fee_cents: number }[];
};
type Category = { id: string; name: string; sort_order: number };
type Product = { id: string; name: string; description: string | null; price_cents: number; available: boolean; category_id: string | null; option_groups: { id: string; name: string; options: { id: string; name: string; price_delta_cents: number }[] }[] };
type Order = { id: string; order_number: number; status: string; fulfillment_type: string; payment_status: string; customer_name_snapshot: string; total_cents: number; estimated_minutes: number | null; created_at: string };

const statusLabel: Record<string, string> = {
  pending_payment: "Aguardando pagamento", received: "Recebido", confirmed: "Confirmado",
  in_preparation: "Em preparação", ready: "Pronto", out_for_delivery: "Saiu para entrega",
  delivered: "Entregue", cancelled_by_store: "Cancelado", payment_failed: "Pagamento recusado",
};
const nextAction: Record<string, { label: string; status: string }> = {
  received: { label: "Confirmar pedido", status: "confirmed" },
  confirmed: { label: "Iniciar preparo", status: "in_preparation" },
  in_preparation: { label: "Marcar pronto", status: "ready" },
  ready: { label: "Saiu para entrega", status: "out_for_delivery" },
  out_for_delivery: { label: "Confirmar entrega", status: "delivered" },
};
const weekdayName = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export function MerchantPage() {
  const { tab = "visao-geral" } = useParams();
  const { user, loading, logout } = useSession();
  const [store, setStore] = useState<Store | null>(null);
  const [storeLoading, setStoreLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    try {
      const current = await api<Store>("/merchant/store");
      setStore(current);
      const [cats, items, sales] = await Promise.all([
        api<Category[]>("/merchant/categories"), api<Product[]>("/merchant/products"),
        api<Order[]>("/merchant/orders"),
      ]);
      setCategories(cats);
      setProducts(items);
      setOrders(sales);
      setError("");
    } catch (failure) {
      if ((failure as { status?: number }).status === 404) setStore(null);
      else setError(failure instanceof Error ? failure.message : "Falha ao carregar a loja.");
    } finally {
      setStoreLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === "STORE_OWNER") void refresh();
  }, [user, refresh]);
  useEffect(() => {
    if (user?.role !== "STORE_OWNER" || !store) return;
    const timer = window.setInterval(() => {
      void api<Order[]>("/merchant/orders").then(setOrders).catch(() => {});
    }, 10000);
    return () => window.clearInterval(timer);
  }, [user, store]);

  async function run(operation: () => Promise<unknown>, success: string) {
    setError(""); setMessage("");
    try { await operation(); setMessage(success); await refresh(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível concluir."); }
  }

  if (loading || storeLoading && user?.role === "STORE_OWNER") return <div className="panel-loading">Abrindo sua loja...</div>;
  if (!user) return <Navigate to="/entrar" replace />;
  if (user.role !== "STORE_OWNER") return <Navigate to="/" replace />;
  if (!store) return <StoreOnboarding onCreated={refresh} error={error} />;

  const navigation = [
    ["visao-geral", "Visão geral", LayoutDashboard],
    ["pedidos", "Pedidos", ClipboardList],
    ["cardapio", "Cardápio", Package],
    ["clientes", "Clientes", Users],
    ["configuracoes", "Configurações", Settings2],
  ] as const;
  const today = new Date().toDateString();
  const todayOrders = orders.filter((order) => new Date(order.created_at).toDateString() === today && order.payment_status === "paid");
  const salesToday = todayOrders.reduce((sum, order) => sum + order.total_cents, 0);
  const pending = orders.filter((order) => ["received", "confirmed", "in_preparation", "ready", "out_for_delivery"].includes(order.status));

  return <div className="merchant-shell">
    <aside className="merchant-sidebar">
      <Link className="brand" to="/"><img src="/favicon.png" alt="" />Pede<span>Fácil</span></Link>
      <div className="sidebar-store"><small>Minha loja</small><strong>{store.name}</strong><span className={`store-state ${store.operation_status}`}>{store.operation_status === "open" ? "Aberta" : store.operation_status === "preorder" ? "Aceitando encomendas" : "Fechada"}</span></div>
      <nav aria-label="Painel da loja">{navigation.map(([path, label, Icon]) => <Link key={path} className={tab === path ? "selected" : ""} to={`/painel/${path}`}><Icon size={18} />{label}</Link>)}</nav>
      <button className="sidebar-logout" onClick={() => void logout()} type="button"><LogOut size={17} /> Sair da conta</button>
    </aside>
    <div className="merchant-content">
      <header className="merchant-header"><div><small>Área do lojista</small><h1>{tab === "pedidos" ? "Pedidos" : tab === "cardapio" ? "Cardápio" : tab === "configuracoes" ? "Configurações" : tab === "clientes" ? "Clientes" : "Visão geral"}</h1></div><div className="header-actions"><span className={`store-state ${store.operation_status}`}>{store.operation_status === "open" ? "Loja aberta" : "Loja fechada"}</span><button className="icon-button" title="Atualizar dados" aria-label="Atualizar dados" onClick={() => void refresh()}><RefreshCw size={18} /></button></div></header>
      <main className="merchant-main">
        {error && <p className="form-message error" role="alert">{error}</p>}
        {message && <p className="form-message success" role="status">{message}</p>}
        {tab === "visao-geral" && <>
          {!store.published_at && <div className="panel-alert"><div><strong>Sua loja ainda não está publicada.</strong><p>Cadastre horários e produtos, revise o endereço e publique nas configurações.</p></div><Link className="button button-primary" to="/painel/configuracoes">Continuar configuração <ArrowRight size={17} /></Link></div>}
          <div className="panel-metrics"><article><small>Pedidos pagos hoje</small><strong>{todayOrders.length}</strong></article><article><small>Vendas hoje</small><strong>{money(salesToday)}</strong></article><article><small>Ticket médio</small><strong>{todayOrders.length ? money(Math.round(salesToday / todayOrders.length)) : "—"}</strong></article><article><small>Em andamento</small><strong>{pending.length}</strong></article></div>
          <div className="panel-columns"><section className="panel-card"><div className="card-heading"><h2>Pedidos recentes</h2><Link to="/painel/pedidos">Ver todos →</Link></div>{orders.length ? orders.slice(0, 5).map((order) => <div className="simple-row" key={order.id}><b>#{order.order_number}</b><span>{statusLabel[order.status] || order.status}</span><strong>{money(order.total_cents)}</strong></div>) : <EmptyState text="Os pedidos da sua loja aparecerão aqui." />}</section><section className="panel-card"><h2>Próximas ações</h2><div className="action-list"><Link to="/painel/cardapio"><Package size={18} /> Revisar cardápio <ArrowRight size={16} /></Link><Link to="/painel/configuracoes"><Clock3 size={18} /> Ajustar horários <ArrowRight size={16} /></Link><a href={`/loja/${store.slug}`} target="_blank" rel="noopener noreferrer"><StoreIcon size={18} /> Ver link da loja <ArrowRight size={16} /></a></div></section></div>
        </>}
        {tab === "pedidos" && <OrdersView orders={orders} run={run} />}
        {tab === "cardapio" && <CatalogView categories={categories} products={products} run={run} />}
        {tab === "configuracoes" && <SettingsView store={store} run={run} />}
        {tab === "clientes" && <div className="panel-card"><h2>Clientes</h2><EmptyState text="O cadastro de clientes será mostrado aqui após os primeiros pedidos confirmados." /></div>}
      </main>
    </div>
  </div>;
}

function EmptyState({ text }: { text: string }) { return <div className="empty-state"><span>○</span><p>{text}</p></div>; }

function StoreOnboarding({ onCreated, error }: { onCreated: () => Promise<void>; error: string }) {
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setLocalError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api("/merchant/store", { method: "POST", body: JSON.stringify(data) });
      await onCreated();
    } catch (failure) { setLocalError(failure instanceof Error ? failure.message : "Falha ao criar a loja."); }
    finally { setBusy(false); }
  }
  return <div className="onboarding-screen"><Link className="brand" to="/"><img src="/favicon.png" alt="" />Pede<span>Fácil</span></Link><div className="onboarding-card"><span className="eyebrow">Primeiro passo</span><h1>Vamos colocar sua loja no ar.</h1><p>Comece pelos dados básicos. Depois você configura horários, entrega e cardápio.</p><form onSubmit={submit} className="field-grid"><label className="wide">Nome da loja<input name="name" required minLength={3} placeholder="Ex.: Forno da Vila" /></label><label>Segmento<select name="segment" required><option value="pizzaria">Pizzaria</option><option value="hamburgueria">Hamburgueria</option><option value="acaiteria">Açaíteria</option><option value="restaurante">Restaurante</option></select></label><label>Telefone da loja<input name="phone" required placeholder="61999999999" /></label><label className="wide">Rua<input name="street" required /></label><label>Número<input name="number" required /></label><label>Bairro<input name="neighborhood" required /></label><label>Cidade<input name="city" required /></label><label>UF<input name="state" required maxLength={2} /></label><label>CEP<input name="zipCode" required inputMode="numeric" maxLength={8} /></label><button className="button button-primary wide" disabled={busy}>{busy ? "Criando..." : "Criar minha loja"} <ArrowRight size={17} /></button></form>{(localError || error) && <p className="form-message error">{localError || error}</p>}</div></div>;
}

function OrdersView({ orders, run }: { orders: Order[]; run: (op: () => Promise<unknown>, message: string) => Promise<void> }) {
  const [estimate, setEstimate] = useState(30);
  const active = orders.filter((order) => !["delivered", "cancelled_by_store", "payment_failed"].includes(order.status));
  return <><p className="panel-intro">Acompanhe cada pedido da confirmação até a entrega. Pagamentos pendentes não entram na fila de preparo.</p><div className="order-list">{active.length ? active.map((order) => {
    const action = nextAction[order.status] && !(order.status === "ready" && order.fulfillment_type === "pickup") ? nextAction[order.status] : order.status === "ready" ? { label: "Concluir retirada", status: "delivered" } : null;
    return <article className="order-card" key={order.id}><div className="order-top"><strong>Pedido #{order.order_number}</strong><span className={`status-pill ${order.status}`}>{statusLabel[order.status] || order.status}</span></div><div className="order-meta"><span>{order.customer_name_snapshot}</span><span>{order.fulfillment_type === "pickup" ? "Retirada" : "Entrega"}</span><span>{money(order.total_cents)}</span><span>{new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div>{action && <div className="order-actions">{order.status === "received" && <label>Previsão <select value={estimate} onChange={(event) => setEstimate(Number(event.target.value))}><option value={20}>20 min</option><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option></select></label>}<button className="button button-primary" onClick={() => void run(() => api(`/merchant/orders/${order.id}/status`, { method: "PATCH", body: JSON.stringify({ status: action.status, estimatedMinutes: order.status === "received" ? estimate : null }) }), "Pedido atualizado.")}>{action.label} <ArrowRight size={16} /></button></div>}</article>;
  }) : <EmptyState text="Nenhum pedido em andamento." />}</div><h2 className="subheading">Histórico recente</h2><div className="panel-card">{orders.filter((order) => !active.includes(order)).slice(0, 20).map((order) => <div className="simple-row" key={order.id}><b>#{order.order_number}</b><span>{statusLabel[order.status] || order.status}</span><strong>{money(order.total_cents)}</strong></div>)}</div></>;
}

function CatalogView({ categories, products, run }: { categories: Category[]; products: Product[]; run: (op: () => Promise<unknown>, message: string) => Promise<void> }) {
  const [categoryName, setCategoryName] = useState("");
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  async function addCategory(event: FormEvent) { event.preventDefault(); await run(() => api("/merchant/categories", { method: "POST", body: JSON.stringify({ name: categoryName, sortOrder: categories.length }) }), "Categoria criada."); setCategoryName(""); }
  async function addProduct(event: FormEvent) { event.preventDefault(); await run(() => api("/merchant/products", { method: "POST", body: JSON.stringify({ name: productName, priceCents: Math.round(Number(price.replace(",", ".")) * 100), categoryId: categoryId || null, available: true }) }), "Produto criado."); setProductName(""); setPrice(""); }
  return <><p className="panel-intro">Organize o que aparece no cardápio. Produtos indisponíveis deixam de aparecer para o cliente.</p><div className="panel-columns"><section className="panel-card"><h2>Categorias</h2><form className="inline-form" onSubmit={addCategory}><input aria-label="Nome da categoria" required value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Ex.: Pizzas" /><button className="button button-primary"><Plus size={17} /> Adicionar</button></form>{categories.map((category) => <div className="simple-row" key={category.id}>{category.name}</div>)}</section><section className="panel-card"><h2>Novo produto</h2><form className="field-grid" onSubmit={addProduct}><label className="wide">Nome<input required value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="Ex.: Pizza margherita" /></label><label>Preço em reais<input required inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="49,90" /></label><label>Categoria<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Sem categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><button className="button button-primary wide"><Plus size={17} /> Criar produto</button></form></section></div><section className="panel-card"><h2>Produtos ({products.length})</h2>{products.length ? products.map((product) => <div className="product-row" key={product.id}><div><strong>{product.name}</strong><small>{money(product.price_cents)} · {categories.find((category) => category.id === product.category_id)?.name || "Sem categoria"}</small></div><button className={product.available ? "toggle-pill on" : "toggle-pill"} type="button" aria-label={product.available ? `Pausar ${product.name}` : `Disponibilizar ${product.name}`} onClick={() => void run(() => api(`/merchant/products/${product.id}/availability`, { method: "PATCH", body: JSON.stringify({ available: !product.available }) }), "Disponibilidade atualizada.")}>{product.available ? "Disponível" : "Pausado"}</button></div>) : <EmptyState text="Cadastre o primeiro produto para começar seu cardápio." />}</section></>;
}

function SettingsView({ store, run }: { store: Store; run: (op: () => Promise<unknown>, message: string) => Promise<void> }) {
  const [weekday, setWeekday] = useState(1);
  const [opensAt, setOpensAt] = useState("18:00");
  const [closesAt, setClosesAt] = useState("23:00");
  const [hours, setHours] = useState(store.business_hours.map((item) => ({ weekday: item.weekday, opensAt: item.opens_at, closesAt: item.closes_at })));
  const [zoneName, setZoneName] = useState("");
  const [zipPrefix, setZipPrefix] = useState("");
  const [fee, setFee] = useState("");
  const [zones, setZones] = useState(store.delivery_zones.map((item) => ({ name: item.name, zipPrefix: item.zip_prefix, feeCents: item.fee_cents, minimumOrderCents: 0 })));
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/loja/${store.slug}`;
  return <><p className="panel-intro">A loja só publica depois de ter endereço, telefone, horário e produto disponível.</p><div className="panel-columns"><section className="panel-card"><h2>Operação</h2><p>Estado atual: <strong>{store.operation_status === "open" ? "Aberta" : store.operation_status === "preorder" ? "Encomendas" : "Fechada"}</strong></p><div className="settings-actions"><button className="button button-primary" onClick={() => void run(() => api("/merchant/store/operation", { method: "PATCH", body: JSON.stringify({ status: store.operation_status === "open" ? "closed" : "open", acceptsPreorders: store.accepts_preorders }) }), "Estado da loja atualizado.")}>{store.operation_status === "open" ? "Fechar loja" : "Abrir loja"}</button><button className="button button-outline" onClick={() => void run(() => api("/merchant/store/operation", { method: "PATCH", body: JSON.stringify({ status: "preorder", acceptsPreorders: true }) }), "Encomendas ativadas.")}>Aceitar encomendas</button></div></section><section className="panel-card"><h2>Link da loja</h2><p className="store-link">{link}</p><div className="settings-actions"><button className="button button-outline" onClick={() => void navigator.clipboard.writeText(link).then(() => setCopied(true))}>{copied ? "Link copiado" : "Copiar link"}</button><a className="button button-outline" href={link} target="_blank" rel="noopener noreferrer">Abrir cardápio ↗</a></div><p className="settings-hint">{store.published_at ? "Loja publicada." : "O link começa a funcionar após a publicação."}</p></section></div><div className="panel-columns"><section className="panel-card"><h2>Horários</h2><div className="field-grid"><label>Dia<select value={weekday} onChange={(event) => setWeekday(Number(event.target.value))}>{weekdayName.slice(1).map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label><label>Abre<input type="time" value={opensAt} onChange={(event) => setOpensAt(event.target.value)} /></label><label>Fecha<input type="time" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} /></label><button className="button button-outline" onClick={() => setHours([...hours, { weekday, opensAt, closesAt }])}><Plus size={16} /> Adicionar</button></div>{hours.map((hour, index) => <div className="simple-row" key={index}>{weekdayName[hour.weekday]} · {hour.opensAt}–{hour.closesAt}<button className="text-button" onClick={() => setHours(hours.filter((_, item) => item !== index))}>Remover</button></div>)}<button className="button button-primary save-button" onClick={() => void run(() => api("/merchant/store/hours", { method: "PUT", body: JSON.stringify(hours) }), "Horários salvos.")}>Salvar horários</button></section><section className="panel-card"><h2>Taxas de entrega</h2><div className="field-grid"><label>Região<input value={zoneName} onChange={(event) => setZoneName(event.target.value)} placeholder="Ex.: Centro" /></label><label>Prefixo do CEP<input inputMode="numeric" value={zipPrefix} onChange={(event) => setZipPrefix(event.target.value)} placeholder="Ex.: 700" /></label><label>Taxa em reais<input inputMode="decimal" value={fee} onChange={(event) => setFee(event.target.value)} placeholder="Ex.: 6,00" /></label><button className="button button-outline" onClick={() => { if (!zoneName || !zipPrefix || !fee) return; setZones([...zones, { name: zoneName, zipPrefix, feeCents: Math.round(Number(fee.replace(",", ".")) * 100), minimumOrderCents: 0 }]); setZoneName(""); setZipPrefix(""); setFee(""); }}><Plus size={16} /> Adicionar</button></div>{zones.map((zone, index) => <div className="simple-row" key={index}>{zone.name} · CEP {zone.zipPrefix} · {money(zone.feeCents)}<button className="text-button" onClick={() => setZones(zones.filter((_, item) => item !== index))}>Remover</button></div>)}<button className="button button-primary save-button" onClick={() => void run(() => api("/merchant/store/delivery-zones", { method: "PUT", body: JSON.stringify(zones) }), "Taxas salvas.")}>Salvar taxas</button></section></div>{!store.published_at && <div className="panel-alert"><div><strong>Pronto para publicar?</strong><p>O sistema verifica telefone, endereço, horário e produto disponível.</p></div><button className="button button-primary" onClick={() => void run(() => api("/merchant/store/publish", { method: "POST" }), "Sua loja foi publicada.")}>Publicar loja <Check size={17} /></button></div>}</>;
}
