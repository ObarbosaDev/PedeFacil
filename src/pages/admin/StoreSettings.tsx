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
import { validateImageFile } from "@/lib/security";

export default function StoreSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [uploadingLogo, setUploadingLogo] = useState(false);

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
      toast.success("Loja salva com sucesso.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleUploadLogo = async (file?: File) => {
    if (!file || !user) return;
    const validation = validateImageFile(file);
    if (!validation.ok) {
      toast.error(validation.message);
      return;
    }

    try {
      setUploadingLogo(true);
      const extension = file.name.split(".").pop() || "jpg";
      const filePath = `stores/${user.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage.from("product-images").upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("product-images").getPublicUrl(filePath);
      setForm((prev) => ({ ...prev, logo_url: data.publicUrl }));
      toast.success("Logo enviado com sucesso.");
    } catch (err: any) {
      toast.error(err.message || "Não foi possível enviar o logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  if (isLoading) return <p className="text-center py-12 text-muted-foreground">Carregando...</p>;

  const slug = slugify(form.name || "minha-loja");
  const publicUrl = `${window.location.origin}/loja/${slug}`;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Minha Loja</h1>
        <p className="text-muted-foreground">Aqui você ajusta tudo o que o cliente vai ver no cardápio.</p>
      </div>

      {establishment && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Link do seu cardápio:</p>
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
          <CardTitle>{establishment ? "Editar dados da loja" : "Criar minha loja"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nome da loja *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Hamburgueria do João" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Os melhores hambúrgueres artesanais..." />
          </div>
          <div>
            <Label>WhatsApp *</Label>
            <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="5511999998888" />
            <p className="text-xs text-muted-foreground mt-1">Use código do país + DDD + número. Exemplo: 5511999998888.</p>
          </div>
          <div>
            <Label>Endereço</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua das Flores, 123" />
          </div>
          <div>
            <Label>Horário de funcionamento</Label>
            <Input value={form.opening_hours} onChange={(e) => setForm({ ...form, opening_hours: e.target.value })} placeholder="Seg-Sex: 11h-23h | Sáb-Dom: 11h-00h" />
          </div>
          <div>
            <Label>URL do logo</Label>
            <Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." />
          </div>
          <div>
            <Label>Upload do logo</Label>
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => handleUploadLogo(e.target.files?.[0])}
              disabled={uploadingLogo}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {uploadingLogo ? "Enviando logo..." : "Formatos: JPG, PNG ou WEBP. Tamanho máximo: 3MB."}
            </p>
          </div>
          {form.logo_url && (
            <div className="rounded-lg border p-2 w-fit">
              <img src={form.logo_url} alt="Preview do logo" className="h-20 w-20 rounded-md object-cover" />
            </div>
          )}
          <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={!form.name || !form.whatsapp}>
            {establishment ? "Salvar alterações" : "Criar loja"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

