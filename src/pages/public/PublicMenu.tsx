import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import ProductCard from "@/components/store/ProductCard";
import CartDrawer from "@/components/store/CartDrawer";
import { ShoppingCart, MapPin, Clock, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { formatPhone } from "@/lib/formatters";

export default function PublicMenu() {
  const { slug } = useParams<{ slug: string }>();
  const { addItem, itemCount } = useCart();
  const [cartOpen, setCartOpen] = useState(false);

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

  if (loadingStore) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!establishment) {
    return (
      <div className="flex items-center justify-center min-h-screen text-center p-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Loja não encontrada</h1>
          <p className="text-muted-foreground">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  const getProductsByCategory = (categoryId: string) =>
    products.filter((p) => p.category_id === categoryId);

  const uncategorized = products.filter((p) => !p.category_id);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4">
            {establishment.logo_url && (
              <img
                src={establishment.logo_url}
                alt={establishment.name}
                className="h-16 w-16 rounded-2xl object-cover border-2 border-primary-foreground/20"
              />
            )}
            <div>
              <h1 className="text-3xl font-extrabold">{establishment.name}</h1>
              {establishment.description && (
                <p className="opacity-90 mt-1">{establishment.description}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mt-4 text-sm opacity-80">
            {establishment.address && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />{establishment.address}
              </span>
            )}
            {establishment.opening_hours && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />{establishment.opening_hours}
              </span>
            )}
            {establishment.whatsapp && (
              <span className="flex items-center gap-1">
                <Phone className="h-4 w-4" />{formatPhone(establishment.whatsapp)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">
        {categories.map((category) => {
          const catProducts = getProductsByCategory(category.id);
          if (catProducts.length === 0) return null;

          return (
            <section key={category.id}>
              <h2 className="text-2xl font-bold mb-4 border-b pb-2">{category.name}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {catProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    description={product.description}
                    price={Number(product.price)}
                    image_url={product.image_url}
                    is_available={product.is_available}
                    onAdd={addItem}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {uncategorized.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold mb-4 border-b pb-2">Outros</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {uncategorized.map((product) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  description={product.description}
                  price={Number(product.price)}
                  image_url={product.image_url}
                  is_available={product.is_available}
                  onAdd={addItem}
                />
              ))}
            </div>
          </section>
        )}

        {products.length === 0 && (
          <p className="text-center text-muted-foreground py-12">Este cardápio ainda não tem produtos cadastrados.</p>
        )}
      </div>

      {/* Floating cart button */}
      {itemCount > 0 && (
        <div className="fixed bottom-6 right-6 z-40">
          <Button
            size="lg"
            onClick={() => setCartOpen(true)}
            className="rounded-full shadow-lg h-14 px-6 text-base"
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            Ver Carrinho ({itemCount})
          </Button>
        </div>
      )}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} establishmentSlug={slug!} />

      {/* Footer */}
      <footer className="text-center py-6 text-sm text-muted-foreground border-t">
        Feito com ❤️ por <span className="font-semibold text-primary">PedeFácil</span>
      </footer>
    </div>
  );
}
