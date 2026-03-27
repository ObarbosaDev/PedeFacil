import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";

export default function Loyalty() {
  const { user } = useAuth();

  const { data: establishment } = useQuery({
    queryKey: ["my-establishment"],
    queryFn: async () => {
      const { data } = await supabase.from("establishments").select("*").eq("owner_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["loyalty", establishment?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("loyalty_accounts")
        .select("*, customers(*)")
        .eq("establishment_id", establishment!.id)
        .order("points", { ascending: false });
      return data || [];
    },
    enabled: !!establishment,
  });

  if (!establishment) {
    return <p className="text-muted-foreground text-center py-12">Configure sua loja primeiro.</p>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Clientes VIP</h1>
        <p className="text-muted-foreground">Quem mais compra, mais pontos acumula.</p>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Ainda não tem cliente com pontos.</p>
            <p className="text-sm text-muted-foreground mt-1">Assim que os pedidos entrarem, os pontos vão aparecer aqui.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {accounts.map((account: any) => (
            <Card key={account.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{account.customers?.name || "Cliente"}</p>
                  <p className="text-sm text-muted-foreground">{account.customers?.phone}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-warning fill-warning" />
                  <span className="text-xl font-bold">{account.points}</span>
                  <span className="text-sm text-muted-foreground">pts</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
