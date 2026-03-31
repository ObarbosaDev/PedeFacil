import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import ProductCard from "@/components/store/ProductCard";
import CartDrawer from "@/components/store/CartDrawer";
import { ShoppingCart, MapPin, Clock, Phone, Search, Sparkles, Flame, Star, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatPhone } from "@/lib/formatters";
import { trackCheckoutEvent } from "@/lib/analytics";
import { Card, CardContent } from "@/components/ui/card";

export default function PublicMenu() {
  const { slug } = useParams<{ slug: string }>();
  const { addItem, itemCount } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: establishment, isLoading: loadingStore } = useQuery({
    queryKey: ["public-establishment", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("establishments")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!establishment?.id) return;
    void trackCheckoutEvent({
      establishmentId: establishment.id,
      eventName: "menu_view",
      metadata: { slug: establishment.slug },
    });
  }, [establishment?.id, establishment?.slug]);

  const handleAddItem = (item: { id: string; name: string; price: number; image_url?: string | null }) => {
    addItem(item);
    void trackCheckoutEvent({
      establishmentId: establishment?.id,
      eventName: "add_to_cart",
      metadata: { productId: item.id, productName: item.name, price: item.price },
    });
  };

  const { data: categories = [] } = useQuery({
    queryKey: ["public-categories", establishment?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("*")
        .eq("establishment_id", establishment!.id)
        .order("sort_order");
      return data || [];
    },
    enabled: !!establishment,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["public-products", establishment?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("establishment_id", establishment!.id)
        .order("name");
      return data || [];
    },
    enabled: !!establishment,
  });

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p: any) => {
      const name = String(p.name || "").toLowerCase();
      const description = String(p.description || "").toLowerCase();
      return name.includes(q) || description.includes(q);
    });
  }, [products, search]);

  const getProductsByCategory = (categoryId: string) => filteredProducts.filter((p: any) => p.category_id === categoryId);
  const uncategorized = filteredProducts.filter((p: any) => !p.category_id);
  const availableCount = filteredProducts.filter((p: any) => p.is_available).length;

  if (loadingStore) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/30">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!establishment) {
    return (
      <div className="flex items-center justify-center min-h-screen text-center p-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Loja não encontrada</h1>
          <p className="text-muted-foreground">Confere o link e tenta de novo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-24 right-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-orange-300/20 blur-3xl" />
        <div className="absolute top-1/3 left-1/3 h-72 w-72 rounded-full bg-amber-100/40 blur-3xl" />
      </div>

      <header className="border-b bg-card/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-5 space-y-4">
          <div>
            <Link to="/cliente" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Voltar para lojas
            </Link>
          </div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4">
              {establishment.logo_url ? (
                <img
                  src={establishment.logo_url}
                  alt={establishment.name}
                  className="h-16 w-16 rounded-2xl object-cover border shadow-sm"
                />
              ) : (
                <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl font-black border shadow-sm">
                  {String(establishment.name).slice(0, 1).toUpperCase()}
                </div>
              )}

              <div>
                <h1 className="text-2xl md:text-3xl font-black leading-tight">{establishment.name}</h1>
                {establishment.description && <p className="text-muted-foreground mt-1">{establishment.description}</p>}
              </div>
            </div>

            <Badge className="h-8 px-3 rounded-full">
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              Cardápio online
            </Badge>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {establishment.address && (
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {establishment.address}
              </span>
            )}
            {establishment.opening_hours && (
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {establishment.opening_hours}
              </span>
            )}
            {establishment.whatsapp && (
              <span className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                {formatPhone(establishment.whatsapp)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-center">
            <div className="relative max-w-xl w-full">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar no cardápio..."
                className="pl-9 h-11 rounded-full bg-background"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full px-3 py-1.5">
                <Flame className="h-3.5 w-3.5 mr-1 text-primary" />
                {filteredProducts.length} opções
              </Badge>
              <Badge variant="secondary" className="rounded-full px-3 py-1.5">
                <Star className="h-3.5 w-3.5 mr-1 text-primary" />
                {availableCount} disponíveis agora
              </Badge>
            </div>
          </div>

          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((category: any) => (
                <a
                  key={category.id}
                  href={`#cat-${category.id}`}
                  className="shrink-0 px-4 py-2 rounded-full border bg-background hover:bg-primary/10 hover:border-primary/40 transition-colors text-sm font-semibold"
                >
                  {category.name}
                </a>
              ))}
              {uncategorized.length > 0 && (
                <a
                  href="#cat-sem-categoria"
                  className="shrink-0 px-4 py-2 rounded-full border bg-background hover:bg-primary/10 hover:border-primary/40 transition-colors text-sm font-semibold"
                >
                  Extras
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 pt-6">
        <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-r from-primary/10 via-orange-100/50 to-background p-6 md:p-8">
          <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-primary/20 blur-2xl" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground font-bold">Seu pedido começa aqui</p>
              <h2 className="mt-2 text-2xl md:text-3xl font-black leading-tight">
                Escolhe no seu ritmo e monta o pedido sem estresse.
              </h2>
              <p className="mt-2 text-muted-foreground">
                Cardápio atualizado, preços claros e finalização rápida no WhatsApp.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="rounded-full px-3 py-1.5">Pedidos práticos</Badge>
              <Badge variant="secondary" className="rounded-full px-3 py-1.5">Sem enrolação</Badge>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        {categories.map((category: any) => {
          const catProducts = getProductsByCategory(category.id);
          if (catProducts.length === 0) return null;

          return (
            <section key={category.id} id={`cat-${category.id}`} className="space-y-4 scroll-mt-36">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-2xl font-black">{category.name}</h2>
                <Badge variant="secondary" className="rounded-full">{catProducts.length} item(ns)</Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {catProducts.map((product: any) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    description={product.description}
                    price={Number(product.price)}
                    image_url={product.image_url}
                    is_available={product.is_available}
                    onAdd={handleAddItem}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {uncategorized.length > 0 && (
          <section id="cat-sem-categoria" className="space-y-4 scroll-mt-36">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-2xl font-black">Outros sabores</h2>
              <Badge variant="secondary" className="rounded-full">{uncategorized.length} item(ns)</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {uncategorized.map((product: any) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  description={product.description}
                  price={Number(product.price)}
                  image_url={product.image_url}
                  is_available={product.is_available}
                  onAdd={handleAddItem}
                />
              ))}
            </div>
          </section>
        )}

        {filteredProducts.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nada encontrado com essa busca. Tenta outro termo.
            </CardContent>
          </Card>
        )}
      </main>

      {itemCount > 0 && (
        <div className="fixed bottom-6 right-6 z-40">
          <Button
            size="lg"
            onClick={() => setCartOpen(true)}
            className="rounded-full shadow-xl h-14 px-6 text-base bg-primary hover:bg-primary/90"
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            Ver carrinho ({itemCount})
          </Button>
        </div>
      )}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} establishmentSlug={slug!} />

      <footer className="text-center py-6 text-sm text-muted-foreground border-t">
        Plataforma oficial de pedidos <span className="font-semibold text-primary">PedeFácil</span>
      </footer>
    </div>
  );
}



