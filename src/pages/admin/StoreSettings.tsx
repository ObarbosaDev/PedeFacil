import { useEffect, useState } from "react";
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
import { ExternalLink, Plus, Trash2 } from "lucide-react";
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

  const { data: deliveryZones = [] } = useQuery({
    queryKey: ["store-delivery-zones", establishment?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("establishment_delivery_zones")
        .select("*")
        .eq("establishment_id", establishment!.id)
        .order("zip_prefix", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!establishment,
  });

  const { data: slaSettings } = useQuery({
    queryKey: ["store-sla-settings", establishment?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("establishment_sla_settings")
        .select("*")
        .eq("establishment_id", establishment!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!establishment,
  });

  const [form, setForm] = useState({
    name: "",
    description: "",
    whatsapp: "",
    address: "",
    opening_hours: "",
    logo_url: "",
  });

  const [zoneForm, setZoneForm] = useState({
    name: "",
    zipPrefix: "",
    fee: "",
    minOrderValue: "0",
    freeOverValue: "",
  });
  const [slaForm, setSlaForm] = useState({
    receivedMinutes: "5",
    confirmedMinutes: "10",
    inPreparationMinutes: "25",
    readyMinutes: "10",
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

  useEffect(() => {
    if (!slaSettings) return;
    setSlaForm({
      receivedMinutes: String(slaSettings.received_minutes || 5),
      confirmedMinutes: String(slaSettings.confirmed_minutes || 10),
      inPreparationMinutes: String(slaSettings.in_preparation_minutes || 25),
      readyMinutes: String(slaSettings.ready_minutes || 10),
    });
  }, [slaSettings]);

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

  const saveZoneMutation = useMutation({
    mutationFn: async () => {
      if (!establishment) throw new Error("Crie sua loja primeiro.");

      const zipPrefix = zoneForm.zipPrefix.replace(/\D/g, "");
      const fee = Number(zoneForm.fee);
      const minOrderValue = Number(zoneForm.minOrderValue || 0);
      const freeOverValue = zoneForm.freeOverValue ? Number(zoneForm.freeOverValue) : null;

      if (!zoneForm.name.trim()) throw new Error("Informe um nome para a zona.");
      if (zipPrefix.length < 3) throw new Error("Informe pelo menos 3 dígitos do CEP.");
      if (!Number.isFinite(fee) || fee < 0) throw new Error("Taxa de entrega inválida.");
      if (!Number.isFinite(minOrderValue) || minOrderValue < 0) throw new Error("Pedido mínimo inválido.");
      if (freeOverValue != null && (!Number.isFinite(freeOverValue) || freeOverValue < 0)) {
        throw new Error("Valor de frete grátis inválido.");
      }

      const { error } = await (supabase as any).from("establishment_delivery_zones").insert({
        establishment_id: establishment.id,
        name: zoneForm.name.trim(),
        zip_prefix: zipPrefix,
        fee,
        min_order_value: minOrderValue,
        free_over_value: freeOverValue,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setZoneForm({ name: "", zipPrefix: "", fee: "", minOrderValue: "0", freeOverValue: "" });
      queryClient.invalidateQueries({ queryKey: ["store-delivery-zones"] });
      toast.success("Zona de entrega salva.");
    },
    onError: (err: any) => toast.error(err.message || "Não foi possível salvar a zona."),
  });

  const deleteZoneMutation = useMutation({
    mutationFn: async (zoneId: string) => {
      const { error } = await (supabase as any).from("establishment_delivery_zones").delete().eq("id", zoneId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-delivery-zones"] });
      toast.success("Zona removida.");
    },
    onError: (err: any) => toast.error(err.message || "Não foi possível remover a zona."),
  });

  const saveSlaMutation = useMutation({
    mutationFn: async () => {
      if (!establishment) throw new Error("Crie sua loja primeiro.");
      const payload = {
        establishment_id: establishment.id,
        received_minutes: Number(slaForm.receivedMinutes),
        confirmed_minutes: Number(slaForm.confirmedMinutes),
        in_preparation_minutes: Number(slaForm.inPreparationMinutes),
        ready_minutes: Number(slaForm.readyMinutes),
      };

      if (Object.values(payload).some((value) => typeof value === "number" && (!Number.isFinite(value) || value <= 0))) {
        throw new Error("Preencha tempos de SLA válidos (em minutos).");
      }

      const { error } = await (supabase as any)
        .from("establishment_sla_settings")
        .upsert(payload, { onConflict: "establishment_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-sla-settings"] });
      toast.success("SLA salvo com sucesso.");
    },
    onError: (err: any) => toast.error(err.message || "Não foi possível salvar o SLA."),
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

      {establishment && (
        <Card>
          <CardHeader>
            <CardTitle>Zonas de entrega por CEP</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2">
                <Label>Nome da zona</Label>
                <Input value={zoneForm.name} onChange={(e) => setZoneForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Centro, Zona Sul..." />
              </div>
              <div>
                <Label>Prefixo CEP</Label>
                <Input value={zoneForm.zipPrefix} onChange={(e) => setZoneForm((prev) => ({ ...prev, zipPrefix: e.target.value }))} placeholder="01310" />
              </div>
              <div>
                <Label>Taxa (R$)</Label>
                <Input value={zoneForm.fee} onChange={(e) => setZoneForm((prev) => ({ ...prev, fee: e.target.value }))} placeholder="7.90" />
              </div>
              <div>
                <Label>Mínimo (R$)</Label>
                <Input value={zoneForm.minOrderValue} onChange={(e) => setZoneForm((prev) => ({ ...prev, minOrderValue: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="md:col-span-2">
                <Label>Frete grátis acima de (R$)</Label>
                <Input value={zoneForm.freeOverValue} onChange={(e) => setZoneForm((prev) => ({ ...prev, freeOverValue: e.target.value }))} placeholder="Ex.: 80.00" />
              </div>
            </div>

            <Button onClick={() => saveZoneMutation.mutate()} disabled={saveZoneMutation.isPending}>
              <Plus className="h-4 w-4 mr-2" />
              {saveZoneMutation.isPending ? "Salvando..." : "Adicionar zona"}
            </Button>

            <div className="space-y-2">
              {deliveryZones.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma zona configurada ainda.</p>
              ) : (
                (deliveryZones as any[]).map((zone) => (
                  <div key={zone.id} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{zone.name}</p>
                      <p className="text-sm text-muted-foreground">
                        CEP: {zone.zip_prefix} | Taxa: R$ {Number(zone.fee).toFixed(2)} | Mínimo: R$ {Number(zone.min_order_value).toFixed(2)}
                      </p>
                      {zone.free_over_value != null && (
                        <p className="text-sm text-muted-foreground">Frete grátis acima de R$ {Number(zone.free_over_value).toFixed(2)}</p>
                      )}
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => deleteZoneMutation.mutate(zone.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {establishment && (
        <Card>
          <CardHeader>
            <CardTitle>SLA da operação (minutos)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label>Recebido</Label>
                <Input value={slaForm.receivedMinutes} onChange={(e) => setSlaForm((prev) => ({ ...prev, receivedMinutes: e.target.value }))} />
              </div>
              <div>
                <Label>Confirmado</Label>
                <Input value={slaForm.confirmedMinutes} onChange={(e) => setSlaForm((prev) => ({ ...prev, confirmedMinutes: e.target.value }))} />
              </div>
              <div>
                <Label>Em preparo</Label>
                <Input value={slaForm.inPreparationMinutes} onChange={(e) => setSlaForm((prev) => ({ ...prev, inPreparationMinutes: e.target.value }))} />
              </div>
              <div>
                <Label>Pronto</Label>
                <Input value={slaForm.readyMinutes} onChange={(e) => setSlaForm((prev) => ({ ...prev, readyMinutes: e.target.value }))} />
              </div>
            </div>
            <Button onClick={() => saveSlaMutation.mutate()} disabled={saveSlaMutation.isPending}>
              {saveSlaMutation.isPending ? "Salvando SLA..." : "Salvar SLA"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

