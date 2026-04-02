import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, TicketPercent } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { logAuditEvent } from "@/lib/observability";
import { toast } from "sonner";

type DiscountType = "percentage" | "fixed";

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  minimum_order_value: number;
  max_discount_value: number | null;
  usage_limit: number | null;
  usage_count: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

interface CouponFormState {
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: string;
  minimumOrderValue: string;
  maxDiscountValue: string;
  usageLimit: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
}

const defaultForm: CouponFormState = {
  code: "",
  description: "",
  discountType: "percentage",
  discountValue: "",
  minimumOrderValue: "0",
  maxDiscountValue: "",
  usageLimit: "",
  startsAt: "",
  expiresAt: "",
  isActive: true,
};

function toDatetimeLocal(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function Coupons() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState<CouponFormState>(defaultForm);

  const { data: establishment } = useQuery({
    queryKey: ["my-establishment"],
    queryFn: async () => {
      const { data } = await supabase.from("establishments").select("*").eq("owner_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: coupons = [] } = useQuery<Coupon[]>({
    queryKey: ["coupons", establishment?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("establishment_id", establishment!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Coupon[];
    },
    enabled: !!establishment,
  });

  const summary = useMemo(() => {
    const active = coupons.filter((coupon) => coupon.is_active).length;
    const scheduled = coupons.filter((coupon) => coupon.starts_at && new Date(coupon.starts_at) > new Date()).length;
    return { total: coupons.length, active, scheduled };
  }, [coupons]);

  const resetForm = () => {
    setEditing(null);
    setForm(defaultForm);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const normalizedCode = form.code.trim().toUpperCase();
      if (!normalizedCode) throw new Error("Informe o código do cupom.");

      const discountValue = Number(form.discountValue);
      if (!Number.isFinite(discountValue) || discountValue <= 0) {
        throw new Error("Informe um valor de desconto válido.");
      }

      if (form.discountType === "percentage" && discountValue > 100) {
        throw new Error("No desconto percentual, o valor máximo é 100.");
      }

      const minimumOrderValue = Number(form.minimumOrderValue || 0);
      if (!Number.isFinite(minimumOrderValue) || minimumOrderValue < 0) {
        throw new Error("Pedido mínimo inválido.");
      }

      const maxDiscountValue = form.maxDiscountValue ? Number(form.maxDiscountValue) : null;
      if (maxDiscountValue !== null && (!Number.isFinite(maxDiscountValue) || maxDiscountValue <= 0)) {
        throw new Error("O teto de desconto precisa ser maior que zero.");
      }

      const usageLimit = form.usageLimit ? Number(form.usageLimit) : null;
      if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit <= 0)) {
        throw new Error("O limite de uso precisa ser um número inteiro positivo.");
      }

      const startsAtIso = form.startsAt ? new Date(form.startsAt).toISOString() : null;
      const expiresAtIso = form.expiresAt ? new Date(form.expiresAt).toISOString() : null;

      if (startsAtIso && expiresAtIso && new Date(expiresAtIso) < new Date(startsAtIso)) {
        throw new Error("A data final não pode ser menor que a data inicial.");
      }

      const payload = {
        establishment_id: establishment!.id,
        code: normalizedCode,
        description: form.description.trim() || null,
        discount_type: form.discountType,
        discount_value: discountValue,
        minimum_order_value: minimumOrderValue,
        max_discount_value: maxDiscountValue,
        usage_limit: usageLimit,
        starts_at: startsAtIso,
        expires_at: expiresAtIso,
        is_active: form.isActive,
      };

      if (editing) {
        const { error } = await supabase.from("coupons").update(payload).eq("id", editing.id);
        if (error) throw error;

        await logAuditEvent({
          actorUserId: user?.id ?? null,
          actorRole: "store_owner",
          entityType: "coupon",
          entityId: editing.id,
          action: "coupon_updated",
          metadata: {
            establishmentId: establishment?.id ?? null,
            code: normalizedCode,
            discountType: payload.discount_type,
            discountValue: payload.discount_value,
            isActive: payload.is_active,
          },
        });
        return;
      }

      const { data: insertedCoupon, error } = await supabase.from("coupons").insert(payload).select("id").single();
      if (error) throw error;

      await logAuditEvent({
        actorUserId: user?.id ?? null,
        actorRole: "store_owner",
        entityType: "coupon",
        entityId: insertedCoupon?.id,
        action: "coupon_created",
        metadata: {
          establishmentId: establishment?.id ?? null,
          code: normalizedCode,
          discountType: payload.discount_type,
          discountValue: payload.discount_value,
          isActive: payload.is_active,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      setDialogOpen(false);
      resetForm();
      toast.success(editing ? "Cupom atualizado com sucesso." : "Cupom criado com sucesso.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Não rolou salvar o cupom.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const coupon = coupons.find((item) => item.id === id);
      const { error } = await supabase.from("coupons").delete().eq("id", id);
      if (error) throw error;

      await logAuditEvent({
        actorUserId: user?.id ?? null,
        actorRole: "store_owner",
        entityType: "coupon",
        entityId: id,
        action: "coupon_deleted",
        metadata: {
          establishmentId: establishment?.id ?? null,
          code: coupon?.code ?? null,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      toast.success("Cupom removido.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Não rolou remover o cupom.");
    },
  });

  const openEdit = (coupon: Coupon) => {
    setEditing(coupon);
    setForm({
      code: coupon.code || "",
      description: coupon.description || "",
      discountType: coupon.discount_type,
      discountValue: String(coupon.discount_value),
      minimumOrderValue: String(coupon.minimum_order_value ?? 0),
      maxDiscountValue: coupon.max_discount_value != null ? String(coupon.max_discount_value) : "",
      usageLimit: coupon.usage_limit != null ? String(coupon.usage_limit) : "",
      startsAt: toDatetimeLocal(coupon.starts_at),
      expiresAt: toDatetimeLocal(coupon.expires_at),
      isActive: coupon.is_active,
    });
    setDialogOpen(true);
  };

  if (!establishment) {
    return <p className="text-muted-foreground text-center py-12">Configura sua loja lá em "Minha Loja" primeiro.</p>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Cupons</h1>
          <p className="text-muted-foreground">Crie campanhas de desconto com regra certa, sem gambiarra.</p>
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo cupom
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar cupom" : "Novo cupom"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Código</Label>
                  <Input
                    value={form.code}
                    onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
                    placeholder="EX: BEMVINDO10"
                  />
                </div>
                <div>
                  <Label>Tipo de desconto</Label>
                  <Select value={form.discountType} onValueChange={(value) => setForm((prev) => ({ ...prev, discountType: value as DiscountType }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentual (%)</SelectItem>
                      <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Descrição (opcional)</Label>
                <Input
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Ex.: Cupom para primeira compra"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>{form.discountType === "percentage" ? "Desconto (%)" : "Desconto (R$)"}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.discountValue}
                    onChange={(event) => setForm((prev) => ({ ...prev, discountValue: event.target.value }))}
                    placeholder={form.discountType === "percentage" ? "10" : "5.00"}
                  />
                </div>
                <div>
                  <Label>Pedido mínimo (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.minimumOrderValue}
                    onChange={(event) => setForm((prev) => ({ ...prev, minimumOrderValue: event.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Teto de desconto (R$, opcional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.maxDiscountValue}
                    onChange={(event) => setForm((prev) => ({ ...prev, maxDiscountValue: event.target.value }))}
                    placeholder="Ex.: 20.00"
                  />
                </div>
                <div>
                  <Label>Limite de usos (opcional)</Label>
                  <Input
                    type="number"
                    step="1"
                    value={form.usageLimit}
                    onChange={(event) => setForm((prev) => ({ ...prev, usageLimit: event.target.value }))}
                    placeholder="Ex.: 100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Início (opcional)</Label>
                  <Input
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(event) => setForm((prev) => ({ ...prev, startsAt: event.target.value }))}
                  />
                </div>
                <div>
                  <Label>Fim (opcional)</Label>
                  <Input
                    type="datetime-local"
                    value={form.expiresAt}
                    onChange={(event) => setForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))} />
                <Label>Cupom ativo</Label>
              </div>

              <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : editing ? "Salvar alterações" : "Criar cupom"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total de cupons</p>
            <p className="text-2xl font-bold">{summary.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Ativos</p>
            <p className="text-2xl font-bold">{summary.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Agendados</p>
            <p className="text-2xl font-bold">{summary.scheduled}</p>
          </CardContent>
        </Card>
      </div>

      {coupons.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Você ainda não criou cupom. Crie o primeiro e já libera desconto no checkout.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {coupons.map((coupon) => {
            const isExpired = coupon.expires_at && new Date(coupon.expires_at) < new Date();
            const isScheduled = coupon.starts_at && new Date(coupon.starts_at) > new Date();

            return (
              <Card key={coupon.id} className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <TicketPercent className="h-5 w-5 text-primary" />
                        {coupon.code}
                      </CardTitle>
                      <CardDescription>{coupon.description || "Sem descrição"}</CardDescription>
                    </div>
                    <Badge variant={coupon.is_active ? "default" : "secondary"}>{coupon.is_active ? "Ativo" : "Pausado"}</Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg border p-2">
                      <p className="text-xs text-muted-foreground">Desconto</p>
                      <p className="font-semibold">
                        {coupon.discount_type === "percentage"
                          ? `${Number(coupon.discount_value)}%`
                          : formatCurrency(Number(coupon.discount_value))}
                      </p>
                    </div>
                    <div className="rounded-lg border p-2">
                      <p className="text-xs text-muted-foreground">Pedido mínimo</p>
                      <p className="font-semibold">{formatCurrency(Number(coupon.minimum_order_value || 0))}</p>
                    </div>
                  </div>

                  <div className="text-sm space-y-1 text-muted-foreground">
                    <p>
                      Uso: {coupon.usage_count}
                      {coupon.usage_limit ? ` / ${coupon.usage_limit}` : " (ilimitado)"}
                    </p>
                    {coupon.max_discount_value && <p>Teto de desconto: {formatCurrency(Number(coupon.max_discount_value))}</p>}
                    {coupon.starts_at && <p>Início: {formatDate(coupon.starts_at)}</p>}
                    {coupon.expires_at && <p>Fim: {formatDate(coupon.expires_at)}</p>}
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {isExpired && <Badge variant="destructive">Expirado</Badge>}
                    {!isExpired && isScheduled && <Badge variant="secondary">Agendado</Badge>}
                    {!isExpired && !isScheduled && coupon.is_active && <Badge variant="secondary">Disponível no checkout</Badge>}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(coupon)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(coupon.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

