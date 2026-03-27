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
import { validateImageFile } from "@/lib/security";

export default function Products() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
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

  const handleUploadImage = async (file?: File) => {
    if (!file || !establishment) return;
    const validation = validateImageFile(file);
    if (!validation.ok) {
      toast.error(validation.message);
      return;
    }

    try {
      setUploadingImage(true);
      const extension = file.name.split(".").pop() || "jpg";
      const filePath = `products/${establishment.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage.from("product-images").upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("product-images").getPublicUrl(filePath);
      setForm((prev) => ({ ...prev, image_url: data.publicUrl }));
      toast.success("Imagem enviada com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "não foi possível enviar a imagem.");
    } finally {
      setUploadingImage(false);
    }
  };

  if (!establishment) {
    return <p className="text-muted-foreground text-center py-12">Configure sua loja primeiro em "Minha Loja".</p>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cardápio</h1>
          <p className="text-muted-foreground">{products.length} item(ns) cadastrado(s)</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo Item</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Item" : "Novo Item"}</DialogTitle>
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
                <Label>Seção</Label>
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
                <Label>URL da imagem</Label>
                <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <Label>Upload da imagem</Label>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => handleUploadImage(e.target.files?.[0])}
                  disabled={uploadingImage}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {uploadingImage ? "Enviando imagem..." : "Formatos: JPG, PNG ou WEBP. Tamanho máximo: 3MB."}
                </p>
              </div>
              {form.image_url && (
                <div className="rounded-lg border p-2">
                  <img src={form.image_url} alt="Preview do produto" className="w-full h-36 object-cover rounded-md" />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch checked={form.is_available} onCheckedChange={(v) => setForm({ ...form, is_available: v })} />
                <Label>Disponível para venda</Label>
              </div>
              <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={!form.name || !form.price}>
                {editing ? "Salvar" : "Criar item"}
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
                  <p className="text-sm text-muted-foreground">{product.categories?.name || "Sem seção"}</p>
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
                <span className="text-xs text-destructive font-medium">Pausado no cardápio.</span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}


