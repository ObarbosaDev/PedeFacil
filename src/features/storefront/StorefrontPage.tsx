import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Minus, Plus, Search, ShoppingBag, X } from "lucide-react";
import { api, money } from "@/app/api";

type Option = { id: string; name: string; price_delta_cents: number };
type Group = { id: string; name: string; min_select: number; max_select: number; options: Option[] };
type Product = { id: string; category_id: string | null; name: string; description: string | null; price_cents: number; image_path: string | null; option_groups: Group[] };
type Category = { id: string; name: string };
type Store = { id: string; slug: string; name: string; description: string | null; logo_path: string | null; cover_path: string | null; operation_status: string; accepts_preorders: boolean; delivery_enabled: boolean; pickup_enabled: boolean };
type Menu = { store: Store; categories: Category[]; products: Product[] };
type CartItem = { key: string; productId: string; name: string; unitCents: number; quantity: number; optionIds: string[]; optionNames: string[] };
type Quote = { subtotal_cents: number; discount_cents: number; delivery_fee_cents: number; total_cents: number };

function readCart(slug: string): CartItem[] {
  try { return JSON.parse(localStorage.getItem(`pf-cart-${slug}`) || "[]") as CartItem[]; }
  catch { return []; }
}

export function StorefrontPage() {
  const { slug = "" } = useParams();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [cart, setCart] = useState<CartItem[]>(() => readCart(slug));
  const [selected, setSelected] = useState<Product | null>(null);
  const [choiceIds, setChoiceIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [fulfillmentType, setFulfillmentType] = useState<"delivery" | "pickup">("delivery");
  const [zipCode, setZipCode] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    api<Menu>(`/public/stores/${encodeURIComponent(slug)}/menu`)
      .then(setMenu).catch((failure) => setError(failure.message)).finally(() => setLoading(false));
  }, [slug]);
  useEffect(() => { localStorage.setItem(`pf-cart-${slug}`, JSON.stringify(cart)); setQuote(null); }, [cart, slug]);
  const cartTotal = cart.reduce((sum, item) => sum + item.unitCents * item.quantity, 0);
  const filtered = useMemo(() => menu?.products.filter((product) =>
    (!selectedCategory || product.category_id === selectedCategory)
    && product.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))) || [], [menu, search, selectedCategory]);

  function addToCart() {
    if (!selected) return;
    for (const group of selected.option_groups) {
      const count = group.options.filter((option) => choiceIds.includes(option.id)).length;
      if (count < group.min_select || count > group.max_select) {
        setError(`Escolha de ${group.min_select} a ${group.max_select} em ${group.name}.`);
        return;
      }
    }
    const options = selected.option_groups.flatMap((group) => group.options).filter((option) => choiceIds.includes(option.id));
    const key = [selected.id, ...options.map((option) => option.id).sort()].join(":");
    const unitCents = selected.price_cents + options.reduce((sum, option) => sum + option.price_delta_cents, 0);
    setCart((current) => {
      const exists = current.find((item) => item.key === key);
      if (exists) return current.map((item) => item.key === key ? { ...item, quantity: item.quantity + quantity } : item);
      return [...current, { key, productId: selected.id, name: selected.name, unitCents, quantity, optionIds: options.map((option) => option.id), optionNames: options.map((option) => option.name) }];
    });
    setSelected(null); setError("");
  }

  function changeQuantity(key: string, difference: number) {
    setCart((current) => current.map((item) => item.key === key ? { ...item, quantity: item.quantity + difference } : item)
      .filter((item) => item.quantity > 0));
  }

  async function calculate(event: FormEvent) {
    event.preventDefault(); setError(""); setQuote(null);
    try {
      const result = await api<Quote>(`/public/stores/${encodeURIComponent(slug)}/quote`, {
        method: "POST",
        body: JSON.stringify({
          items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity, optionIds: item.optionIds })),
          fulfillmentType, zipCode: zipCode.replace(/\D/g, ""), couponCode,
        }),
      });
      setQuote(result);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "NÃ£o foi possÃ­vel calcular o pedido."); }
  }

  if (loading) return <div className="storefront-loading">Abrindo cardÃ¡pio...</div>;
  if (!menu) return <div className="storefront-loading"><p>{error || "Loja nÃ£o encontrada."}</p><Link to="/">Voltar ao inÃ­cio</Link></div>;
  const closed = menu.store.operation_status !== "open";
  return <div className="storefront">
    <header className="storefront-header"><div className="storefront-header-inner"><Link to="/" className="brand"><img src="/favicon.png" alt="" />Pede<span>FÃ¡cil</span></Link><span>CardÃ¡pio da loja</span></div></header>
    <div className="store-cover"><div className="storefront-container"><span className="store-cover-mark">ðŸ½</span><h1>{menu.store.name}</h1><p>{menu.store.description || "Escolha o que vai pedir hoje."}</p></div></div>
    <div className="storefront-container">
      <div className={closed ? "store-status closed" : "store-status"}><strong>{closed ? "Estamos fechados agora." : "Aberta para pedidos"}</strong><span>{closed ? menu.store.accepts_preorders ? "VocÃª pode montar o carrinho e consultar o prÃ³ximo horÃ¡rio." : "Confira o cardÃ¡pio e volte no horÃ¡rio de funcionamento." : "Monte seu pedido pelo cardÃ¡pio."}</span></div>
      <div className="storefront-layout"><main><div className="menu-heading"><div><span className="eyebrow">CardÃ¡pio</span><h2>Escolha seus favoritos.</h2></div><label className="menu-search"><Search size={18} /><input aria-label="Buscar no cardÃ¡pio" placeholder="Buscar produto" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
        <nav className="category-list" aria-label="Categorias do cardÃ¡pio"><button type="button" className={!selectedCategory ? "active" : ""} onClick={() => setSelectedCategory(null)}>Todos</button>{menu.categories.map((category) => <button type="button" className={selectedCategory === category.id ? "active" : ""} key={category.id} onClick={() => setSelectedCategory(category.id)}>{category.name}</button>)}</nav>
        <section id="todos" className="menu-section"><h3>{search ? "Resultados" : selectedCategory ? menu.categories.find((category) => category.id === selectedCategory)?.name : "Todos os produtos"}</h3><div className="menu-grid">{filtered.length ? filtered.map((product) => <button type="button" className="menu-product" key={product.id} onClick={() => { setSelected(product); setChoiceIds([]); setQuantity(1); setError(""); }}><span className="product-photo">{product.image_path ? <img src={product.image_path} alt="" /> : "ðŸ´"}</span><span className="product-info"><strong>{product.name}</strong><small>{product.description || "Preparado pela loja."}</small><b>{money(product.price_cents)}</b></span><span className="product-add"><Plus size={18} /></span></button>) : <p className="menu-empty">Nenhum produto encontrado.</p>}</div></section>
      </main><aside className="cart-panel"><div className="cart-title"><ShoppingBag size={19} /><h2>Seu pedido</h2><span>{cart.reduce((sum, item) => sum + item.quantity, 0)}</span></div>{cart.length ? <><div className="cart-items">{cart.map((item) => <div className="cart-item" key={item.key}><strong>{item.name}</strong>{item.optionNames.length > 0 && <small>{item.optionNames.join(", ")}</small>}<div><span>{money(item.unitCents * item.quantity)}</span><span className="quantity-control"><button aria-label={`Remover uma unidade de ${item.name}`} onClick={() => changeQuantity(item.key, -1)}><Minus size={13} /></button>{item.quantity}<button aria-label={`Adicionar uma unidade de ${item.name}`} onClick={() => changeQuantity(item.key, 1)}><Plus size={13} /></button></span></div></div>)}</div><div className="cart-total"><span>Subtotal</span><strong>{money(cartTotal)}</strong></div><button className="button button-primary" onClick={() => setCheckoutOpen(true)}>Revisar pedido <ArrowRight size={17} /></button></> : <p className="cart-empty">Adicione um produto para comeÃ§ar.</p>}</aside></div>
    </div>
    {cart.length > 0 && !checkoutOpen && <button className="mobile-cart-button" onClick={() => setCheckoutOpen(true)}><ShoppingBag size={18} /> Ver pedido Â· {money(cartTotal)} <ArrowRight size={17} /></button>}
    {selected && <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelected(null)}><section className="product-modal" role="dialog" aria-modal="true" aria-label={selected.name} onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" aria-label="Fechar produto" onClick={() => setSelected(null)}><X size={20} /></button><span className="modal-product-photo">{selected.image_path ? <img src={selected.image_path} alt="" /> : "ðŸ´"}</span><h2>{selected.name}</h2><p>{selected.description}</p>{selected.option_groups.map((group) => <fieldset className="option-group" key={group.id}><legend>{group.name} <small>Escolha {group.min_select} a {group.max_select}</small></legend>{group.options.map((option) => <label key={option.id}><input type="checkbox" checked={choiceIds.includes(option.id)} onChange={(event) => setChoiceIds((current) => event.target.checked ? [...current, option.id] : current.filter((id) => id !== option.id))} /><span>{option.name}</span><b>+ {money(option.price_delta_cents)}</b></label>)}</fieldset>)}{error && <p className="form-message error">{error}</p>}<div className="modal-actions"><div className="quantity-control"><button aria-label="Diminuir quantidade" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={16} /></button>{quantity}<button aria-label="Aumentar quantidade" onClick={() => setQuantity(Math.min(50, quantity + 1))}><Plus size={16} /></button></div><button className="button button-primary" onClick={addToCart}>Adicionar Â· {money((selected.price_cents + selected.option_groups.flatMap((group) => group.options).filter((option) => choiceIds.includes(option.id)).reduce((sum, option) => sum + option.price_delta_cents, 0)) * quantity)}</button></div></section></div>}
    {checkoutOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setCheckoutOpen(false)}><section className="checkout-modal" role="dialog" aria-modal="true" aria-label="Revisar pedido" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" aria-label="Fechar revisÃ£o" onClick={() => setCheckoutOpen(false)}><X size={20} /></button><button className="back-link" onClick={() => setCheckoutOpen(false)}><ArrowLeft size={16} /> Voltar ao cardÃ¡pio</button><span className="eyebrow">Seu pedido</span><h2>Confira antes de continuar.</h2><div className="checkout-lines">{cart.map((item) => <div key={item.key}><span>{item.quantity}Ã— {item.name}</span><strong>{money(item.unitCents * item.quantity)}</strong></div>)}</div><form onSubmit={calculate} className="checkout-form"><div className="fulfillment-options"><label><input type="radio" name="fulfillment" checked={fulfillmentType === "delivery"} onChange={() => setFulfillmentType("delivery")} /> Entrega</label><label><input type="radio" name="fulfillment" checked={fulfillmentType === "pickup"} onChange={() => setFulfillmentType("pickup")} /> Retirada</label></div>{fulfillmentType === "delivery" && <label>CEP da entrega<input required inputMode="numeric" maxLength={9} value={zipCode} onChange={(event) => setZipCode(event.target.value)} placeholder="00000000" /></label>}<label>Cupom (opcional)<input value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder="Digite o cÃ³digo" /></label><button className="button button-outline" type="submit">Calcular total</button></form>{error && <p className="form-message error">{error}</p>}{quote && <div className="quote-result"><div><span>Subtotal</span><strong>{money(quote.subtotal_cents)}</strong></div><div><span>Entrega</span><strong>{money(quote.delivery_fee_cents)}</strong></div>{quote.discount_cents > 0 && <div><span>Desconto</span><strong>âˆ’ {money(quote.discount_cents)}</strong></div>}<div className="quote-final"><span>Total</span><strong>{money(quote.total_cents)}</strong></div><p>O pagamento ainda estÃ¡ em homologaÃ§Ã£o. A finalizaÃ§Ã£o do pedido serÃ¡ liberada apÃ³s os testes financeiros.</p></div>}</section></div>}
  </div>;
}
