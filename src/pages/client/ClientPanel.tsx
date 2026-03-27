import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPhone } from "@/lib/formatters";
import { MapPin, Clock, Phone, ShoppingBag } from "lucide-react";

export default function ClientPanel() {
  const { data: establishments = [], isLoading } = useQuery({
    queryKey: ["client-establishments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("establishments")
        .select("*")
        .eq("is_active", true)
        .order("name");

      return data || [];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/70 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold">Painel do Cliente</h1>
            <p className="text-sm text-muted-foreground">Escolha uma loja e faca seu pedido online.</p>
          </div>
          <Badge variant="secondary">{establishments.length} loja(s)</Badge>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : establishments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhuma loja ativa disponivel no momento.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {establishments.map((store: any) => (
              <Card key={store.id} className="overflow-hidden">
                <div className="h-24 bg-gradient-to-r from-primary/20 to-primary/5" />
                <CardHeader className="pt-4">
                  <CardTitle className="line-clamp-1">{store.name}</CardTitle>
                  {store.description && <CardDescription className="line-clamp-2">{store.description}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-3">
                  {store.address && (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span className="line-clamp-1">{store.address}</span>
                    </p>
                  )}

                  {store.opening_hours && (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>{store.opening_hours}</span>
                    </p>
                  )}

                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span>{formatPhone(store.whatsapp)}</span>
                  </p>

                  <Link to={`/loja/${store.slug}`} className="block pt-2">
                    <Button className="w-full">
                      <ShoppingBag className="h-4 w-4 mr-2" />
                      Comprar agora
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
