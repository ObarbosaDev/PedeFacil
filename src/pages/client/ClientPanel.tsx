import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import StatsCard from "@/components/dashboard/StatsCard";
import { formatPhone } from "@/lib/formatters";
import StateCard from "@/components/system/StateCard";
import { logAuditEvent, logClientError } from "@/lib/observability";
import {
  ArrowRight,
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
  Heart,
  Flame,
  WandSparkles,
  UserCircle2,
  ArrowUp,
} from "lucide-react";
import { toast } from "sonner";

type ClientFilter = "all" | "with_logo" | "with_address" | "with_description" | "favorites";
type ClientSort = "name" | "recent";
type ClientUserMetadata = {
  full_name?: string;
};

interface Establishment {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  opening_hours: string | null;
  whatsapp: string;
  logo_url: string | null;
  created_at: string;
}

interface LastVisitedStore {
  id: string;
  name: string;
  slug: string;
  visitedAt: string;
}

const sidebarItems = [
  { label: "Início", icon: Home, href: "#inicio" },
  { label: "Pra Você", icon: WandSparkles, href: "#para-voce" },
  { label: "Explorar Lojas", icon: Compass, href: "#explorar-lojas" },
  { label: "Achadinhos", icon: Tag, href: "#achadinhos" },
];

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    if (!value) return fallback;
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function getGreetingByHour() {
  const hour = new Date().getHours();
  if (hour < 5) {
    return {
      eyebrow: "Madrugada no ar",
      title: "Ainda acordado",
      description: "Se bateu a fome agora, escolhe uma loja e resolve isso sem enrolação.",
    };
  }
  if (hour < 12) {
    return {
      eyebrow: "Começo do dia",
      title: "Bom dia",
      description: "Dá para resolver seu pedido rápido e seguir o ritmo sem perder tempo.",
    };
  }
  if (hour < 18) {
    return {
      eyebrow: "Meio do corre",
      title: "Boa tarde",
      description: "Hora de abrir o cardápio, bater o olho no que presta e pedir sem atrito.",
    };
  }
  return {
    eyebrow: "Fim do dia",
    title: "Boa noite",
    description: "Agora é só escolher bem e fechar o pedido no seu tempo.",
  };
}

