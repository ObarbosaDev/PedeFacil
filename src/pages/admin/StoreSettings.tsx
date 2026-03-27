import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { slugify } from "@/lib/formatters";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";

export default function StoreSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: establishment, isLoading } = useQuery({
    queryKey: ["my-establishment"],
    queryFn: async () => {
      const { data } = await supabase.from("establishments").select("*").eq("owner_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const [form, setForm] = useState({
    name: "",
    description: "",
    whatsapp: "",
    address: "",
    opening_hours: "",
    logo_url: "",
  });

  // Sync form when data loads
  const [initialized, setInitialized] = useState(false);
  if (establishment && !initialized) {
    setForm({
      name: establishment.name || "",
      description: establishment.description || "",
      whatsapp: establishment.whatsapp || "",
      address: establishment.address || "",
      opening_hours: establishment.opening_hours || "",
      logo_url: establishment.logo_url || "",
    });
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const slug = slugify(form.name);
      if (establishment) {
        const { error } = await supabase
          .from("establishments")
          .update({ ...form, slug })
          .eq("id", establishment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("establishments")
          .insert({ ...form, slug, owner_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-establishment"] });
      toast.success("Loja salva com sucesso!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) return <p className="text-center py-12 text-muted-foreground">Carregando...</p>;

  const slug = slugify(form.name || "minha-loja");
  const publicUrl = `${window.location.origin}/loja/${slug}`;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Minha Loja</h1>
        <p className="text-muted-foreground">Configure os dados do seu estabelecimento</p>
      </div>

      {establishment && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Link público do seu cardápio:</p>
              <p className="text-sm text-primary font-semibold">{publicUrl}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.open(publicUrl, "_blank")}>
              <ExternalLink className="h-4 w-4 mr-1" /> Abrir
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{establishment ? "Editar Loja" : "Criar Loja"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nome da Loja *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Hamburgueria do João" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Os melhores hambúrgueres artesanais..." />
          </div>
          <div>
            <Label>WhatsApp *</Label>
            <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="5511999998888" />
            <p className="text-xs text-muted-foreground mt-1">Formato: código do país + DDD + número (ex: 5511999998888)</p>
          </div>
          <div>
            <Label>Endereço</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua das Flores, 123" />
          </div>
          <div>
            <Label>Horário de Funcionamento</Label>
            <Input value={form.opening_hours} onChange={(e) => setForm({ ...form, opening_hours: e.target.value })} placeholder="Seg-Sex: 11h-23h | Sáb-Dom: 11h-00h" />
          </div>
          <div>
            <Label>URL do Logo</Label>
            <Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." />
          </div>
          <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={!form.name || !form.whatsapp}>
            {establishment ? "Salvar Alterações" : "Criar Loja"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
