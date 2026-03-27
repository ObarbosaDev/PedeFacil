import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";

export default function Products() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "", category_id: "", is_available: true, image_url: "" });

  const { data: establishment } = useQuery({
    queryKey: ["my-establishment"],
    queryFn: async () => {
      const { data } = await supabase.from("establishments").select("*").eq("owner_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", establishment?.id],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").eq("establishment_id", establishment!.id).order("sort_order");
      return data || [];
    },
    enabled: !!establishment,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", establishment?.id],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*, categories(name)").eq("establishment_id", establishment!.id).order("name");
      return data || [];
    },
    enabled: !!establishment,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description || null,
        price: parseFloat(form.price),
        category_id: form.category_id || null,
        is_available: form.is_available,
        image_url: form.image_url || null,
        establishment_id: establishment!.id,
      };
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setDialogOpen(false);
      resetForm();
      toast.success(editing ? "Produto atualizado!" : "Produto criado!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto removido!");
    },
  });

  const resetForm = () => {
    setEditing(null);
    setForm({ name: "", description: "", price: "", category_id: "", is_available: true, image_url: "" });
  };

  const openEdit = (product: any) => {
    setEditing(product);
    setForm({
      name: product.name,
      description: product.description || "",
      price: String(product.price),
      category_id: product.category_id || "",
      is_available: product.is_available,
      image_url: product.image_url || "",
    });
    setDialogOpen(true);
  };

  if (!establishment) {
    return <p className="text-muted-foreground text-center py-12">Configure sua loja primeiro em "Minha Loja".</p>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Produtos</h1>
          <p className="text-muted-foreground">{products.length} produto(s) cadastrado(s)</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo Produto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="X-Burguer" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Hambúrguer artesanal..." />
              </div>
              <div>
                <Label>Preço (R$)</Label>
                <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="25.90" />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>URL da Imagem</Label>
                <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_available} onCheckedChange={(v) => setForm({ ...form, is_available: v })} />
                <Label>Disponível</Label>
              </div>
              <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={!form.name || !form.price}>
                {editing ? "Salvar" : "Criar Produto"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product: any) => (
          <Card key={product.id} className="overflow-hidden">
            {product.image_url && (
              <div className="aspect-video overflow-hidden">
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
              </div>
            )}
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{product.name}</h3>
                  <p className="text-sm text-muted-foreground">{product.categories?.name || "Sem categoria"}</p>
                  <p className="text-lg font-bold text-primary mt-1">{formatCurrency(Number(product.price))}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(product)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(product.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {!product.is_available && (
                <span className="text-xs text-destructive font-medium">Indisponível</span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