export default function ClientPanel() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();

  const storageKeys = useMemo(() => {
    const scope = user?.id || "guest";
    return {
      clientName: `pedefacil.client.name.${scope}`,
      favorites: `pedefacil.client.favorites.${scope}`,
      lastStore: `pedefacil.client.last_store.${scope}`,
    };
  }, [user?.id]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ClientFilter>("all");
  const [sortBy, setSortBy] = useState<ClientSort>("name");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);

  const [clientName, setClientName] = useState("");
  const [favoriteStoreIds, setFavoriteStoreIds] = useState<string[]>([]);
  const [lastVisitedStore, setLastVisitedStore] = useState<LastVisitedStore | null>(null);
  const greeting = getGreetingByHour();

  const {
    data: establishments = [],
    isLoading,
    isError: isEstablishmentsError,
    error: establishmentsError,
  } = useQuery<Establishment[]>({
    queryKey: ["client-establishments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("establishments")
        .select("id, name, slug, description, address, opening_hours, whatsapp, logo_url, created_at")
        .eq("is_active", true);
      return (data || []) as Establishment[];
    },
  });

  const { data: customerProfile } = useQuery({
    queryKey: ["customer-profile-panel", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("customer_profiles")
        .select("full_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as { full_name: string } | null;
    },
    enabled: !!user,
  });

  const { data: customerFavorites = [] } = useQuery<string[]>({
    queryKey: ["customer-favorites-panel", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("customer_favorites")
        .select("establishment_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data || []).map((row: { establishment_id: string }) => row.establishment_id);
    },
    enabled: !!user,
  });

  useEffect(() => {
    setClientName(localStorage.getItem(storageKeys.clientName) || "");
    setFavoriteStoreIds(readJson<string[]>(storageKeys.favorites, []));
    setLastVisitedStore(readJson<LastVisitedStore | null>(storageKeys.lastStore, null));
  }, [storageKeys]);

  useEffect(() => {
    localStorage.setItem(storageKeys.clientName, clientName.trim());
  }, [clientName, storageKeys]);

  useEffect(() => {
    localStorage.setItem(storageKeys.favorites, JSON.stringify(favoriteStoreIds));
  }, [favoriteStoreIds, storageKeys]);

  useEffect(() => {
    if (!lastVisitedStore) return;
    localStorage.setItem(storageKeys.lastStore, JSON.stringify(lastVisitedStore));
  }, [lastVisitedStore, storageKeys]);

  useEffect(() => {
    if (!user) return;
    setFavoriteStoreIds(customerFavorites);
  }, [customerFavorites, user]);

  useEffect(() => {
    if (!user) return;
    const profileName = customerProfile?.full_name?.trim();
    const metadataName = String(((user.user_metadata ?? {}) as ClientUserMetadata).full_name || "").trim();
    const resolvedName = profileName || metadataName;
    if (!resolvedName) return;
    setClientName(resolvedName);
  }, [customerProfile, user]);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 380);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!isEstablishmentsError || !establishmentsError) return;
    void logClientError({
      scope: "query",
      message: "Falha ao carregar estabelecimentos no painel do cliente",
      metadata: {
        error: String(establishmentsError),
      },
    });
  }, [establishmentsError, isEstablishmentsError]);

  const metrics = useMemo(() => {
    const total = establishments.length;
    const withLogo = establishments.filter((store) => !!store.logo_url).length;
    const withAddress = establishments.filter((store) => !!store.address).length;
    const withHours = establishments.filter((store) => !!store.opening_hours).length;

    return { total, withLogo, withAddress, withHours };
  }, [establishments]);

  const featured = useMemo(() => {
    return [...establishments]
      .sort((a, b) => {
        const scoreA = Number(!!a.logo_url) + Number(!!a.description) + Number(!!a.address);
        const scoreB = Number(!!b.logo_url) + Number(!!b.description) + Number(!!b.address);
        return scoreB - scoreA;
      })
      .slice(0, 3);
  }, [establishments]);

  const favoriteStores = useMemo(() => {
    const favoriteSet = new Set(favoriteStoreIds);
    return establishments.filter((store) => favoriteSet.has(store.id));
  }, [establishments, favoriteStoreIds]);

  const filteredEstablishments = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const favoriteSet = new Set(favoriteStoreIds);

    const byQuery = establishments.filter((store) => {
      if (!normalized) return true;
      const name = store.name?.toLowerCase() || "";
      const desc = store.description?.toLowerCase() || "";
      const address = store.address?.toLowerCase() || "";
      return name.includes(normalized) || desc.includes(normalized) || address.includes(normalized);
    });

    const byFilter = byQuery.filter((store) => {
      if (filter === "all") return true;
      if (filter === "with_logo") return !!store.logo_url;
      if (filter === "with_address") return !!store.address;
      if (filter === "with_description") return !!store.description;
      if (filter === "favorites") return favoriteSet.has(store.id);
      return true;
    });

    return [...byFilter].sort((a, b) => {
      if (sortBy === "recent") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return String(a.name).localeCompare(String(b.name), "pt-BR");
    });
  }, [establishments, search, filter, sortBy, favoriteStoreIds]);

  const personalizedStores = useMemo(() => {
    if (favoriteStores.length > 0) return favoriteStores.slice(0, 3);
    return featured;
  }, [favoriteStores, featured]);

  const topSpot = featured[0] || personalizedStores[0] || null;

  const favoriteMutation = useMutation({
    mutationFn: async ({ storeId, isFavorite }: { storeId: string; isFavorite: boolean }) => {
      if (!user) return;
      if (isFavorite) {
        const { error } = await (supabase as any)
          .from("customer_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("establishment_id", storeId);
        if (error) throw error;

        await logAuditEvent({
          actorUserId: user.id,
          actorRole: "customer",
          entityType: "customer_favorite",
          entityId: storeId,
          action: "favorite_removed",
        });
        return;
      }

      const { error } = await (supabase as any).from("customer_favorites").upsert(
        { user_id: user.id, establishment_id: storeId },
        { onConflict: "user_id,establishment_id" }
      );
      if (error) throw error;

      await logAuditEvent({
        actorUserId: user.id,
        actorRole: "customer",
        entityType: "customer_favorite",
        entityId: storeId,
        action: "favorite_added",
      });
    },
    onSuccess: () => {
      if (user) queryClient.invalidateQueries({ queryKey: ["customer-favorites-panel", user.id] });
    },
    onError: () => {
      toast.error("Não rolou atualizar suas favoritas agora.");
    },
  });

  const toggleFavorite = (storeId: string) => {
    const isFavorite = favoriteStoreIds.includes(storeId);

    setFavoriteStoreIds((prev) => {
      if (prev.includes(storeId)) return prev.filter((id) => id !== storeId);
      return [...prev, storeId];
    });

    if (user) favoriteMutation.mutate({ storeId, isFavorite });
  };

  const openWhatsApp = (phone: string) => {
    const clean = phone.replace(/\D/g, "");
    if (!clean) {
      toast.error("Essa loja ainda não configurou WhatsApp.");
      return;
    }
    window.open(`https://wa.me/${clean}`, "_blank");
  };

  const registerVisitedStore = (store: Establishment) => {
    setLastVisitedStore({
      id: store.id,
      name: store.name,
      slug: store.slug,
      visitedAt: new Date().toISOString(),
    });
  };

  const scrollToSection = (href: string) => {
    const targetId = href.replace("#", "");
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSignOut = async () => {
    setSignOutDialogOpen(false);
    await signOut();
  };

  if (isEstablishmentsError) {
    return (
      <div className="min-h-screen bg-muted/30 p-4 md:p-8">
        <div className="mx-auto max-w-3xl">
          <StateCard
            kind="error"
            title="Não conseguimos carregar as lojas agora"
            description="Pode ser instabilidade temporária. Tenta atualizar para continuar navegando."
            actionLabel="Recarregar página"
            action={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3efe6]">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-24 right-0 h-96 w-96 rounded-full bg-orange-200/30 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-sky-200/20 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(120deg,rgba(24,24,27,0.15)_1px,transparent_1px)] [background-size:22px_22px]" />
      </div>
      <a
        href="#cliente-conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[9999] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md"
      >
        Ir para o conteúdo principal
      </a>
      <div className="flex min-h-screen">
        <aside className="hidden lg:flex w-72 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
          <div className="p-6">
            <Link to="/" className="flex items-center" aria-label="Voltar para a página inicial">
              <img src="/logo.png" alt="Logo Pede Fácil" className="h-10 w-auto object-contain" />
            </Link>
            <p className="text-xs text-sidebar-foreground/60 mt-1">Sua base para pedir bem</p>
          </div>

          <nav className="px-3 space-y-1">
            {sidebarItems.map((item, index) => (
              <a
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                  index === 0
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/75 bg-sidebar-accent/30 hover:bg-sidebar-accent/60 transition-colors"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </a>
            ))}
          </nav>

          <div className="p-4 mt-4">
            <Card className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Radar rápido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-sidebar-foreground/80">
                <p>{metrics.total} loja(s) para conhecer</p>
                <p>{metrics.withAddress} com endereço certinho</p>
                <p>{metrics.withHours} com horário informado</p>
              </CardContent>
            </Card>
          </div>
        </aside>

        <main id="cliente-conteudo" className="flex-1 p-4 md:p-8 space-y-8 overflow-auto">
          <section className="lg:hidden rounded-xl border bg-card p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Navegação rápida</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {sidebarItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => scrollToSection(item.href)}
                  className="shrink-0 rounded-full border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-primary/10 hover:border-primary/40 transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          <section id="inicio" className="overflow-hidden rounded-[32px] border border-zinc-950/10 bg-[#111111] text-white shadow-[0_28px_100px_rgba(15,23,42,0.18)] scroll-mt-20">
            <div className="p-6 md:p-8 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_28%),linear-gradient(135deg,#111111,#1f2937_55%,#7c2d12_100%)]">
              <p className="text-xs uppercase tracking-widest opacity-85 mb-2">{greeting.eyebrow}</p>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-3xl md:text-4xl font-black">
                    {greeting.title}{clientName ? `, ${clientName}` : ""}. O que vai sair daí hoje?
                  </h1>
                  <p className="mt-2 text-primary-foreground/90 max-w-2xl">
                    {greeting.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {user ? (
                    <>
                      <Link to="/cliente/conta">
                        <Button variant="secondary" size="sm">
                          <UserCircle2 className="h-4 w-4 mr-2" />
                          Minha conta
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                        onClick={() => setSignOutDialogOpen(true)}
                      >
                        Sair
                      </Button>
                    </>
                  ) : (
                    <>
                      <Link to="/cliente/login"><Button variant="secondary" size="sm">Entrar</Button></Link>
                      <Link to="/cliente/registro"><Button variant="outline" size="sm" className="bg-white/10 border-white/30 text-white hover:bg-white/20">Criar conta</Button></Link>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 border-t border-white/10 bg-white/5 p-4 md:p-5 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Como você quer aparecer por aqui?"
                  className="border-white/10 bg-white text-zinc-950 placeholder:text-zinc-500"
                  aria-label="Nome de preferência"
                />
              </div>

              <div className="lg:col-span-4 relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar loja, bairro ou aquele tipo de comida..."
                  className="pl-9 border-white/10 bg-white text-zinc-950 placeholder:text-zinc-500"
                  aria-label="Buscar lojas"
                />
              </div>

              <div className="lg:col-span-2">
                <Select value={filter} onValueChange={(value) => setFilter(value as ClientFilter)}>
                  <SelectTrigger className="border-white/10 bg-white text-zinc-950">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tudo</SelectItem>
                    <SelectItem value="favorites">Favoritas</SelectItem>
                    <SelectItem value="with_logo">Com logo</SelectItem>
                    <SelectItem value="with_address">Com endereço</SelectItem>
                    <SelectItem value="with_description">Com descrição</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="lg:col-span-2">
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as ClientSort)}>
                  <SelectTrigger className="border-white/10 bg-white text-zinc-950">
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

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatsCard title="Lojas no radar" value={metrics.total} icon={Store} />
            <StatsCard title="Com logo" value={metrics.withLogo} icon={Sparkles} />
            <StatsCard title="Com endereço" value={metrics.withAddress} icon={MapPin} />
            <StatsCard title="Com horário" value={metrics.withHours} icon={Clock3} />
          </section>

          {topSpot && (
            <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
              <Card className="overflow-hidden rounded-[32px] border-zinc-950/10 bg-[#111111] text-white shadow-[0_28px_100px_rgba(15,23,42,0.16)]">
                <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="p-6 md:p-8">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Loja em destaque</p>
                    <h2 className="mt-3 text-3xl font-black tracking-tight">{topSpot.name}</h2>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-300">
                      {topSpot.description || "Loja pronta para abrir, escolher bem e fechar pedido sem fricção."}
                    </p>
                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Endereço</p>
                        <p className="mt-2 text-sm font-semibold text-white">{topSpot.address || "A loja ainda não soltou endereço no app."}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Funcionamento</p>
                        <p className="mt-2 text-sm font-semibold text-white">{topSpot.opening_hours || "Horário ainda não configurado"}</p>
                      </div>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-2">
                      <Link to={`/loja/${topSpot.slug}`} onClick={() => registerVisitedStore(topSpot)}>
                        <Button className="bg-white text-zinc-950 hover:bg-zinc-200">
                          <ShoppingBag className="mr-2 h-4 w-4" />
                          Abrir cardápio
                        </Button>
                      </Link>
                      <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => openWhatsApp(topSpot.whatsapp)}>
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Chamar no WhatsApp
                      </Button>
                    </div>
                  </div>

                  <div className="relative min-h-[280px] border-t border-white/10 lg:border-l lg:border-t-0">
                    {topSpot.logo_url ? (
                      <img src={topSpot.logo_url} alt={topSpot.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full min-h-[280px] items-center justify-center bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.25),transparent_45%),linear-gradient(135deg,#0f172a,#7c2d12)]">
                        <Store className="h-16 w-16 text-white/80" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-5">
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-300">Escolha rápida</p>
                      <p className="mt-1 text-lg font-black text-white">Se quiser um caminho curto, começa por aqui.</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="overflow-hidden rounded-[32px] border-zinc-950/10 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
                <CardHeader className="border-b border-zinc-950/10 bg-[#faf7f2]">
                  <CardTitle className="text-lg font-black tracking-tight">Seu ritmo por aqui</CardTitle>
                  <CardDescription>Atalhos montados para você chegar no pedido mais rápido.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 p-5">
                  <div className="rounded-2xl border border-zinc-200 bg-[#faf7f2] p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Favoritas</p>
                    <p className="mt-2 text-3xl font-black text-zinc-950">{favoriteStores.length}</p>
                    <p className="mt-2 text-sm text-zinc-600">Lojas que já ficaram no seu radar.</p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Última visita</p>
                    <p className="mt-2 text-lg font-black text-zinc-950">{lastVisitedStore?.name || "Nada salvo ainda"}</p>
                    <p className="mt-2 text-sm text-zinc-600">
                      {lastVisitedStore ? "Seu atalho para continuar de onde parou." : "Assim que você abrir uma loja, ela aparece aqui."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Exploração</p>
                    <p className="mt-2 text-sm text-zinc-600">Tem {filteredEstablishments.length} loja(s) na leitura atual. Se quiser abrir o funil, limpa os filtros e passeia mais.</p>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          <section id="para-voce" className="space-y-4 scroll-mt-20">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <WandSparkles className="h-5 w-5 text-primary" />
                Pra você
              </h2>
              <Badge variant="secondary">Personalizado</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="overflow-hidden rounded-[28px] border-zinc-950/10 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                <CardHeader>
                  <CardTitle className="text-base">Última loja visitada</CardTitle>
                  <CardDescription>
                    Volte rapidinho para onde você parou.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {lastVisitedStore ? (
                    <div className="space-y-3">
                      <p className="font-semibold">{lastVisitedStore.name}</p>
                      <Link to={`/loja/${lastVisitedStore.slug}`} className="block">
                        <Button className="w-full">
                          Continuar pedido
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Você ainda não abriu nenhum cardápio por aqui. Assim que pintar uma visita, ela fica salva nesse atalho.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="overflow-hidden rounded-[28px] border-zinc-950/10 bg-[linear-gradient(135deg,rgba(249,115,22,0.10),rgba(255,255,255,0.92))] shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    Suas favoritas
                  </CardTitle>
                  <CardDescription>
                    Salve lojas que você curte pra achar mais rápido.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {favoriteStores.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {favoriteStores.slice(0, 4).map((store) => (
                        <Link key={store.id} to={`/loja/${store.slug}`}>
                          <Badge className="rounded-full px-3 py-1">{store.name}</Badge>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Salva suas queridinhas no coração e deixa esse bloco com a sua cara.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {personalizedStores.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {personalizedStores.map((store) => (
                  <Card key={`personal-${store.id}`} className="overflow-hidden rounded-[28px] border-zinc-950/10 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                    <CardHeader>
                      <CardTitle className="text-base line-clamp-1">{store.name}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {store.description || "Loja pronta para você abrir, escolher e pedir sem travar."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Link to={`/loja/${store.slug}`} className="block" onClick={() => registerVisitedStore(store)}>
                        <Button size="sm" className="w-full">Abrir cardápio</Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section id="achadinhos" className="space-y-4 scroll-mt-20">
            {!isLoading && (
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Achadinhos do dia</h2>
                <Badge variant="secondary">{featured.length} destaque(s)</Badge>
              </div>
            )}

            {isLoading ? (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  Carregando destaques...
                </CardContent>
              </Card>
            ) : featured.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  Ainda sem destaque por aqui. Quando tiver loja redonda para aparecer primeiro, ela cai nessa vitrine.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {featured.map((store) => (
                  <Card key={`featured-${store.id}`} className="overflow-hidden rounded-[28px] border-zinc-950/10 bg-[linear-gradient(135deg,rgba(249,115,22,0.08),rgba(255,255,255,0.96))] shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                    <CardHeader>
                      <CardTitle className="text-base line-clamp-1">{store.name}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {store.description || "Loja redonda para abrir cardápio e pedir no app."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Link to={`/loja/${store.slug}`} className="block" onClick={() => registerVisitedStore(store)}>
                        <Button size="sm" className="w-full">Ver cardápio</Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <Separator />
          </section>

          <section id="explorar-lojas" className="space-y-4 scroll-mt-20">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xl font-bold">Explorar lojas</h2>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {filteredEstablishments.length} resultado(s)
              </p>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Card key={index} className="overflow-hidden rounded-[28px] border-zinc-950/10 bg-white/95 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                    <div className="h-24 bg-[linear-gradient(135deg,rgba(249,115,22,0.12),rgba(15,23,42,0.06))]" />
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
                  Nada apareceu com esse filtro. Troca a busca ou abre tudo de novo.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredEstablishments.map((store) => {
                  const isFavorite = favoriteStoreIds.includes(store.id);
                  return (
                  <Card key={store.id} className="group overflow-hidden rounded-[28px] border-zinc-950/10 bg-white/95 shadow-[0_18px_60px_rgba(15,23,42,0.08)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
                      <div className="relative h-24 bg-[linear-gradient(135deg,rgba(249,115,22,0.18),rgba(15,23,42,0.08))]">
                        <div className="absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.18),transparent_35%)]" />
                      </div>
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
                              <p className="text-xs text-muted-foreground">Pedir por aqui é rápido e direto.</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            className={`h-9 w-9 rounded-full border inline-flex items-center justify-center transition ${
                              isFavorite
                                ? "bg-rose-100 border-rose-300 text-rose-600"
                                : "bg-background border-border text-muted-foreground hover:border-primary/30 hover:text-primary"
                            }`}
                            onClick={() => toggleFavorite(store.id)}
                            aria-label={isFavorite ? `Remover ${store.name} dos favoritos` : `Adicionar ${store.name} aos favoritos`}
                            title={isFavorite ? "Remover dos favoritos" : "Salvar como favorita"}
                          >
                            <Heart className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
                          </button>
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
                          <Link to={`/loja/${store.slug}`} className="block" onClick={() => registerVisitedStore(store)}>
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
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>

      {showScrollTop && (
        <Button
          type="button"
          size="icon"
          className="fixed bottom-5 right-5 rounded-full shadow-lg z-40"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Voltar ao topo"
          title="Voltar ao topo"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      )}
      <AlertDialog open={signOutDialogOpen} onOpenChange={setSignOutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair da conta agora?</AlertDialogTitle>
            <AlertDialogDescription>
              Você volta para a área pública e precisa entrar de novo para acessar seus atalhos, favoritas e histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar aqui</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut}>Sair da conta</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}



