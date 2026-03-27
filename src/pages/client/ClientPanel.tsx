import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import StatsCard from "@/components/dashboard/StatsCard";
import { formatPhone } from "@/lib/formatters";
import {
  Compass,
  Clock3,
  Home,
  MapPin,
  MessageCircle,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
} from "lucide-react";

type ClientFilter = "all" | "with_logo" | "with_address" | "with_description";
type ClientSort = "name" | "recent";

const sidebarItems = [
  { label: "Início", icon: Home },
  { label: "Explorar Lojas", icon: Compass },
  { label: "Achadinhos", icon: Tag },
];

export default function ClientPanel() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ClientFilter>("all");
  const [sortBy, setSortBy] = useState<ClientSort>("name");

  const { data: establishments = [], isLoading } = useQuery({
    queryKey: ["client-establishments"],
    queryFn: async () => {
      const { data } = await supabase.from("establishments").select("*").eq("is_active", true);
      return data || [];
    },
  });

  const metrics = useMemo(() => {
    const total = establishments.length;
    const withLogo = establishments.filter((store: any) => !!store.logo_url).length;
    const withAddress = establishments.filter((store: any) => !!store.address).length;
    const withHours = establishments.filter((store: any) => !!store.opening_hours).length;

    return { total, withLogo, withAddress, withHours };
  }, [establishments]);

  const filteredEstablishments = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    const byQuery = establishments.filter((store: any) => {
      if (!normalized) return true;
      const name = store.name?.toLowerCase() || "";
      const desc = store.description?.toLowerCase() || "";
      const address = store.address?.toLowerCase() || "";
      return name.includes(normalized) || desc.includes(normalized) || address.includes(normalized);
    });

    const byFilter = byQuery.filter((store: any) => {
      if (filter === "all") return true;
      if (filter === "with_logo") return !!store.logo_url;
      if (filter === "with_address") return !!store.address;
      if (filter === "with_description") return !!store.description;
      return true;
    });

    const sorted = [...byFilter].sort((a: any, b: any) => {
      if (sortBy === "recent") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return String(a.name).localeCompare(String(b.name), "pt-BR");
    });

    return sorted;
  }, [establishments, search, filter, sortBy]);

  const featured = filteredEstablishments.slice(0, 3);

  const openWhatsApp = (phone: string) => {
    const clean = phone.replace(/\D/g, "");
    window.open(`https://wa.me/${clean}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="flex min-h-screen">
        <aside className="hidden lg:flex w-72 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
          <div className="p-6">
            <Link to="/" className="flex items-center gap-1">
              <span className="text-2xl font-extrabold text-sidebar-primary">Pede</span>
              <span className="text-2xl font-extrabold">Fácil</span>
            </Link>
            <p className="text-xs text-sidebar-foreground/60 mt-1">Seu cantinho de pedidos</p>
          </div>

          <nav className="px-3 space-y-1">
            {sidebarItems.map((item, index) => (
              <div
                key={item.label}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                  index === 0
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/75 bg-sidebar-accent/30"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </div>
            ))}
          </nav>

          <div className="p-4 mt-4">
            <Card className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Resumo da vez</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-sidebar-foreground/80">
                <p>{metrics.total} loja(s) pra conhecer</p>
                <p>{metrics.withAddress} com endereço certinho</p>
                <p>{metrics.withHours} com horário informado</p>
              </CardContent>
            </Card>
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-8 space-y-8 overflow-auto">
          <section className="rounded-2xl overflow-hidden border bg-card">
            <div className="p-6 md:p-8 bg-gradient-to-r from-primary via-primary to-orange-500 text-primary-foreground">
              <p className="text-xs uppercase tracking-widest opacity-85 mb-2">Bora pedir?</p>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-3xl md:text-4xl font-black">Escolha sua fome do momento.</h1>
                  <p className="mt-2 text-primary-foreground/90 max-w-2xl">
                    Dá uma olhada nas lojas, abre o cardápio e finaliza rapidinho.
                  </p>
                </div>
                <Sparkles className="h-8 w-8 opacity-90" />
              </div>
            </div>

            <div className="p-4 md:p-5 grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-7 relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Procure por nome da loja, bairro ou descrição..."
                  className="pl-9"
                />
              </div>
              <div className="lg:col-span-3">
                <Select value={filter} onValueChange={(value) => setFilter(value as ClientFilter)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tudo</SelectItem>
                    <SelectItem value="with_logo">Com logo</SelectItem>
                    <SelectItem value="with_address">Com endereço</SelectItem>
                    <SelectItem value="with_description">Com descrição</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="lg:col-span-2">
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as ClientSort)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">A-Z</SelectItem>
                    <SelectItem value="recent">Novidades</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatsCard title="Lojas Abertas" value={metrics.total} icon={Store} />
            <StatsCard title="Com Logo" value={metrics.withLogo} icon={Sparkles} />
            <StatsCard title="Com Endereço" value={metrics.withAddress} icon={MapPin} />
            <StatsCard title="Com Horário" value={metrics.withHours} icon={Clock3} />
          </section>

          {!isLoading && featured.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Lojas que estão bombando</h2>
                <Badge variant="secondary">{featured.length} selecionada(s)</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {featured.map((store: any) => (
                  <Card key={`featured-${store.id}`} className="border-primary/30 bg-primary/5">
                    <CardHeader>
                      <CardTitle className="text-base line-clamp-1">{store.name}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {store.description || "Cardápio pronto para pedidos online."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Link to={`/loja/${store.slug}`} className="block">
                        <Button size="sm" className="w-full">
                          Ver cardápio
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Separator />
            </section>
          )}

          <section className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xl font-bold">Explorar lojas</h2>
              <p className="text-sm text-muted-foreground">{filteredEstablishments.length} resultado(s)</p>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <Skeleton className="h-6 w-2/3" />
                      <Skeleton className="h-4 w-full" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Skeleton className="h-4 w-5/6" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-9 w-full mt-4" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredEstablishments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nada por aqui com esse filtro. Tenta outro termo.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredEstablishments.map((store: any) => (
                  <Card key={store.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <div className="h-24 bg-gradient-to-r from-primary/20 to-primary/5" />
                    <CardHeader className="pt-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {store.logo_url ? (
                            <img
                              src={store.logo_url}
                              alt={store.name}
                              className="h-12 w-12 rounded-xl object-cover border shrink-0"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                              {String(store.name).slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <CardTitle className="line-clamp-1 text-lg">{store.name}</CardTitle>
                            <p className="text-xs text-muted-foreground">Pedido online, sem enrolação.</p>
                          </div>
                        </div>
                        <Badge variant="secondary">No ar</Badge>
                      </div>
                      {store.description && <CardDescription className="line-clamp-2">{store.description}</CardDescription>}
                    </CardHeader>

                    <CardContent className="space-y-3">
                      {store.address && (
                        <p className="text-sm text-muted-foreground flex items-start gap-2">
                          <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                          <span className="line-clamp-1">{store.address}</span>
                        </p>
                      )}

                      {store.opening_hours && (
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Clock3 className="h-4 w-4 shrink-0" />
                          <span>{store.opening_hours}</span>
                        </p>
                      )}

                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 shrink-0" />
                        <span>{formatPhone(store.whatsapp)}</span>
                      </p>

                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <Link to={`/loja/${store.slug}`} className="block">
                          <Button size="sm" className="w-full">
                            <ShoppingBag className="h-4 w-4 mr-2" />
                            Cardápio
                          </Button>
                        </Link>
                        <Button variant="outline" size="sm" onClick={() => openWhatsApp(store.whatsapp)}>
                          <MessageCircle className="h-4 w-4 mr-2" />
                          WhatsApp
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
